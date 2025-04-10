const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, rateLimit } = require('../middleware/auth');

// Public routes
router.post('/login', rateLimit('login', 5, 5 * 60 * 1000), authController.login);
router.post('/request-password-reset', rateLimit('passwordReset', 3, 60 * 60 * 1000), authController.requestPasswordReset);
router.post('/reset-password', rateLimit('confirmReset', 3, 60 * 60 * 1000), authController.resetPassword);

// Protected routes
router.use(authenticate);
router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.post('/refresh-token', authController.refreshToken);
router.post('/update-password', authController.updatePassword);

module.exports = router;