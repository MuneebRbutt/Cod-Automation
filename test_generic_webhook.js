const http = require('http');

const sendRequest = (payload) => {
  return new Promise((resolve, reject) => {
    const rawBody = JSON.stringify(payload);
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/webhook/order',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(rawBody)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.on('error', (e) => reject(e));
    req.write(rawBody);
    req.end();
  });
};

const runTests = async () => {
  try {
    console.log('Test 1: Missing required fields');
    const res1 = await sendRequest({ name: "John" });
    console.log(`Status: ${res1.status}, Data: ${res1.data}`);

    console.log('\nTest 2: Invalid phone format');
    const res2 = await sendRequest({ 
      name: "John", phone: "123", order_id: "ORD-123", amount: 100 
    });
    console.log(`Status: ${res2.status}, Data: ${res2.data}`);

    console.log('\nTest 3: Success case');
    const res3 = await sendRequest({ 
      name: "John", 
      phone: "03001234567", 
      order_id: "ORD-123", 
      amount: 100,
      business_id: "custom_shop",
      language: "ur"
    });
    console.log(`Status: ${res3.status}, Data: ${res3.data}`);

  } catch (err) {
    console.error('Test failed:', err);
  }
};

runTests();
