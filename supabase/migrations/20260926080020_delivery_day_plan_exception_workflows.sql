-- Idempotent customer skip/pause and MFA-protected Kitchen cancellation workflows.

ALTER TABLE public.meal_plan_subscriptions
  ADD COLUMN resume_on_date DATE;

CREATE TABLE private.meal_plan_commands (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  idempotency_key UUID NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  command_type TEXT NOT NULL CHECK (command_type IN (
    'customer_skip', 'customer_pause', 'customer_resume', 'kitchen_cancel'
  )),
  result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, idempotency_key)
);

ALTER TABLE private.meal_plan_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.meal_plan_commands FROM PUBLIC, anon, authenticated;

CREATE TRIGGER meal_plan_commands_immutable
  BEFORE UPDATE OR DELETE ON private.meal_plan_commands
  FOR EACH ROW EXECUTE FUNCTION private.reject_meal_plan_immutable_mutation();

CREATE OR REPLACE FUNCTION private.assert_meal_plan_change_cutoff(
  p_service_date DATE,
  p_meal_type TEXT,
  p_now TIMESTAMPTZ DEFAULT clock_timestamp()
) RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_now_ist TIMESTAMP := p_now AT TIME ZONE 'Asia/Kolkata';
  v_cutoff TIMESTAMP;
