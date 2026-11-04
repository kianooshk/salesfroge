const fs = require('fs');
const path = require('path');

const candidates = [
  path.resolve(__dirname, '../node_modules/@salesforce-ux/design-system/assets'),
  path.resolve(__dirname, '../../node_modules/@salesforce-ux/design-system/assets'),
];
const source = candidates.find((dir) => fs.existsSync(dir));
if (!source) {
  console.warn('SLDS assets not found yet; skipping copy.');
  process.exit(0);
}
const dest = path.resolve(__dirname, '../public/slds');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(source, dest, { recursive: true });
console.log('Copied SLDS assets to public/slds');
