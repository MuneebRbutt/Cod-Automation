const axios = require('axios');
const supabase = require('./supabase');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const delay = (ms) => new Promise(res => setTimeout(res, ms));

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

const sendConfirmationMessage = async (order) => {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error("Missing WHATSAPP_TOKEN or PHONE_NUMBER_ID environment variables.");
    return false;
  }

  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  
  const templateNameMap = {
    'en': process.env.WHATSAPP_TEMPLATE_EN || 'order_confirmation_en',
    'ur': process.env.WHATSAPP_TEMPLATE_UR || 'order_confirmation_ur',
    'roman_ur': process.env.WHATSAPP_TEMPLATE_ROMAN_UR || 'order_confirmation_roman_ur'
  };

  const languageCodeMap = {
    'en': 'en_US',
    'ur': 'ur',
    'roman_ur': 'en_US'
  };

  const langKey = order.language || 'en';
  const templateName = templateNameMap[langKey] || templateNameMap['en'];
  const templateLangCode = languageCodeMap[langKey] || 'en_US';

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: order.phone_number,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLangCode },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: order.customer_name || 'Customer' },
            { type: "text", text: order.order_id || 'Unknown' }
          ]
        }
      ]
    }
  };

  const config = {
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    timeout: 5000
  };

  const maxRetries = 2;
  const backoffDelays = [1000, 3000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(url, data, config);
      console.log(`✅ WhatsApp confirmation sent to ${order.phone_number} (Attempt ${attempt + 1}).`);
      
      const waMessageId = response.data?.messages?.[0]?.id;
      
      if (order.order_id) {
        await supabase
          .from('orders')
          .update({ message_status: 'sent', wa_message_id: waMessageId })
          .eq('order_id', order.order_id);
      }
      return true;
    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || !error.response;
      const status = error.response?.status;
      
      console.error(`❌ Attempt ${attempt + 1} failed for ${order.phone_number}.`);
      if (status) {
        console.error("Meta API Error:", JSON.stringify(error.response.data, null, 2));
      } else {
        console.error("Error:", error.message);
      }

      // 4xx errors should not be retried
      if (status && status >= 400 && status < 500) {
        console.error(`Client error (${status}), aborting retries.`);
        break;
      }

      if (attempt < maxRetries) {
        console.log(`Waiting ${backoffDelays[attempt]}ms before retry...`);
        await delay(backoffDelays[attempt]);
      }
    }
  }

  // If all retries failed or a 4xx error occurred
  if (order.order_id) {
    await supabase
      .from('orders')
      .update({ message_status: 'failed' })
      .eq('order_id', order.order_id);
  }
  return false;
};

module.exports = {
  sendTemplateMessage,
  sendTextMessage,
  sendConfirmationMessage
};