BEGIN
  IF p_meal_type = 'breakfast' THEN
    v_cutoff := (p_service_date - 1)::TIMESTAMP + TIME '22:00';
  ELSIF p_meal_type = 'lunch' THEN
    v_cutoff := p_service_date::TIMESTAMP + TIME '10:30';
  ELSIF p_meal_type = 'dinner' THEN
    v_cutoff := p_service_date::TIMESTAMP + TIME '17:30';
  ELSE
    RAISE EXCEPTION 'Choose Breakfast, Lunch, or Dinner.' USING ERRCODE = '22023';
  END IF;
  IF v_now_ist >= v_cutoff THEN
    RAISE EXCEPTION 'This meal is already locked for Kitchen preparation.' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_meal_plan_change_cutoff(DATE,TEXT,TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.append_replacement_meal_plan_occurrence(
  p_subscription_id UUID,
  p_meal_type TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_candidate DATE;
  v_occurrence_id UUID;
BEGIN
  SELECT subscription.* INTO v_subscription
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND OR v_subscription.status NOT IN ('active', 'paused')
     OR v_subscription.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only an active paid plan can move a delivery day.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meal_plan_services service
    WHERE service.subscription_id = p_subscription_id AND service.meal_type = p_meal_type
  ) THEN
    RAISE EXCEPTION 'This meal service is not part of the plan.' USING ERRCODE = '22023';
  END IF;

  SELECT greatest(
    coalesce(max(occurrence.service_date) + 1, v_subscription.preferred_start_date),
    v_subscription.preferred_start_date
  ) INTO v_candidate
  FROM public.meal_plan_occurrences occurrence
  WHERE occurrence.subscription_id = p_subscription_id
    AND occurrence.meal_type = p_meal_type;

  LOOP
    IF v_candidate > v_subscription.preferred_start_date + 1095 THEN
      RAISE EXCEPTION 'A replacement delivery day could not be found.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.meal_plan_weekdays weekday
      WHERE weekday.subscription_id = p_subscription_id
        AND weekday.meal_type = p_meal_type
        AND weekday.iso_weekday = extract(isodow FROM v_candidate)::SMALLINT
    ) AND NOT EXISTS (
      SELECT 1 FROM public.meal_plan_service_blackouts blackout
      WHERE blackout.service_date = v_candidate
        AND blackout.meal_type IN ('all', p_meal_type)
    ) AND NOT EXISTS (
      SELECT 1 FROM public.meal_plan_pause_days pause_day
      WHERE pause_day.subscription_id = p_subscription_id
        AND pause_day.service_date = v_candidate
        AND pause_day.meal_type IN ('all', p_meal_type)
    ) THEN
      INSERT INTO public.meal_plan_occurrences(subscription_id, meal_type, service_date, status)
      VALUES (p_subscription_id, p_meal_type, v_candidate, 'planned')
      ON CONFLICT (subscription_id, service_date, meal_type) DO NOTHING
      RETURNING id INTO v_occurrence_id;
      IF v_occurrence_id IS NOT NULL THEN
        UPDATE public.meal_plan_subscriptions subscription
        SET expected_completion_date = greatest(
          coalesce(subscription.expected_completion_date, v_candidate), v_candidate
        )
        WHERE subscription.id = p_subscription_id;
        RETURN v_occurrence_id;
      END IF;
    END IF;
    v_candidate := v_candidate + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.append_replacement_meal_plan_occurrence(UUID,TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.skip_delivery_day_plan(
  p_subscription_id UUID,
  p_service_date DATE,
  p_meal_type TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_occurrence RECORD;
  v_result JSONB;
  v_count INTEGER := 0;
  v_replacement UUID;
  v_reason TEXT := left(nullif(btrim(coalesce(p_reason, '')), ''), 240);
BEGIN
  IF p_idempotency_key IS NULL OR (p_meal_type IS NOT NULL AND p_meal_type NOT IN ('breakfast', 'lunch', 'dinner')) THEN
    RAISE EXCEPTION 'Invalid skip request.' USING ERRCODE = '22023';
  END IF;

  SELECT command.result INTO v_result
  FROM private.meal_plan_commands command
  WHERE command.subscription_id = p_subscription_id
    AND command.idempotency_key = p_idempotency_key
    AND command.command_type = 'customer_skip';
  IF FOUND THEN RETURN v_result; END IF;

  SELECT subscription.* INTO v_subscription
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id = p_subscription_id
    AND subscription.user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery-day plan was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_subscription.status <> 'active' OR v_subscription.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only an active paid plan can skip a delivery.' USING ERRCODE = '22023';
  END IF;

  FOR v_occurrence IN
    SELECT occurrence.*, orders.id AS order_id, orders.status AS order_status
    FROM public.meal_plan_occurrences occurrence
    LEFT JOIN public.orders orders ON orders.subscription_occurrence_id = occurrence.id
    WHERE occurrence.subscription_id = p_subscription_id
      AND occurrence.service_date = p_service_date
      AND (p_meal_type IS NULL OR occurrence.meal_type = p_meal_type)
      AND occurrence.status IN ('planned', 'order_created')
    ORDER BY occurrence.meal_type
    FOR UPDATE OF occurrence
  LOOP
    PERFORM private.assert_meal_plan_change_cutoff(
      v_occurrence.service_date, v_occurrence.meal_type, clock_timestamp()
    );
    IF v_occurrence.order_id IS NOT NULL AND v_occurrence.order_status <> 'confirmed' THEN
      RAISE EXCEPTION 'This meal is already being prepared and can no longer be skipped.' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.meal_plan_pause_days(subscription_id, service_date, meal_type, reason)
    VALUES (p_subscription_id, v_occurrence.service_date, v_occurrence.meal_type,
      coalesce(v_reason, 'Customer delivery skip'))
    ON CONFLICT (subscription_id, service_date, meal_type) DO NOTHING;

    UPDATE public.meal_plan_occurrences occurrence
    SET status = 'customer_skipped', resolved_at = now()
    WHERE occurrence.id = v_occurrence.id;

    IF v_occurrence.order_id IS NOT NULL THEN
      UPDATE public.orders orders
      SET status = 'cancelled', cancellation_reason = 'schedule_changed',
          cancellation_note = coalesce(v_reason, 'Moved from the delivery-day plan.'),
          cancelled_at = now()
      WHERE orders.id = v_occurrence.order_id;
    END IF;

    v_replacement := private.append_replacement_meal_plan_occurrence(
      p_subscription_id, v_occurrence.meal_type
    );
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No eligible delivery was found for this date.' USING ERRCODE = 'P0002';
  END IF;
  v_result := jsonb_build_object(
    'subscription_id', p_subscription_id,
    'service_date', p_service_date,
    'meal_type', coalesce(p_meal_type, 'all'),
    'moved_deliveries', v_count,
    'status', 'moved'
  );
  INSERT INTO private.meal_plan_commands(
    subscription_id, idempotency_key, actor_id, command_type, result
  ) VALUES (p_subscription_id, p_idempotency_key, v_actor, 'customer_skip', v_result);
  INSERT INTO private.meal_plan_events(
    subscription_id, actor_id, event_type, previous_status, next_status, event_data
  ) VALUES (
    p_subscription_id, v_actor, 'customer_delivery_moved', 'active', 'active',
    v_result || jsonb_build_object('reason', v_reason)
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_delivery_day_plan(
  p_subscription_id UUID,
  p_pause_from DATE,
  p_resume_on DATE,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_occurrence RECORD;
  v_result JSONB;
  v_count INTEGER := 0;
  v_reason TEXT := left(nullif(btrim(coalesce(p_reason, '')), ''), 240);
BEGIN
  IF p_idempotency_key IS NULL OR p_pause_from < current_date
     OR p_resume_on <= p_pause_from OR p_resume_on > p_pause_from + 90 THEN
    RAISE EXCEPTION 'Choose a valid pause of up to 90 days.' USING ERRCODE = '22023';
  END IF;
  SELECT command.result INTO v_result
  FROM private.meal_plan_commands command
  WHERE command.subscription_id = p_subscription_id
    AND command.idempotency_key = p_idempotency_key
    AND command.command_type = 'customer_pause';
  IF FOUND THEN RETURN v_result; END IF;

  SELECT subscription.* INTO v_subscription
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id = p_subscription_id AND subscription.user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery-day plan was not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_subscription.status <> 'active' OR v_subscription.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only an active paid plan can be paused.' USING ERRCODE = '22023';
  END IF;

  -- Pause first so replacement occurrence inserts cannot auto-materialize orders.
  UPDATE public.meal_plan_subscriptions subscription
  SET status = 'paused', paused_at = now(), resume_on_date = p_resume_on
  WHERE subscription.id = p_subscription_id;

  FOR v_occurrence IN
    SELECT occurrence.*, orders.id AS order_id, orders.status AS order_status
    FROM public.meal_plan_occurrences occurrence
    LEFT JOIN public.orders orders ON orders.subscription_occurrence_id = occurrence.id
    WHERE occurrence.subscription_id = p_subscription_id
      AND occurrence.service_date >= p_pause_from
      AND occurrence.service_date < p_resume_on
      AND occurrence.status IN ('planned', 'order_created')
    ORDER BY occurrence.service_date, occurrence.meal_type
    FOR UPDATE OF occurrence
  LOOP
    PERFORM private.assert_meal_plan_change_cutoff(
      v_occurrence.service_date, v_occurrence.meal_type, clock_timestamp()
    );
    IF v_occurrence.order_id IS NOT NULL AND v_occurrence.order_status <> 'confirmed' THEN
      RAISE EXCEPTION 'A meal in this pause window is already being prepared.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.meal_plan_pause_days(subscription_id, service_date, meal_type, reason)
    VALUES (p_subscription_id, v_occurrence.service_date, v_occurrence.meal_type,
      coalesce(v_reason, 'Customer plan pause'))
    ON CONFLICT (subscription_id, service_date, meal_type) DO NOTHING;
    UPDATE public.meal_plan_occurrences occurrence
    SET status = 'customer_skipped', resolved_at = now()
    WHERE occurrence.id = v_occurrence.id;
    IF v_occurrence.order_id IS NOT NULL THEN
      UPDATE public.orders orders
      SET status = 'cancelled', cancellation_reason = 'schedule_changed',
          cancellation_note = coalesce(v_reason, 'Moved during plan pause.'),
          cancelled_at = now()
      WHERE orders.id = v_occurrence.order_id;
    END IF;
    PERFORM private.append_replacement_meal_plan_occurrence(
      p_subscription_id, v_occurrence.meal_type
    );
    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'subscription_id', p_subscription_id,
    'pause_from', p_pause_from,
    'resume_on', p_resume_on,
    'moved_deliveries', v_count,
    'status', 'paused'
  );
  INSERT INTO private.meal_plan_commands(subscription_id,idempotency_key,actor_id,command_type,result)
  VALUES (p_subscription_id,p_idempotency_key,v_actor,'customer_pause',v_result);
  INSERT INTO private.meal_plan_events(subscription_id,actor_id,event_type,previous_status,next_status,event_data)
  VALUES (p_subscription_id,v_actor,'customer_plan_paused','active','paused',v_result || jsonb_build_object('reason',v_reason));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_delivery_day_plan(
  p_subscription_id UUID,
  p_idempotency_key UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_result JSONB;
  v_occurrence RECORD;
BEGIN
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Invalid resume request.' USING ERRCODE = '22023'; END IF;
  SELECT command.result INTO v_result
  FROM private.meal_plan_commands command
  WHERE command.subscription_id = p_subscription_id
    AND command.idempotency_key = p_idempotency_key
    AND command.command_type = 'customer_resume';
  IF FOUND THEN RETURN v_result; END IF;

  PERFORM 1 FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id = p_subscription_id
    AND subscription.user_id = v_actor
    AND subscription.status = 'paused'
    AND subscription.payment_status = 'paid'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paused delivery-day plan was not found.' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.meal_plan_subscriptions subscription
  SET status = 'active', paused_at = NULL, resume_on_date = NULL
  WHERE subscription.id = p_subscription_id;

  FOR v_occurrence IN
    SELECT DISTINCT occurrence.service_date, occurrence.meal_type
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = p_subscription_id
      AND occurrence.status = 'planned'
      AND occurrence.service_date BETWEEN current_date AND current_date + 7
    ORDER BY occurrence.service_date, occurrence.meal_type
  LOOP
    PERFORM private.materialize_delivery_day_plan_orders(
      v_occurrence.service_date, v_occurrence.meal_type
    );
  END LOOP;

  v_result := jsonb_build_object('subscription_id',p_subscription_id,'status','active');
  INSERT INTO private.meal_plan_commands(subscription_id,idempotency_key,actor_id,command_type,result)
  VALUES (p_subscription_id,p_idempotency_key,v_actor,'customer_resume',v_result);
  INSERT INTO private.meal_plan_events(subscription_id,actor_id,event_type,previous_status,next_status,event_data)
  VALUES (p_subscription_id,v_actor,'customer_plan_resumed','paused','active',v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_delivery_day_plan_occurrence(
  p_occurrence_id UUID,
  p_reason TEXT,
  p_idempotency_key UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_kitchen_access();
  v_occurrence public.meal_plan_occurrences%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_result JSONB;
  v_reason TEXT := btrim(coalesce(p_reason, ''));
  v_replacement UUID;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(v_reason) NOT BETWEEN 5 AND 240 THEN
    RAISE EXCEPTION 'Add a Kitchen cancellation reason.' USING ERRCODE = '22023';
  END IF;
  SELECT occurrence.* INTO v_occurrence
  FROM public.meal_plan_occurrences occurrence
  WHERE occurrence.id = p_occurrence_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan delivery was not found.' USING ERRCODE = 'P0002'; END IF;

  SELECT command.result INTO v_result
  FROM private.meal_plan_commands command
  WHERE command.subscription_id = v_occurrence.subscription_id
    AND command.idempotency_key = p_idempotency_key
    AND command.command_type = 'kitchen_cancel';
  IF FOUND THEN RETURN v_result; END IF;
  IF v_occurrence.status NOT IN ('planned','order_created') THEN
    RAISE EXCEPTION 'This plan delivery can no longer be cancelled.' USING ERRCODE = '23514';
  END IF;

  SELECT orders.* INTO v_order
  FROM public.orders orders
  WHERE orders.subscription_occurrence_id = p_occurrence_id
  FOR UPDATE;
  UPDATE public.meal_plan_occurrences occurrence
  SET status = 'kitchen_cancelled', resolved_at = now()
  WHERE occurrence.id = p_occurrence_id;
  IF v_order.id IS NOT NULL THEN
    UPDATE public.orders orders
    SET status = 'cancelled', cancellation_reason = 'other',
        cancellation_note = left('Kitchen: ' || v_reason, 500), cancelled_at = now()
    WHERE orders.id = v_order.id;
  END IF;
  v_replacement := private.append_replacement_meal_plan_occurrence(
    v_occurrence.subscription_id, v_occurrence.meal_type
  );
  v_result := jsonb_build_object(
    'subscription_id',v_occurrence.subscription_id,
    'occurrence_id',p_occurrence_id,
    'replacement_occurrence_id',v_replacement,
    'status','kitchen_cancelled'
  );
  INSERT INTO private.meal_plan_commands(subscription_id,idempotency_key,actor_id,command_type,result)
  VALUES (v_occurrence.subscription_id,p_idempotency_key,v_actor,'kitchen_cancel',v_result);
  INSERT INTO private.meal_plan_events(subscription_id,actor_id,event_type,previous_status,next_status,event_data)
  VALUES (v_occurrence.subscription_id,v_actor,'kitchen_delivery_cancelled',v_occurrence.status,'kitchen_cancelled',
    v_result || jsonb_build_object('reason',v_reason));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.skip_delivery_day_plan(UUID,DATE,TEXT,TEXT,UUID),
  public.pause_delivery_day_plan(UUID,DATE,DATE,TEXT,UUID),
  public.resume_delivery_day_plan(UUID,UUID),
  public.cancel_delivery_day_plan_occurrence(UUID,TEXT,UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_delivery_day_plan(UUID,DATE,TEXT,TEXT,UUID),
  public.pause_delivery_day_plan(UUID,DATE,DATE,TEXT,UUID),
  public.resume_delivery_day_plan(UUID,UUID),
  public.cancel_delivery_day_plan_occurrence(UUID,TEXT,UUID)
  TO authenticated;

COMMENT ON FUNCTION public.skip_delivery_day_plan(UUID,DATE,TEXT,TEXT,UUID) IS
  'Moves one selected service or every plan service on a date without losing entitlement; cutoff and ownership enforced.';
COMMENT ON FUNCTION public.pause_delivery_day_plan(UUID,DATE,DATE,TEXT,UUID) IS
  'Pauses an owned paid plan and moves eligible deliveries in the pause window.';
COMMENT ON FUNCTION public.cancel_delivery_day_plan_occurrence(UUID,TEXT,UUID) IS
  'MFA-protected Kitchen cancellation that restores the reservation and appends a replacement delivery.';
