-- Live provider smoke: use only against a non-local project, then run the cleanup file.
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000027';
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('90000000-0000-4000-8000-000000000027','notification-worker-smoke@example.invalid','{}'::jsonb);
INSERT INTO private.push_devices(user_id,installation_id,platform,push_token,app_id,app_version)
VALUES(
  '90000000-0000-4000-8000-000000000027','worker-smoke-installation','android',
  'invalid-fcm-token-for-provider-smoke-000000000000000000','com.thalimitra.customer.preview','1.21'
);
SELECT private.enqueue_notification(
  '90000000-0000-4000-8000-000000000027','customer','operational','provider_smoke',
  'Provider smoke','Validates Firebase authorization without contacting a real device.',
  'home','system',NULL,'notification:provider-smoke:20260926',clock_timestamp()+interval '5 minutes'
);
SELECT private.invoke_notification_worker();
