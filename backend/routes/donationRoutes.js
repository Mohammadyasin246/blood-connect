const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, donationController.getDonations);
router.get('/certificate/:certId', donationController.getCertificate);

module.exports = router;
