-- Secure, role-aware notification inbox and push delivery outbox.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='supabase_vault') THEN
    CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
  END IF;
END;
$$;

CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  offers_enabled BOOLEAN NOT NULL DEFAULT false,
  area_updates_enabled BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata' CHECK (length(timezone) BETWEEN 3 AND 80),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('customer','kitchen','admin')),
  category TEXT NOT NULL CHECK (category IN ('operational','reminder','offer','area')),
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z0-9_]{3,64}$'),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 300),
  target_key TEXT NOT NULL CHECK (target_key IN (
    'home','order_history','meal_plans','customer_dashboard','coverage',
    'kitchen_dashboard','kitchen_management','kitchen_alerts'
  )),
  entity_type TEXT CHECK (entity_type IS NULL OR entity_type IN ('order','meal_plan','delivery_zone','system')),
  entity_id UUID,
  dedupe_key TEXT NOT NULL CHECK (length(dedupe_key) BETWEEN 8 AND 180),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, dedupe_key)
);

CREATE TABLE private.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL CHECK (length(installation_id) BETWEEN 8 AND 255),
  platform TEXT NOT NULL CHECK (platform IN ('android','web')),
  provider TEXT NOT NULL DEFAULT 'fcm' CHECK (provider = 'fcm'),
  push_token TEXT NOT NULL CHECK (length(push_token) BETWEEN 20 AND 4096),
  app_id TEXT NOT NULL CHECK (app_id IN ('com.thalimitra.customer','com.thalimitra.customer.preview','thalimitra-web')),
  app_version TEXT CHECK (app_version IS NULL OR length(app_version) <= 40),
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id, installation_id)
);

CREATE TABLE private.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES private.push_devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','sent','failed','suppressed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 12),
  available_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  lease_until TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  processed_at TIMESTAMPTZ,
  UNIQUE(notification_id, device_id)
);

CREATE TABLE private.notification_delivery_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outbox_id UUID NOT NULL REFERENCES private.notification_outbox(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','retry','failed')),
  provider TEXT NOT NULL DEFAULT 'fcm' CHECK (provider = 'fcm'),
  provider_message_id TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(outbox_id, attempt_number)
);

CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX push_devices_active_user_idx ON private.push_devices(user_id, last_seen_at DESC) WHERE active;
CREATE UNIQUE INDEX push_devices_active_token_unique ON private.push_devices(push_token) WHERE active;
CREATE INDEX notification_outbox_claim_idx ON private.notification_outbox(status, available_at, created_at)
  WHERE status IN ('pending','retry','processing');
