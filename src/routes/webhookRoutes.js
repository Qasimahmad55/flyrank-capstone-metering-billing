const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Stripe requires the raw body to verify signatures. 
// We use express.raw({type: 'application/json'}) specifically for this route.
router.post('/stripe', express.raw({ type: 'application/json' }), webhookController.handleStripeWebhook);

module.exports = router;
