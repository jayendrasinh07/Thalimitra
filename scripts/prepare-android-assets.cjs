const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
for (const relativePath of ['dist/ops', 'android/app/src/main/assets/public/ops']) {
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(root + path.sep)) throw new Error(`Unexpected asset path: ${relativePath}`);
  fs.rmSync(target, { recursive: true, force: true });
}

console.log('Customer Android assets prepared without Operations build.');
