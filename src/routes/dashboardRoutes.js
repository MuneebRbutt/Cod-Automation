const express = require('express');
const router = express.Router();
const path = require('path');
const dashboardController = require('../controllers/dashboardController');

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/dashboard.html'));
});

router.get('/orders', dashboardController.getOrders);

module.exports = router;
