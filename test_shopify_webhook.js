const crypto = require('crypto');
const http = require('http');

const secret = 'shopify_test_secret';

const payload = {
  id: 99998888,
  total_price: "1250.00",
  customer: {
    first_name: "Jane",
    last_name: "Smith",
    phone: "3132471870"
  }
};

const rawBody = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/webhook/shopify',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Hmac-Sha256': signature,
    'Content-Length': Buffer.byteLength(rawBody)
  }
};

console.log('Sending mock Shopify webhook...');

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(rawBody);
req.end();
