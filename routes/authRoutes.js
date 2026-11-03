const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validationMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { catchAsync } = require('../middleware/errorMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

// Register routes (stricter Redis rate limit on registration attempts)
router
  .route('/register')
  .get(authController.renderRegister)
  .post(authLimiter, validateRegister, catchAsync(authController.register));

// Login routes (stricter Redis rate limit on login attempts to prevent brute-force)
router
  .route('/login')
  .get(authController.renderLogin)
  .post(authLimiter, validateLogin, catchAsync(authController.login));

// Logout routes (supports both POST form and GET link)
router.route('/logout').post(authController.logout).get(authController.logout);

// Current user profile API route
router.route('/me')
  .get(requireAuth, authController.getMe)
  .put(requireAuth, catchAsync(authController.updateProfile));

// Profile page & update routes
router.route('/profile')
  .get(requireAuth, catchAsync(authController.renderProfile))
  .post(requireAuth, catchAsync(authController.updateProfile))
  .put(requireAuth, catchAsync(authController.updateProfile));

// Password change routes
router.route('/profile/password')
  .post(requireAuth, catchAsync(authController.updatePassword))
  .put(requireAuth, catchAsync(authController.updatePassword));

router.put('/password', requireAuth, catchAsync(authController.updatePassword));

// Host-only verification route
router.get('/host-only', requireAuth, requireRole('host'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome to host portal' });
});

module.exports = router;
