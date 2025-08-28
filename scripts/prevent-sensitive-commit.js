const fs = require('fs');
const path = require('path');

const forbidden = ['firebase-config.js', 'firebase-debug.log', 'firestore-debug.log'];

function stagedFiles() {
  const { execSync } = require('child_process');
  const out = execSync('git diff --name-only --staged', { encoding: 'utf8' });
  return out.split(/\r?\n/).filter(Boolean);
}

const staged = stagedFiles();
const bad = staged.filter(f => forbidden.includes(path.basename(f)));
if (bad.length) {
  console.error('Commit blocked: arquivos sensíveis detectados na staged area:', bad.join(', '));
  console.error('Remova-os do índice (`git rm --cached <file>`) ou atualize seu .gitignore.');
  process.exit(1);
}
process.exit(0);
