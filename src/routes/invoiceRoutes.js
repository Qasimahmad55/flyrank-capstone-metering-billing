const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.get('/current', invoiceController.getInvoice);

module.exports = router;
