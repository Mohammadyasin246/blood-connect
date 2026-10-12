const express = require('express');
const router = express.Router();
const donorController = require('../controllers/donorController');
const { authenticate } = require('../middleware/auth');

router.get('/search', donorController.searchDonors);
router.get('/nearby', donorController.getNearbyDonors);
router.get('/', donorController.getAllDonors);
router.patch('/availability', authenticate, donorController.toggleAvailability);
router.put('/profile', authenticate, donorController.updateDonorProfile);
router.get('/dashboard-stats', authenticate, donorController.getDonorDashboardStats);

module.exports = router;
