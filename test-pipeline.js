require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RECIPIENT_NUMBER = process.env.RECIPIENT_NUMBER || '923132471870';
const SERVER_URL = 'http://127.0.0.1:3001';

// Setup Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// State
const testOrderId = `TEST-${Date.now()}`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  console.log('🚀 Starting end-to-end order pipeline test...\n');
  let step = 1;

  try {
    // ==========================================
    // STEP 1: POST a fake order to /webhook/order
    // ==========================================
    console.log(`[Step ${step++}] POSTing fake order to /webhook/order...`);
    const orderPayload = {
      name: "Pipeline Test User",
      phone: RECIPIENT_NUMBER,
      order_id: testOrderId,
      amount: 999,
      business_id: "biz_test",
      language: "en"
    };

    const orderRes = await axios.post(`${SERVER_URL}/webhook/order`, orderPayload);
    if (orderRes.status === 200) {
      console.log('✅ PASS: Order webhook returned 200 OK.\n');
    } else {
      throw new Error(`Unexpected status code: ${orderRes.status}`);
    }

    // Wait for async processing (DB insert + WhatsApp call)
    await sleep(2500);

    // ==========================================
    // STEP 2: Confirm row created with status "pending"
    // ==========================================
    console.log(`[Step ${step++}] Querying Supabase for order ${testOrderId}...`);
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', testOrderId);

    if (fetchError) throw new Error(`Supabase query failed: ${fetchError.message}`);
    if (!orders || orders.length === 0) throw new Error('Order not found in Supabase.');
    
    const order = orders[0];

    if (order.status === 'pending') {
      console.log('✅ PASS: Order found in Supabase with status "pending".\n');
    } else {
      throw new Error(`Order status is ${order.status}, expected "pending".`);
    }

    // ==========================================
    // STEP 3: Confirm message_status is "sent"
    // ==========================================
    console.log(`[Step ${step++}] Checking if message_status is "sent"...`);
    if (order.message_status === 'sent') {
      console.log('✅ PASS: message_status is "sent".\n');
    } else {
      throw new Error(`message_status is "${order.message_status}", expected "sent".\n💡 (Note: If this says "failed", it means WhatsApp blocked the message. This is expected if your template is still "In Review").`);
    }

    // ==========================================
    // STEP 4: Simulate an incoming WhatsApp "YES" reply
    // ==========================================
    console.log(`[Step ${step++}] Simulating incoming WhatsApp "YES" reply...`);
    const whatsappPayload = {
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: RECIPIENT_NUMBER,
              text: { body: "YES" }
            }]
          }
        }]
      }]
    };

    const waRes = await axios.post(`${SERVER_URL}/webhook/whatsapp`, whatsappPayload);
    if (waRes.status === 200) {
      console.log('✅ PASS: WhatsApp webhook returned 200 OK.\n');
    } else {
      throw new Error(`Unexpected status code: ${waRes.status}`);
    }

    // Wait for async database update
    await sleep(2000);

    // ==========================================
    // STEP 5: Confirm status updated to "confirmed"
    // ==========================================
    console.log(`[Step ${step++}] Querying Supabase to confirm status update...`);
    const { data: finalOrders, error: finalError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', testOrderId);

    if (finalError) throw new Error(`Supabase query failed: ${finalError.message}`);
    
    const finalOrder = finalOrders[0];
    if (finalOrder.status === 'confirmed') {
      console.log('✅ PASS: Order status successfully updated to "confirmed".\n');
    } else {
      throw new Error(`Order status is "${finalOrder.status}", expected "confirmed".`);
    }

    console.log('🎉 ALL 5 PIPELINE TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ FAIL at Step ${step - 1}:`, error.message);
    if (error.response) {
      console.error('Response details:', error.response.data);
    }
    console.error('\nTest pipeline aborted.');
    process.exit(1);
  }
}

runTests();
