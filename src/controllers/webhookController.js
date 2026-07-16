const crypto = require('crypto');
const supabase = require('../services/supabase');
const whatsappService = require('../services/whatsappService');

// Format phone to E.164
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+92' + cleaned.substring(1);
    } else if (cleaned.startsWith('92')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+92' + cleaned;
    }
  }
  return cleaned;
};

// DB Insert & WhatsApp Trigger Wrapper (Phases 3 & 4)
const processOrderInsert = async (orderData) => {
  const { language, ...dbOrderData } = orderData;
  const { data, error } = await supabase
    .from('orders')
    .insert([{
      ...dbOrderData,
      status: 'pending',
      message_status: 'pending',
      clarification_sent: false,
      retry_count: 0
    }]);

  if (error) {
    console.error(`Error inserting order ${orderData.order_id}:`, error.message);
    return;
  }
  
  console.log(`✅ Successfully inserted order ${orderData.order_id} into Supabase.`);
  
  // Trigger Outbound WhatsApp asynchronously
  try {
    whatsappService.sendConfirmationMessage(orderData).catch(err => {
      console.error(`Error in async sendConfirmationMessage for order ${orderData.order_id}:`, err);
    });
  } catch (err) {
    console.error(`Failed to initiate WhatsApp confirmation for order ${orderData.order_id}:`, err);
  }
};

// Phase 3: Shopify Webhook
const handleShopifyWebhook = async (req, res) => {
  console.log('--- Incoming Shopify Webhook ---');
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!hmacHeader || !secret) return res.status(401).send('Unauthorized');
  
  const hash = crypto.createHmac('sha256', secret).update(req.rawBody || '', 'utf8').digest('base64');
  if (hash !== hmacHeader) return res.status(401).send('Unauthorized');

  res.status(200).send('Webhook received');

  try {
    const payload = req.body;
    const orderId = payload.id ? payload.id.toString() : null;
    if (!orderId) return;

    const totalAmount = payload.total_price || payload.current_total_price || null;
    let customerName = payload.customer ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim() : null;
    let phone = payload.customer?.phone || payload.customer?.default_address?.phone;
    
    if (!phone && payload.billing_address) {
      phone = payload.billing_address.phone;
      if (!customerName) customerName = `${payload.billing_address.first_name || ''} ${payload.billing_address.last_name || ''}`.trim();
    }
    
    await processOrderInsert({
      order_id: orderId,
      customer_name: customerName || 'Unknown Customer',
      phone_number: formatPhoneNumber(phone),
      total_amount: totalAmount,
      business_id: req.query.business_id || req.get('x-business-id') || 'shopify'
    });
  } catch (err) {
    console.error('Shopify Processing Error:', err);
  }
};

// Phase 3: WooCommerce Webhook
const handleWooCommerceWebhook = async (req, res) => {
  console.log('--- Incoming WooCommerce Webhook ---');
  const signature = req.get('x-wc-webhook-signature');
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;

  console.log('WooCommerce Signature received:', signature);
  console.log('Secret used:', secret);
  console.log('req.rawBody exists?', !!req.rawBody);

  if (!signature || !secret) return res.status(401).send('Unauthorized');

  const hash = crypto.createHmac('sha256', secret).update(req.rawBody || '', 'utf8').digest('base64');
  console.log('Generated hash:', hash);
  if (hash !== signature) return res.status(401).send('Unauthorized');

  res.status(200).send('Webhook received');

  try {
    const payload = req.body;
    console.log(`WooCommerce Payload Received for Order ID: ${payload.id}`);
    console.log(JSON.stringify(payload, null, 2));
    
    const orderId = payload.id ? payload.id.toString() : null;
    if (!orderId) return;

    const totalAmount = payload.total;
    const customerName = `${payload.billing?.first_name || ''} ${payload.billing?.last_name || ''}`.trim();
    const phone = payload.billing?.phone;

    await processOrderInsert({
      order_id: orderId,
      customer_name: customerName || 'Unknown Customer',
      phone_number: formatPhoneNumber(phone),
      total_amount: totalAmount,
      business_id: req.query.business_id || req.get('x-business-id') || 'woocommerce'
    });
  } catch (err) {
    console.error('WooCommerce Processing Error:', err);
  }
};

