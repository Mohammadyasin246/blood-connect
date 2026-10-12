const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin Protected Routes
router.get('/stats', authenticate, authorize('admin'), adminController.getDashboardStats);
router.get('/users', authenticate, authorize('admin'), adminController.getUsers);
router.patch('/users/:id/status', authenticate, authorize('admin'), adminController.toggleUserStatus);
router.patch('/donors/:id/verify', authenticate, authorize('admin'), adminController.toggleDonorVerification);
router.get('/hospitals', adminController.getHospitals);
router.post('/hospitals', authenticate, authorize('admin'), adminController.addHospital);

module.exports = router;
