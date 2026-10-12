const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

router.post('/', optionalAuthenticate, requestController.createRequest);
router.get('/', requestController.getAllRequests);
router.get('/:id', requestController.getRequestById);
router.post('/:id/accept', authenticate, requestController.acceptRequest);
router.post('/:id/decline', authenticate, requestController.declineRequest);
router.post('/:id/complete', authenticate, requestController.completeRequest);

module.exports = router;
