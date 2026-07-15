const cron = require('node-cron');
const supabase = require('./supabase');
const whatsappService = require('./whatsappService');

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *';
const RETRY_INTERVAL_HOURS = parseFloat(process.env.RETRY_INTERVAL_HOURS || '4');

const startScheduler = () => {
  console.log(`⏰ Retry Scheduler initialized. Running on cron: ${CRON_SCHEDULE} (Interval: ${RETRY_INTERVAL_HOURS}h)`);
  
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - (RETRY_INTERVAL_HOURS * 60 * 60 * 1000));
      const cutoffIso = cutoffTime.toISOString();

      // Query 1: Find pending orders with retry_count < 1 and created_at < cutoff
      const { data: retryOrders, error: retryError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .lt('retry_count', 1)
        .lt('created_at', cutoffIso);

      if (retryError) {
        console.error('RetryScheduler Supabase Error (Query 1):', retryError.message);
      } else {
        for (const order of retryOrders) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [Action] Retrying order ${order.order_id}`);
          
          // Call the confirmation message service again
          await whatsappService.sendConfirmationMessage(order);
          
          // Increment retry_count and set updated_at
          await supabase
            .from('orders')
            .update({ 
              retry_count: 1,
              updated_at: timestamp
            })
            .eq('id', order.id);
        }
      }

      // Query 2: Find pending orders with retry_count = 1 and updated_at < cutoff
      const { data: manualOrders, error: manualError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .eq('retry_count', 1)
        .lt('updated_at', cutoffIso);

      if (manualError) {
        console.error('RetryScheduler Supabase Error (Query 2):', manualError.message);
      } else {
        for (const order of manualOrders) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [Action] Marking order ${order.order_id} as unconfirmed_manual`);
          
          // Flip status to unconfirmed_manual
          await supabase
            .from('orders')
            .update({ 
              status: 'unconfirmed_manual',
              updated_at: timestamp
            })
            .eq('id', order.id);
        }
      }
    } catch (err) {
      console.error('RetryScheduler Exception:', err);
    }
  });
};

module.exports = { startScheduler };
