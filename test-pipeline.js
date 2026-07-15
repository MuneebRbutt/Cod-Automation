require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');
const supabase = require('./src/services/supabase');

const runTests = async () => {
  console.log('Running End-to-End Test Pipeline...\n');
  
  // 1. WooCommerce Webhook test
  let wooOrderId = 'woo-' + Date.now();
  try {
    const wooSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || 'my_test_secret_123';
    const wooPayload = {
      id: wooOrderId,
      total: '120.50',
      billing: {
        first_name: 'Woo',
        last_name: 'Tester',
        phone: '03001112222'
      }
    };
    
    // Create exact HMAC SHA256 Signature WooCommerce uses
    const payloadString = JSON.stringify(wooPayload);
    const signature = crypto.createHmac('sha256', wooSecret).update(payloadString, 'utf8').digest('base64');
    
    await axios.post('http://localhost:3001/webhook/woocommerce', payloadString, {
      headers: {
        'x-wc-webhook-signature': signature,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ PASS: Valid WooCommerce Webhook accepted with 200.');
  } catch (e) {
    console.log('❌ FAIL: Valid WooCommerce webhook rejected:', e.response?.data || e.message);
  }

  // 2. Generic Webhook (Missing data)
  try {
    await axios.post('http://localhost:3001/webhook/order', { name: 'Test' });
    console.log('❌ FAIL: Missing data should have returned 400.');
  } catch (e) {
    if (e.response?.status === 400) console.log('✅ PASS: Invalid Generic Webhook blocked with 400.');
    else console.log('❌ FAIL: Unexpected error for invalid generic webhook:', e.message);
  }

  // 3. Generic Webhook (Valid data)
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

  // 4. Supabase DB Check
  console.log('\nWaiting 3 seconds for async DB inserts and WhatsApp API calls...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check Woo Order
  const { data: wooData } = await supabase.from('orders').select('*').eq('order_id', wooOrderId).single();
  if (!wooData) {
    console.log('❌ FAIL: WooCommerce Order was not found in Supabase.');
  } else {
    console.log(`✅ PASS: WooCommerce Order found in Supabase! (Name: ${wooData.customer_name}, Phone: ${wooData.phone_number}, Amount: ${wooData.total_amount})`);
  }

  // Check Generic Order
  const { data, error } = await supabase.from('orders').select('*').eq('order_id', orderId).single();
  if (error || !data) {
    console.log('❌ FAIL: Generic Order was not found in Supabase.');
  } else {
    console.log('✅ PASS: Generic Order found in Supabase with status:', data.status);
    if (data.message_status === 'sent') {
      console.log('✅ PASS: WhatsApp message triggered and message_status updated to "sent".');
    } else {
      console.log(`❌ FAIL: message_status is "${data.message_status}". WhatsApp might have failed (check Meta dash).`);
    }
  }

  console.log('\nEnd of tests!');
  process.exit(0);
};

runTests();
