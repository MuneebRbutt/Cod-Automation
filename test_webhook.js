const crypto = require('crypto');
const http = require('http');

const secret = 'test_secret';
const payload = {
  id: 12345,
  total: "500.00",
  billing: {
    first_name: "John",
    last_name: "Doe",
    phone: "03001234567"
  },
  line_items: [
    { name: "Product A", quantity: 1 }
  ]
};

const rawBody = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/webhook/woocommerce',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-wc-webhook-signature': signature,
    'Content-Length': Buffer.byteLength(rawBody)
  }
};

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
