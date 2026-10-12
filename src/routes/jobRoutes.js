const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

router.post('/reconcile', jobController.runReconciliation);

module.exports = router;
