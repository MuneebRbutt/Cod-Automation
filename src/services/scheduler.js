const cron = require('node-cron');
const supabase = require('./supabase');
const whatsappService = require('./whatsappService');

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '* * * * *';
const RETRY_INTERVAL_HOURS = parseFloat(process.env.RETRY_INTERVAL_HOURS || '1');

// Setup retry task
const startScheduler = () => {
  console.log(`⏰ Scheduler initialized. Running on cron: ${CRON_SCHEDULE}`);
  
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      // Calculate the cutoff time
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - (RETRY_INTERVAL_HOURS * 60));
      const cutoffIso = cutoffTime.toISOString();

      // Find pending orders where message_status is sent, older than cutoff
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .eq('message_status', 'sent')
        .lt('created_at', cutoffIso);

      if (error) {
        console.error('Scheduler Supabase Error:', error.message);
        return;
      }

      for (const order of orders) {
        if (order.retry_count === 0) {
          console.log(`[Action] Retrying order ${order.order_id}...`);
          // Send reminder
          const sent = await whatsappService.sendTextMessage(order.phone_number, `Hi ${order.customer_name}, we are still waiting for your confirmation on order #${order.order_id}. Please reply with YES to confirm.`);
          if (sent) {
            await supabase
              .from('orders')
              .update({ retry_count: 1 })
              .eq('id', order.id);
          }
        } else if (order.retry_count >= 1) {
          console.log(`[Action] Marking order ${order.order_id} as unconfirmed_manual...`);
          // Flip to unconfirmed_manual
          await supabase
            .from('orders')
            .update({ status: 'unconfirmed_manual' })
            .eq('id', order.id);
        }
      }
    } catch (err) {
      console.error('Scheduler Exception:', err);
    }
  });
};

module.exports = { startScheduler };
