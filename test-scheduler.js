require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RECIPIENT_NUMBER = process.env.RECIPIENT_NUMBER || '923132471870';
const SERVER_URL = 'http://127.0.0.1:3001';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const testOrderId = `SCHEDULER-${Date.now()}`;

// We calculate the maximum time we might need to wait for the cron job to fire.
// Interval in hours converted to ms (e.g. 0.02 hours = 72,000 ms)
const intervalHours = parseFloat(process.env.RETRY_INTERVAL_HOURS || '0.02');
const intervalMs = intervalHours * 60 * 60 * 1000;

// The absolute maximum wait time is the interval + the 1 minute cron cycle (60s).
// We add 70 seconds total padding to be perfectly safe.
const waitTimeMs = intervalMs + 70000; 

const sleep = (ms) => {
  console.log(`⏳ Waiting for ${Math.round(ms/1000)} seconds to allow the cron job to trigger...`);
  return new Promise(resolve => setTimeout(resolve, ms));
};

async function runSchedulerTest() {
  console.log('🚀 Starting Background Scheduler Pipeline Test...\n');
  let step = 1;

  try {
    // ==========================================
    // STEP 1: POST a fake order
    // ==========================================
    console.log(`[Step ${step++}] POSTing fake order to /webhook/order...`);
    const orderPayload = {
      name: "Scheduler Test User",
      phone: RECIPIENT_NUMBER,
      order_id: testOrderId,
      amount: 150,
      business_id: "biz_test",
      language: "en"
    };

    const orderRes = await axios.post(`${SERVER_URL}/webhook/order`, orderPayload);
    if (orderRes.status === 200) {
      console.log('✅ PASS: Order webhook returned 200 OK.\n');
    } else {
      throw new Error(`Unexpected status code: ${orderRes.status}`);
    }

    // ==========================================
    // STEP 2: Wait for Phase 1 Retry
    // ==========================================
    console.log(`[Step ${step++}] Waiting for Phase 1 Retry (Expect retry_count to become 1)...`);
    await sleep(waitTimeMs);

    const { data: phase1Orders, error: fetchError1 } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', testOrderId);

    if (fetchError1) throw new Error(`Supabase query failed: ${fetchError1.message}`);
    let order = phase1Orders[0];

    if (order.retry_count >= 1) {
      console.log(`✅ PASS: retry_count is now ${order.retry_count}.\n`);
    } else {
      throw new Error(`Order retry_count is ${order.retry_count}, expected >= 1. The cron job missed it!`);
    }

    // ==========================================
    // STEP 3: Wait for Phase 2 Unconfirmed Manual
    // ==========================================
    console.log(`[Step ${step++}] Waiting for Phase 2 cutoff (Expect status to flip to unconfirmed_manual)...`);
    await sleep(waitTimeMs);

    const { data: phase2Orders, error: fetchError2 } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', testOrderId);

    if (fetchError2) throw new Error(`Supabase query failed: ${fetchError2.message}`);
    order = phase2Orders[0];

    if (order.status === 'unconfirmed_manual') {
      console.log(`✅ PASS: Order status successfully flipped to "unconfirmed_manual".\n`);
    } else {
      throw new Error(`Order status is "${order.status}", expected "unconfirmed_manual". The cron job missed it!`);
    }

    console.log('🎉 ALL SCHEDULER TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ FAIL at Step ${step - 1}:`, error.message);
    console.error('\nScheduler test aborted.');
    process.exit(1);
  }
}

runSchedulerTest();
