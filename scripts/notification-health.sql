select jsonb_build_object(
  'notifications_table',to_regclass('public.notifications') is not null,
  'push_devices_table',to_regclass('private.push_devices') is not null,
  'worker_function',to_regprocedure('private.invoke_notification_worker()') is not null,
  'worker_secret',exists(select 1 from vault.decrypted_secrets where name='notification_worker_key'),
  'cron_jobs',(select count(*) from cron.job where jobname like 'thalimitra-notification-%' or jobname='thalimitra-push-device-cleanup')
) as notification_health;
