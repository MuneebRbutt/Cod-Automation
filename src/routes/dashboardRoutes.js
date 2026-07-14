const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/orders', dashboardController.getOrders);

module.exports = router;
