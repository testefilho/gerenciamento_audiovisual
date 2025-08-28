const http = require('http');
http.get('http://127.0.0.1:5500', (res) => {
  console.log('STATUS:' + res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('---HTML SNIPPET---');
    console.log(data.slice(0, 800));
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('REQUEST_FAILED', err.message);
  process.exit(2);
});
