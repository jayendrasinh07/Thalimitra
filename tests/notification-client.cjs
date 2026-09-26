const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const read = file => readFileSync(file, 'utf8');

const service = read('src/services/notificationService.ts');
const page = read('src/pages/NotificationsPage.tsx');
const bridge = read('src/components/notifications/PushNotificationBridge.tsx');
const migration = read('supabase/migrations/20260926100000_push_notifications_foundation.sql');
const worker = read('supabase/functions/push-notification-worker/index.ts');
const gradle = read('android/app/build.gradle');

for (const rpc of ['register_push_device', 'unregister_push_device', 'get_notification_center', 'mark_notification_read', 'update_notification_preferences']) {
  assert.match(service, new RegExp(`['\"]${rpc}['\"]`));
}
assert.match(service, /PushNotifications\.requestPermissions/);
assert.match(service, /PushNotifications\.register/);
assert.match(service, /pushNotificationActionPerformed/);
assert.match(bridge, /targetKey/);
assert.match(page, /Enable phone notifications/);
assert.match(page, /Order and payment updates stay on/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON private\.push_devices/);
assert.doesNotMatch(service, /from\(['\"]push_devices/);
assert.match(worker, /firebase\.messaging/);
assert.match(worker, /x-worker-key/);
assert.match(gradle, /versionCode 22/);
assert.match(gradle, /versionName "1\.21"/);
console.log('PASS: private push tokens, owner inbox, Android permission/action routing, and worker authorization');
