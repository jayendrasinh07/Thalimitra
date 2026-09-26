BEGIN;

INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('90000000-0000-4000-8000-000000000026','notification-smoke@example.invalid','{}'::jsonb);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000026","role":"authenticated","aal":"aal1"}',true);
SELECT public.register_push_device(
  'notification-smoke-installation','notification-smoke-token-0000000000000000000000000000',
  'android','com.thalimitra.customer.preview','1.21'
);
RESET ROLE;

SELECT private.enqueue_notification(
  '90000000-0000-4000-8000-000000000026','customer','operational','smoke_update',
  'Notification smoke','This rollback-only notification validates the delivery queue.',
  'home','system',NULL,'notification:smoke:20260926',clock_timestamp()+interval '5 minutes'
);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.notifications WHERE user_id='90000000-0000-4000-8000-000000000026') <> 1
     OR (SELECT count(*) FROM private.notification_outbox) < 1 THEN
    RAISE EXCEPTION 'Notification enqueue or per-device delivery creation failed.';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000026","role":"authenticated","aal":"aal1"}',true);
DO $$
DECLARE v_center JSONB;
BEGIN
  v_center:=public.get_notification_center(10,0);
  IF (v_center->>'unreadCount')::INTEGER<>1 OR jsonb_array_length(v_center->'notifications')<>1 THEN
    RAISE EXCEPTION 'Owner inbox contract failed.';
  END IF;
END;
$$;
RESET ROLE;

DO $$
DECLARE v_delivery RECORD;
BEGIN
  SELECT * INTO v_delivery FROM public.claim_notification_deliveries(10,60) LIMIT 1;
  IF v_delivery.outbox_id IS NULL THEN RAISE EXCEPTION 'Delivery claim failed.'; END IF;
  IF NOT public.complete_notification_delivery(v_delivery.outbox_id,true,'smoke-provider-id',NULL,false) THEN
    RAISE EXCEPTION 'Delivery completion failed.';
  END IF;
END;
$$;

ROLLBACK;
