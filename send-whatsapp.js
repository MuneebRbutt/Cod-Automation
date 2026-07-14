require('dotenv').config();
const axios = require('axios');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const RECIPIENT_NUMBER = process.env.RECIPIENT_NUMBER;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID || !RECIPIENT_NUMBER) {
  console.error("Error: Missing required environment variables.");
  console.error("Please ensure WHATSAPP_TOKEN, PHONE_NUMBER_ID, and RECIPIENT_NUMBER are set.");
  process.exit(1);
}

async function sendWhatsAppTemplate() {
  // Using Graph API version v20.0 (update if needed)
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  const data = {
    messaging_product: "whatsapp",
    to: RECIPIENT_NUMBER,
    type: "template",
    template: {
      name: "hello_world",
      language: {
        code: "en_US"
      }
    }
  };

  const config = {
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    console.log(`Attempting to send 'hello_world' template to ${RECIPIENT_NUMBER}...`);
    const response = await axios.post(url, data, config);
    
    console.log("✅ Message sent successfully!");
    console.log("API Response:", JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error("❌ Failed to send message.");
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const errorData = error.response.data;
      
      console.error(`Status Code: ${status}`);
      console.error("Error Response:", JSON.stringify(errorData, null, 2));

      // Handle specific error cases
      const errorMessage = errorData.error?.message || "";
      const errorCode = errorData.error?.code;
      const errorSubcode = errorData.error?.error_subcode;

      if (status === 401 || errorCode === 190) {
        console.error("Reason: Invalid or expired WHATSAPP_TOKEN.");
      } else if (errorCode === 131030) {
        console.error("Reason: Invalid RECIPIENT_NUMBER (e.g., number not registered or incorrect format).");
      } else if (status === 400 && errorMessage.toLowerCase().includes("template")) {
        console.error("Reason: Template not found or not approved.");
      } else if (errorSubcode === 131009) {
          console.error("Reason: Parameter format is invalid.");
      } else {
        console.error("Reason: See error details above.");
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error("No response received from Meta API. Check your internet connection.");
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Request Setup Error:", error.message);
    }
  }
}

sendWhatsAppTemplate();
