const crypto = require('crypto');
const supabase = require('../services/supabase');

const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  // Remove all non-numeric characters except '+'
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it doesn't start with a '+', assume it's a local Pakistani number or missing country code
  if (!cleaned.startsWith('+')) {
    // If it starts with '0', remove the '0' and prepend '+92'
    if (cleaned.startsWith('0')) {
      cleaned = '+92' + cleaned.substring(1);
    } else {
      // If it doesn't start with '0', just prepend '+92' assuming it's already missing the 0
      cleaned = '+92' + cleaned;
    }
  }
  return cleaned;
};

const handleShopifyWebhook = async (req, res) => {
  console.log('--- Incoming Shopify Webhook ---');
  
  // 1. Verify Request Authenticity (HMAC-SHA256)
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!hmacHeader || !secret) {
    console.error('Missing HMAC header or SHOPIFY_WEBHOOK_SECRET in environment.');
    return res.status(401).send('Unauthorized');
  }

  // The rawBody was captured in our express.json verify function (server.js)
  const rawBody = req.rawBody;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  if (hash !== hmacHeader) {
    console.error('HMAC verification failed! Payload signature does not match.');
    return res.status(401).send('Unauthorized');
  }

  // 2. Return 200 response immediately to avoid Shopify retries
  res.status(200).send('Webhook received and verified');

  // 3. Process payload asynchronously
  try {
    const payload = req.body;
    
    // Log every incoming payload for debugging
    console.log('Verified Webhook Payload:', JSON.stringify(payload, null, 2));

    // Extract necessary data
    const orderId = payload.id ? payload.id.toString() : null;
    const totalAmount = payload.total_price || payload.current_total_price || null;
    
    // Extract customer details robustly
    let customerName = null;
    let phone = null;
    
    if (payload.customer) {
      customerName = `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim();
      phone = payload.customer.phone || payload.customer.default_address?.phone;
    }
    
    // Fallbacks if phone or name is missing in customer object
    if (!phone && payload.billing_address) {
      phone = payload.billing_address.phone;
      if (!customerName) {
        customerName = `${payload.billing_address.first_name || ''} ${payload.billing_address.last_name || ''}`.trim();
      }
    }
    if (!phone && payload.shipping_address) {
      phone = payload.shipping_address.phone;
    }

    const formattedPhone = formatPhoneNumber(phone);
    const businessId = req.query.business_id || req.get('x-business-id') || null;

    // 4. Insert into Supabase "orders" table
    if (orderId) {
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          order_id: orderId,
          customer_name: customerName || 'Unknown Customer',
          phone_number: formattedPhone,
          total_amount: totalAmount,
          status: 'pending',
          business_id: businessId
        }]);

      if (error) {
        console.error(`Error inserting order ${orderId} into Supabase:`, error.message);
      } else {
        console.log(`✅ Successfully inserted order ${orderId} into Supabase as pending.`);
      }
    } else {
      console.warn('Webhook payload missing an order ID, skipped DB insertion.');
    }
  } catch (error) {
    console.error('Unexpected error processing Shopify webhook:', error);
  }
};

module.exports = {
  handleShopifyWebhook
};