// Phase 3: Generic Endpoint
const handleGenericWebhook = async (req, res) => {
  console.log('--- Incoming Generic Webhook ---');
  const { name, phone, order_id, amount, business_id, language } = req.body;

  if (!name || !phone || !order_id || amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, phone, order_id, amount' });
  }

  const formattedPhone = formatPhoneNumber(phone);
  const phoneRegex = /^\+[1-9]\d{7,14}$/;
  if (!formattedPhone || !phoneRegex.test(formattedPhone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  res.status(200).json({ status: 'success', message: 'Order received', order_id });

  try {
    await processOrderInsert({
      order_id: order_id.toString(),
      customer_name: name,
      phone_number: formattedPhone,
      total_amount: amount,
      business_id: business_id || req.query.business_id || req.get('x-business-id') || 'generic',
      language: language || 'en'
    });
  } catch (err) {
    console.error('Generic Processing Error:', err);
  }
};

// Phase 5: Verify WhatsApp Webhook Handshake
const verifyWhatsAppWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

// Phase 5: Handle Incoming WhatsApp Message (Replies)
const handleWhatsAppIncoming = async (req, res) => {
  res.status(200).send('EVENT_RECEIVED'); // Acknowledge Meta immediately

  try {
    const body = req.body;
    
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const msg = messages[0];
        const from = msg.from; // Sender phone number
        const textObj = msg.text;
        
        if (textObj && textObj.body) {
          const incomingText = textObj.body.trim().toLowerCase();
          console.log(`📩 Incoming message from ${from}: "${incomingText}"`);

          const formattedPhone = `+${from.replace(/[^\d]/g, '')}`;

          // Find the most recent pending order for this number
          const { data: orders, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('phone_number', formattedPhone)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);

          if (fetchError || !orders || orders.length === 0) {
            console.log(`No pending orders found for phone ${formattedPhone}. Ignoring message.`);
            return;
          }

          const order = orders[0];
          
          const confirmVariants = ['yes', 'y', 'confirm', 'haan', 'han', 'ji han', 'ji haan'];
          const cancelVariants = ['no', 'n', 'cancel', 'nahi', 'nahin'];

          if (confirmVariants.includes(incomingText)) {
            await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id);
            
            let confirmText = `Thank you! Your order #${order.order_id} is now CONFIRMED.`;
            if (order.language === 'ur' || order.language === 'roman_ur') {
              confirmText = `Shukriya! Aap ka order #${order.order_id} CONFIRM ho gaya hai.`;
            }
            await whatsappService.sendTextMessage(from, confirmText, order.order_id);
            
          } else if (cancelVariants.includes(incomingText)) {
            await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
            
            let cancelText = `Understood. Your order #${order.order_id} has been CANCELLED.`;
            if (order.language === 'ur' || order.language === 'roman_ur') {
              cancelText = `Theek hai. Aap ka order #${order.order_id} CANCEL kar diya gaya hai.`;
            }
            await whatsappService.sendTextMessage(from, cancelText, order.order_id);
            
          } else {
            // Handle nonsense reply
            if (!order.clarification_sent) {
              await supabase.from('orders').update({ clarification_sent: true }).eq('id', order.id);
              
              let clarificationText = "I'm sorry, I didn't understand. Please reply with YES to confirm or NO to cancel.";
              if (order.language === 'ur' || order.language === 'roman_ur') {
                clarificationText = "Maaf kijiye, main samjha nahi. Baraye meharbani confirm karne ke liye YES ya cancel karne ke liye NO reply karein.";
              }
              await whatsappService.sendTextMessage(from, clarificationText, order.order_id);
            } else {
              console.log(`Clarification already sent for order ${order.order_id}. Ignoring nonsense reply.`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error handling incoming WhatsApp message:', err);
  }
};

module.exports = {
  handleShopifyWebhook,
  handleWooCommerceWebhook,
  handleGenericWebhook,
  verifyWhatsAppWebhook,
  handleWhatsAppIncoming
};