CREATE INDEX notification_attempts_outbox_idx ON private.notification_delivery_attempts(outbox_id, created_at DESC);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_read_own ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY notification_preferences_insert_own ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY notification_preferences_update_own ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_read_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.notification_preferences, public.notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.push_devices, private.notification_outbox, private.notification_delivery_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notification_preferences, public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION private.notification_category_enabled(p_user_id UUID, p_category TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE p_category
    WHEN 'offer' THEN coalesce((SELECT offers_enabled FROM public.notification_preferences WHERE user_id=p_user_id), false)
    WHEN 'area' THEN coalesce((SELECT area_updates_enabled FROM public.notification_preferences WHERE user_id=p_user_id), true)
    WHEN 'reminder' THEN coalesce((SELECT reminders_enabled FROM public.notification_preferences WHERE user_id=p_user_id), true)
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION private.enqueue_notification(
  p_user_id UUID, p_audience TEXT, p_category TEXT, p_event_type TEXT,
  p_title TEXT, p_body TEXT, p_target_key TEXT, p_entity_type TEXT,
  p_entity_id UUID, p_dedupe_key TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_notification_id UUID;
BEGIN
  IF p_user_id IS NULL OR NOT private.notification_category_enabled(p_user_id, p_category) THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(user_id,audience,category,event_type,title,body,target_key,entity_type,entity_id,dedupe_key,expires_at)
  VALUES (p_user_id,p_audience,p_category,p_event_type,left(p_title,120),left(p_body,300),p_target_key,p_entity_type,p_entity_id,p_dedupe_key,p_expires_at)
  ON CONFLICT (user_id,dedupe_key) DO NOTHING RETURNING id INTO v_notification_id;
  IF v_notification_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO private.notification_outbox(notification_id,device_id)
  SELECT v_notification_id, device.id FROM private.push_devices device
  WHERE device.user_id=p_user_id AND device.active;
  RETURN v_notification_id;
END $$;

CREATE OR REPLACE FUNCTION private.notify_role(
  p_role TEXT, p_audience TEXT, p_category TEXT, p_event_type TEXT,
  p_title TEXT, p_body TEXT, p_target_key TEXT, p_entity_type TEXT,
  p_entity_id UUID, p_dedupe_key TEXT
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID; v_count INTEGER := 0;
BEGIN
  FOR v_user IN SELECT DISTINCT role.user_id FROM public.user_roles role WHERE role.role=p_role LOOP
    IF private.enqueue_notification(v_user,p_audience,p_category,p_event_type,p_title,p_body,p_target_key,p_entity_type,p_entity_id,p_dedupe_key,NULL) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.register_push_device(
  p_installation_id TEXT, p_push_token TEXT, p_platform TEXT,
  p_app_id TEXT, p_app_version TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in is required.' USING ERRCODE='42501'; END IF;
  IF length(trim(p_installation_id)) NOT BETWEEN 8 AND 255 OR length(trim(p_push_token)) NOT BETWEEN 20 AND 4096 THEN
    RAISE EXCEPTION 'Invalid device registration.' USING ERRCODE='22023';
  END IF;
  IF p_platform NOT IN ('android','web') OR p_app_id NOT IN ('com.thalimitra.customer','com.thalimitra.customer.preview','thalimitra-web') THEN
    RAISE EXCEPTION 'Unsupported notification client.' USING ERRCODE='22023';
  END IF;
  UPDATE private.push_devices SET active=false,revoked_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE push_token=p_push_token AND (user_id<>v_actor OR installation_id<>trim(p_installation_id));
  INSERT INTO private.push_devices(user_id,installation_id,platform,push_token,app_id,app_version)
  VALUES(v_actor,trim(p_installation_id),p_platform,trim(p_push_token),p_app_id,NULLIF(trim(p_app_version),''))
  ON CONFLICT(user_id,installation_id) DO UPDATE SET
    platform=EXCLUDED.platform,push_token=EXCLUDED.push_token,app_id=EXCLUDED.app_id,
    app_version=EXCLUDED.app_version,active=true,last_seen_at=clock_timestamp(),revoked_at=NULL,updated_at=clock_timestamp()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.unregister_push_device(p_installation_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in is required.' USING ERRCODE='42501'; END IF;
  UPDATE private.push_devices SET active=false,revoked_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE user_id=auth.uid() AND installation_id=p_installation_id AND active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END $$;

CREATE OR REPLACE FUNCTION public.get_notification_center(p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in is required.' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'unreadCount',(SELECT count(*) FROM public.notifications n WHERE n.user_id=v_actor AND n.read_at IS NULL),
    'preferences',coalesce((SELECT jsonb_build_object(
      'remindersEnabled',p.reminders_enabled,'offersEnabled',p.offers_enabled,
      'areaUpdatesEnabled',p.area_updates_enabled,'timezone',p.timezone
    ) FROM public.notification_preferences p WHERE p.user_id=v_actor),
      jsonb_build_object('remindersEnabled',true,'offersEnabled',false,'areaUpdatesEnabled',true,'timezone','Asia/Kolkata')),
    'notifications',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',n.id,'audience',n.audience,'category',n.category,'eventType',n.event_type,
      'title',n.title,'body',n.body,'targetKey',n.target_key,'entityType',n.entity_type,
      'entityId',n.entity_id,'readAt',n.read_at,'createdAt',n.created_at
    ) ORDER BY n.created_at DESC) FROM (
      SELECT * FROM public.notifications WHERE user_id=v_actor AND (expires_at IS NULL OR expires_at>clock_timestamp())
      ORDER BY created_at DESC LIMIT greatest(1,least(coalesce(p_limit,50),100)) OFFSET greatest(coalesce(p_offset,0),0)
    ) n),'[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID DEFAULT NULL, p_mark_all BOOLEAN DEFAULT false)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_count INTEGER;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in is required.' USING ERRCODE='42501'; END IF;
  IF NOT p_mark_all AND p_notification_id IS NULL THEN RAISE EXCEPTION 'Notification id is required.' USING ERRCODE='22023'; END IF;
  UPDATE public.notifications SET read_at=coalesce(read_at,clock_timestamp())
  WHERE user_id=v_actor AND read_at IS NULL AND (p_mark_all OR id=p_notification_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_reminders_enabled BOOLEAN, p_offers_enabled BOOLEAN, p_area_updates_enabled BOOLEAN
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_row public.notification_preferences%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in is required.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.notification_preferences(user_id,reminders_enabled,offers_enabled,area_updates_enabled)
  VALUES(v_actor,coalesce(p_reminders_enabled,true),coalesce(p_offers_enabled,false),coalesce(p_area_updates_enabled,true))
  ON CONFLICT(user_id) DO UPDATE SET reminders_enabled=EXCLUDED.reminders_enabled,
    offers_enabled=EXCLUDED.offers_enabled,area_updates_enabled=EXCLUDED.area_updates_enabled,updated_at=clock_timestamp()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('remindersEnabled',v_row.reminders_enabled,'offersEnabled',v_row.offers_enabled,
    'areaUpdatesEnabled',v_row.area_updates_enabled,'timezone',v_row.timezone);
END $$;

CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(p_batch_size INTEGER DEFAULT 50, p_lease_seconds INTEGER DEFAULT 120)
RETURNS TABLE(outbox_id UUID,push_token TEXT,title TEXT,body TEXT,target_key TEXT,event_type TEXT,notification_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY WITH claim AS (
    SELECT box.id FROM private.notification_outbox box
    JOIN private.push_devices device ON device.id=box.device_id AND device.active
    WHERE box.attempts < 8 AND box.available_at<=clock_timestamp()
      AND (box.status IN ('pending','retry') OR (box.status='processing' AND box.lease_until<clock_timestamp()))
    ORDER BY box.available_at,box.created_at
    FOR UPDATE OF box SKIP LOCKED LIMIT greatest(1,least(coalesce(p_batch_size,50),100))
  ), updated AS (
    UPDATE private.notification_outbox box SET status='processing',attempts=box.attempts+1,
      lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(coalesce(p_lease_seconds,120),600)))
    FROM claim WHERE box.id=claim.id RETURNING box.*
  )
  SELECT updated.id,device.push_token,n.title,n.body,n.target_key,n.event_type,n.id
  FROM updated JOIN private.push_devices device ON device.id=updated.device_id
  JOIN public.notifications n ON n.id=updated.notification_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_notification_delivery(
  p_outbox_id UUID,p_success BOOLEAN,p_provider_message_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,p_permanent_failure BOOLEAN DEFAULT false
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_box private.notification_outbox%ROWTYPE; v_status TEXT;
BEGIN
  SELECT * INTO v_box FROM private.notification_outbox WHERE id=p_outbox_id FOR UPDATE;
  IF NOT FOUND OR v_box.status<>'processing' THEN RETURN false; END IF;
  v_status := CASE WHEN p_success THEN 'sent' WHEN p_permanent_failure OR v_box.attempts>=8 THEN 'failed' ELSE 'retry' END;
  INSERT INTO private.notification_delivery_attempts(outbox_id,attempt_number,status,provider_message_id,error_code)
  VALUES(p_outbox_id,v_box.attempts,v_status,NULLIF(left(p_provider_message_id,255),''),NULLIF(left(p_error_code,120),''));
  UPDATE private.notification_outbox SET status=v_status,provider_message_id=NULLIF(left(p_provider_message_id,255),''),
    last_error_code=NULLIF(left(p_error_code,120),''),lease_until=NULL,
    available_at=CASE WHEN v_status='retry' THEN clock_timestamp()+make_interval(secs=>least(3600,30*(2^least(v_box.attempts,6)))) ELSE available_at END,
    processed_at=CASE WHEN v_status IN ('sent','failed') THEN clock_timestamp() ELSE NULL END
  WHERE id=p_outbox_id;
  IF v_status='failed' AND p_permanent_failure THEN
    UPDATE private.push_devices device SET active=false,revoked_at=clock_timestamp(),updated_at=clock_timestamp()
    FROM private.notification_outbox box WHERE box.id=p_outbox_id AND device.id=box.device_id;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION private.orders_notification_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event TEXT; v_title TEXT; v_body TEXT; v_capacity INTEGER; v_used INTEGER;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM private.enqueue_notification(NEW.user_id,'customer','operational','order_received','Order received',
      'We received your meal order. Open Thalimitra for its latest status.','order_history','order',NEW.id,
      'order:'||NEW.id||':received',NULL);
  END IF;
  IF TG_OP='UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status='paid' THEN
    PERFORM private.enqueue_notification(NEW.user_id,'customer','operational','payment_verified','Payment verified',
      'Your payment was verified successfully.','order_history','order',NEW.id,'order:'||NEW.id||':payment:paid',NULL);
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'order_'||NEW.status;
    v_title := CASE NEW.status WHEN 'confirmed' THEN 'Order confirmed' WHEN 'preparing' THEN 'Kitchen is preparing your meal'
      WHEN 'ready' THEN 'Your meal is ready' WHEN 'out_for_delivery' THEN 'Meal is on the way'
      WHEN 'delivered' THEN 'Meal delivered' WHEN 'cancelled' THEN 'Order cancelled' ELSE 'Order updated' END;
    v_body := CASE NEW.status WHEN 'confirmed' THEN 'Your order is confirmed for the selected delivery time.'
      WHEN 'preparing' THEN 'Your meal is now being prepared.' WHEN 'ready' THEN 'Your meal is packed and ready for dispatch.'
      WHEN 'out_for_delivery' THEN 'Your meal has left the kitchen. Open the app for current details.'
      WHEN 'delivered' THEN 'Your meal has been marked delivered.' WHEN 'cancelled' THEN 'Your order was cancelled. Open the app for details.'
      ELSE 'Open Thalimitra to see the latest order status.' END;
    PERFORM private.enqueue_notification(NEW.user_id,'customer','operational',v_event,v_title,v_body,'order_history','order',NEW.id,
      'order:'||NEW.id||':status:'||NEW.status,NULL);
    IF NEW.status='confirmed' THEN
      PERFORM private.notify_role('kitchen','kitchen','operational','kitchen_order_confirmed','New confirmed meal',
        'A confirmed meal was added to the production queue.','kitchen_dashboard','order',NEW.id,'kitchen:order:'||NEW.id||':confirmed');
    ELSIF NEW.status='cancelled' THEN
      PERFORM private.notify_role('kitchen','kitchen','operational','kitchen_order_cancelled','Production order cancelled',
        'A meal was removed from the active production queue.','kitchen_dashboard','order',NEW.id,'kitchen:order:'||NEW.id||':cancelled');
    END IF;
  END IF;
  IF (TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)) AND NEW.status='confirmed' THEN
    SELECT slot.max_orders INTO v_capacity FROM public.delivery_slots slot WHERE slot.id=NEW.delivery_slot_id;
    SELECT coalesce(sum(o.quantity),0) INTO v_used FROM public.orders o
      WHERE o.order_date=NEW.order_date AND o.delivery_slot_id=NEW.delivery_slot_id AND o.status<>'cancelled';
    IF v_capacity>0 AND v_used*100>=v_capacity*80 THEN
      PERFORM private.notify_role('admin','admin','operational','capacity_threshold','Capacity needs attention',
        'A delivery batch has reached at least 80% of its portion capacity.','kitchen_alerts','system',NULL,
        'capacity:'||NEW.order_date||':'||NEW.delivery_slot_id||':80');
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER orders_notification_events AFTER INSERT OR UPDATE OF status,payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.orders_notification_trigger();

CREATE OR REPLACE FUNCTION private.meal_plan_notification_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_title TEXT; v_body TEXT;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM private.notify_role('admin','admin','operational','plan_request','New meal-plan request',
      'A customer submitted a delivery-day plan for review.','kitchen_management','meal_plan',NEW.id,'admin:plan:'||NEW.id||':requested');
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := CASE NEW.status WHEN 'quoted' THEN 'Your plan quote is ready' WHEN 'accepted' THEN 'Plan quote accepted'
      WHEN 'payment_pending' THEN 'Plan awaiting payment verification' WHEN 'active' THEN 'Meal plan activated'
      WHEN 'paused' THEN 'Meal plan paused' WHEN 'completed' THEN 'Meal plan completed'
      WHEN 'cancelled' THEN 'Meal plan cancelled' ELSE 'Meal plan updated' END;
    v_body := CASE NEW.status WHEN 'quoted' THEN 'Review your itemized quote before accepting it.'
      WHEN 'accepted' THEN 'Your accepted plan is waiting for verified payment.'
      WHEN 'payment_pending' THEN 'Payment verification is pending.' WHEN 'active' THEN 'Your delivery-day schedule is now active.'
      WHEN 'paused' THEN 'Your unused plan balance is preserved while paused.'
      WHEN 'completed' THEN 'All entitled meal deliveries in this plan are complete.'
      WHEN 'cancelled' THEN 'Open the app to review the cancellation status.' ELSE 'Open Meal plans for the latest status.' END;
    PERFORM private.enqueue_notification(NEW.user_id,'customer','operational','plan_'||NEW.status,v_title,v_body,
      'meal_plans','meal_plan',NEW.id,'plan:'||NEW.id||':status:'||NEW.status,NULL);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER meal_plan_notification_events AFTER INSERT OR UPDATE OF status,payment_status ON public.meal_plan_subscriptions
FOR EACH ROW EXECUTE FUNCTION private.meal_plan_notification_trigger();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.enqueue_upcoming_delivery_reminders()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row RECORD; v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT DISTINCT subscription.user_id,subscription.id FROM public.meal_plan_occurrences occurrence
    JOIN public.meal_plan_subscriptions subscription ON subscription.id=occurrence.subscription_id
    WHERE occurrence.service_date=((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+1)
      AND occurrence.status='planned' AND subscription.status='active'
  LOOP
    IF private.enqueue_notification(v_row.user_id,'customer','reminder','tomorrow_plan_delivery','Tomorrow’s meals are scheduled',
      'Open Thalimitra to review tomorrow’s planned meal deliveries.','meal_plans','meal_plan',v_row.id,
      'plan:'||v_row.id||':reminder:'||((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+1),
      clock_timestamp()+interval '36 hours') IS NOT NULL THEN v_count:=v_count+1; END IF;
  END LOOP;
  FOR v_row IN
    SELECT order_row.user_id,order_row.id FROM public.orders order_row
    WHERE order_row.order_date=((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+1)
      AND order_row.status IN ('confirmed','preparing')
  LOOP
    IF private.enqueue_notification(v_row.user_id,'customer','reminder','tomorrow_order_delivery','Tomorrow’s meal is scheduled',
      'Open Thalimitra to review your scheduled meal.','order_history','order',v_row.id,
      'order:'||v_row.id||':reminder:'||((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+1),
      clock_timestamp()+interval '36 hours') IS NOT NULL THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.notify_waitlist_area(p_area TEXT,p_pincode TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID; v_row RECORD; v_count INTEGER:=0; v_key TEXT;
BEGIN
  v_actor:=private.require_admin_access();
  IF length(trim(p_area))<2 THEN RAISE EXCEPTION 'Area is required.' USING ERRCODE='22023'; END IF;
  v_key:='area:'||lower(regexp_replace(trim(p_area),'[^a-zA-Z0-9]+','-','g'))||':'||coalesce(trim(p_pincode),'');
  FOR v_row IN SELECT DISTINCT waitlist.user_id FROM public.area_waitlist waitlist
    WHERE waitlist.user_id IS NOT NULL AND (
      lower(waitlist.area)=lower(trim(p_area)) OR
      (NULLIF(trim(p_pincode),'') IS NOT NULL AND waitlist.pincode=trim(p_pincode))
    )
  LOOP
    IF private.enqueue_notification(v_row.user_id,'customer','area','area_available','Thalimitra is now available nearby',
      'Check your exact address and today’s published meals in the app.','coverage','delivery_zone',NULL,v_key,NULL) IS NOT NULL THEN
      v_count:=v_count+1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION private.prune_stale_push_devices()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE private.push_devices SET active=false,revoked_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE active AND last_seen_at<clock_timestamp()-interval '60 days';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION private.invoke_notification_worker()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL OR to_regnamespace('net') IS NULL THEN RETURN; END IF;
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=$1 LIMIT 1' INTO v_key USING 'notification_worker_key';
  IF v_key IS NULL THEN RETURN; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 15000)'
    USING 'https://boeceqmjrnxpkmhppblq.supabase.co/functions/v1/push-notification-worker',
      jsonb_build_object('Content-Type','application/json','x-worker-key',v_key),'{}'::jsonb;
END $$;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ($1,$2,$3)'
      USING 'thalimitra-notification-reminders','thalimitra-notification-worker','thalimitra-push-device-cleanup';
    PERFORM cron.schedule('thalimitra-notification-reminders','15 * * * *','SELECT private.enqueue_upcoming_delivery_reminders()');
    PERFORM cron.schedule('thalimitra-notification-worker','* * * * *','SELECT private.invoke_notification_worker()');
    PERFORM cron.schedule('thalimitra-push-device-cleanup','30 3 * * *','SELECT private.prune_stale_push_devices()');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.notification_category_enabled(UUID,TEXT),
  private.enqueue_notification(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TIMESTAMPTZ),
  private.notify_role(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT),
  private.orders_notification_trigger(),private.meal_plan_notification_trigger(),
  private.enqueue_upcoming_delivery_reminders(),private.prune_stale_push_devices(),private.invoke_notification_worker()
FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.register_push_device(TEXT,TEXT,TEXT,TEXT,TEXT),
  public.unregister_push_device(TEXT),public.get_notification_center(INTEGER,INTEGER),
  public.mark_notification_read(UUID,BOOLEAN),public.update_notification_preferences(BOOLEAN,BOOLEAN,BOOLEAN),
  public.claim_notification_deliveries(INTEGER,INTEGER),
  public.complete_notification_delivery(UUID,BOOLEAN,TEXT,TEXT,BOOLEAN),public.notify_waitlist_area(TEXT,TEXT)
FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.register_push_device(TEXT,TEXT,TEXT,TEXT,TEXT),
  public.unregister_push_device(TEXT),public.get_notification_center(INTEGER,INTEGER),
  public.mark_notification_read(UUID,BOOLEAN),public.update_notification_preferences(BOOLEAN,BOOLEAN,BOOLEAN)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_waitlist_area(TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries(INTEGER,INTEGER),
  public.complete_notification_delivery(UUID,BOOLEAN,TEXT,TEXT,BOOLEAN) TO service_role;

COMMENT ON TABLE public.notifications IS 'Customer-safe in-app notification inbox; push is an optional delivery channel.';
COMMENT ON TABLE private.push_devices IS 'Private FCM device registrations; never exposed to client reads.';
COMMENT ON TABLE private.notification_outbox IS 'Per-device, retryable and deduplicated push delivery queue.';
