const axios = require('axios');
const supabase = require('./supabase');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const sendWhatsAppMessage = async (to, type, content, orderId = null) => {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error("Missing WHATSAPP_TOKEN or PHONE_NUMBER_ID environment variables.");
    return false;
  }

  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: type,
    ...content
  };

  const config = {
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await axios.post(url, data, config);
    console.log(`✅ WhatsApp ${type} message sent to ${to}.`);
    
    // Extract message ID from Meta response
    const waMessageId = response.data?.messages?.[0]?.id;

    // Update database status if orderId provided
    if (orderId && waMessageId) {
      const { error } = await supabase
        .from('orders')
        .update({ 
          message_status: 'sent', 
          wa_message_id: waMessageId 
        })
        .eq('order_id', orderId);
        
      if (error) {
        console.error(`Failed to update message_status for order ${orderId}:`, error.message);
      }
    }
    return true;
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp message to ${to}.`);
    
    if (orderId) {
      await supabase
        .from('orders')
        .update({ message_status: 'failed' })
        .eq('order_id', orderId);
    }

    if (error.response) {
      console.error("Meta API Error:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Request Error:", error.message);
    }
    return false;
  }
};

const sendTemplateMessage = async (to, templateName, orderId = null) => {
  const content = {
    template: {
      name: templateName,
      language: { code: "en_US" }
    }
  };
  return await sendWhatsAppMessage(to, 'template', content, orderId);
};

const sendTextMessage = async (to, text, orderId = null) => {
  const content = {
    text: { body: text }
  };
  return await sendWhatsAppMessage(to, 'text', content, orderId);
};

module.exports = {
  sendTemplateMessage,
  sendTextMessage
};
