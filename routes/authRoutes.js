const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validationMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { catchAsync } = require('../middleware/errorMiddleware');

// Register routes
router
  .route('/register')
  .get(authController.renderRegister)
  .post(validateRegister, catchAsync(authController.register));

// Login routes
router
  .route('/login')
  .get(authController.renderLogin)
  .post(validateLogin, catchAsync(authController.login));

// Logout routes (supports both POST form and GET link)
router.route('/logout').post(authController.logout).get(authController.logout);

// Current user profile route
router.get('/me', requireAuth, authController.getMe);

// Host-only verification route
router.get('/host-only', requireAuth, requireRole('host'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome to host portal' });
});

module.exports = router;
