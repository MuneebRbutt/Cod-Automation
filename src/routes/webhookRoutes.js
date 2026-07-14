const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Phase 3 endpoints
router.post('/shopify', webhookController.handleShopifyWebhook);
router.post('/woocommerce', webhookController.handleWooCommerceWebhook);
router.post('/order', webhookController.handleGenericWebhook);

// Phase 5 endpoints
router.get('/whatsapp', webhookController.verifyWhatsAppWebhook);
router.post('/whatsapp', webhookController.handleWhatsAppIncoming);

module.exports = router;
