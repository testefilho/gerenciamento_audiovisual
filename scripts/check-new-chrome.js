const fs = require('fs');
const path = 'C:\\Program Files\\Google\\Chrome\\Application\\new_chrome.exe';
console.log(fs.existsSync(path) ? 'FOUND' : 'NOTFOUND');
