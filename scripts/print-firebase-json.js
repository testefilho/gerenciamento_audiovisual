const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'firebase.json');
const txt = fs.readFileSync(file, 'utf8');
console.log(txt);
