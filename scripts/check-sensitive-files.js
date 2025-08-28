const { execSync } = require('child_process');
const path = require('path');

const forbidden = ['firebase-config.js', 'firebase-debug.log', 'firestore-debug.log'];

function changedFiles() {
  // list files in the commit range for CI (GITHUB_EVENT_BEFORE/AFTER) not used locally
  try {
    const out = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean);
  } catch (err) {
    // fallback to staged
    const out = execSync('git diff --name-only --staged', { encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean);
  }
}

const changed = changedFiles();
const bad = changed.filter(f => forbidden.includes(path.basename(f)));
if (bad.length) {
  console.error('ERROR: sensitive files detected in changes:', bad.join(', '));
  process.exit(2);
}
console.log('No sensitive files detected.');
process.exit(0);
