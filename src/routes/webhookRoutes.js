const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// POST /webhook/shopify
router.post('/shopify', webhookController.handleShopifyWebhook);

module.exports = router;
