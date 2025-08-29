const fs = require('fs');
const paths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
let found = null;
for (const p of paths) {
  try { if (fs.existsSync(p)) { found = p; break; } } catch (e) {}
}
if (found) console.log('FOUND:' + found);
else console.log('FOUND:NONE');
