const supabase = require('./src/services/supabase');

const runRetryTest = async () => {
  console.log('Running Retry Logic Test...');
  
  // 1. Create a dummy old order
  let orderId = 'test-retry-' + Date.now();
  
  // Force created_at to be 2 hours ago
  const oldDate = new Date();
  oldDate.setHours(oldDate.getHours() - 2);
  
  const { error } = await supabase.from('orders').insert([{
    order_id: orderId,
    customer_name: 'Retry Tester',
    phone_number: '+923001234567',
    total_amount: 100,
    status: 'pending',
    message_status: 'sent',
    retry_count: 0,
    created_at: oldDate.toISOString()
  }]);

  if (error) {
    console.log('❌ FAIL: Could not insert old test order:', error.message);
    return process.exit(1);
  }
  console.log('✅ PASS: Inserted artificially aged order:', orderId);
  console.log('Waiting 65 seconds for the cron job to pick it up (make sure CRON_SCHEDULE="* * * * *" and server is running)...');
  
  // Wait 65s (since cron runs every minute)
  for (let i = 0; i < 65; i++) {
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\nChecking DB...');

  const { data } = await supabase.from('orders').select('*').eq('order_id', orderId).single();
  if (data && data.retry_count === 1) {
    console.log('✅ PASS: Cron scheduler detected old order, sent retry, and updated retry_count to 1.');
  } else {
    console.log('❌ FAIL: Order retry_count did not update. Is the server running?');
  }

  process.exit(0);
};

runRetryTest();
