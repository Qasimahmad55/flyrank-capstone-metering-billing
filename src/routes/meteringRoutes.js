const express = require('express');
const router = express.Router();
const meteringController = require('../controllers/meteringController');

router.post('/generate', meteringController.generate);

module.exports = router;
