const express = require('express');
const router = express.Router();
const meteringController = require('../controllers/meteringController');

// Support both POST / and POST /generate
router.post('/', meteringController.generate);
router.post('/generate', meteringController.generate);

module.exports = router;
