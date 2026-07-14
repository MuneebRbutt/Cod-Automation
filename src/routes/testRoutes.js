const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.get('/health', testController.checkHealth);
router.get('/test-db', testController.testDatabase);

module.exports = router;
