const axios = require('axios');
const supabase = require('./src/services/supabase');

const runTests = async () => {
  console.log('Running End-to-End Test Pipeline...');
  
  // 1. Generic Webhook (Missing data)
  try {
    await axios.post('http://localhost:3001/webhook/order', { name: 'Test' });
    console.log('❌ FAIL: Missing data should have returned 400.');
  } catch (e) {
    if (e.response?.status === 400) console.log('✅ PASS: Invalid Generic Webhook blocked with 400.');
    else console.log('❌ FAIL: Unexpected error for invalid generic webhook:', e.message);
  }

  // 2. Generic Webhook (Valid data)
  let orderId = 'test-' + Date.now();
  try {
    await axios.post('http://localhost:3001/webhook/order', {
      name: 'Test Customer',
      phone: '03001234567',
      order_id: orderId,
      amount: 500
    });
    console.log('✅ PASS: Valid Generic Webhook accepted with 200.');
  } catch (e) {
    console.log('❌ FAIL: Valid generic webhook rejected:', e.message);
  }

  // 3. Supabase DB Check & WhatsApp Trigger check
  console.log('Waiting 3 seconds for async DB insert and WhatsApp API call...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const { data, error } = await supabase.from('orders').select('*').eq('order_id', orderId).single();
  if (error || !data) {
    console.log('❌ FAIL: Order was not found in Supabase.');
  } else {
    console.log('✅ PASS: Order found in Supabase with status:', data.status);
    if (data.message_status === 'sent') {
      console.log('✅ PASS: WhatsApp message triggered and message_status updated to "sent".');
    } else {
      console.log(`❌ FAIL: message_status is "${data.message_status}". WhatsApp might have failed (check Meta dash).`);
    }
  }

  // 4. Dashboard Auth Check
  try {
    await axios.get('http://localhost:3001/dashboard/orders');
    console.log('❌ FAIL: Unauthenticated dashboard access succeeded.');
  } catch (e) {
    if (e.response?.status === 401) console.log('✅ PASS: Dashboard auth enforced (401).');
    else console.log('❌ FAIL: Unexpected error for unauth dashboard access.');
  }
  
  process.exit(0);
};

runTests();
