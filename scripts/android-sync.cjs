const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const customerEnv = { ...process.env, VITE_CUSTOMER_EMAIL_OTP_ENABLED: 'true' };

for (const [script, args, env] of [
  ['node_modules/vite/bin/vite.js', ['build', '--configLoader', 'runner'], customerEnv],
  ['scripts/prepare-android-assets.cjs', [], customerEnv],
  ['node_modules/@capacitor/cli/bin/capacitor', ['sync', 'android'], customerEnv],
]) {
  const result = spawnSync(node, [path.join(root, script), ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
