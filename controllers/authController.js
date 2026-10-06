const User = require('../models/User');
const ExpressError = require('../utils/ExpressError');
const { sendTokenResponse } = require('../utils/generateToken');

/**
 * Render user registration form
 */
const renderRegister = (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('auth/register', {
    title: 'Sign Up',
    formData: {},
    errorMsg: null,
  });
};

/**
 * Handle new user registration (Traveler or Host)
 */
const register = async (req, res, next) => {
  const { name, email, password, role = 'traveler' } = req.body;
  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  // Check for existing account
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    const errorMsg = 'An account with this email address already exists.';
    if (isApiRequest) {
      return next(new ExpressError(errorMsg, 409));
    }
    return res.status(409).render('auth/register', {
      title: 'Sign Up',
      errorMsg,
      formData: { name, email, role },
    });
  }

  // Create new user
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role,
  });

  return sendTokenResponse(user, 201, req, res, '/');
};

/**
 * Render user login form
 */
const renderLogin = (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('auth/login', {
    title: 'Sign In',
    formData: {},
    errorMsg: null,
  });
};

/**
 * Authenticate user and issue JWT
 */
const login = async (req, res, next) => {
  const { email, password } = req.body;
  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  // Find user and explicitly select password field
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    const errorMsg = 'Invalid email or password.';
    if (isApiRequest) {
      return next(new ExpressError(errorMsg, 401));
    }
    return res.status(401).render('auth/login', {
      title: 'Sign In',
      errorMsg,
      formData: { email },
    });
  }

  return sendTokenResponse(user, 200, req, res, '/');
};

/**
 * Log out current user (clear JWT cookie)
 */
const logout = (req, res) => {
  res.clearCookie('token');

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }

  res.cookie('successMsg', 'You have been logged out safely.', { maxAge: 5000 });
  return res.redirect('/');
};

/**
 * Return current authenticated user profile (API)
 */
const getMe = (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
};

module.exports = {
  renderRegister,
  register,
  renderLogin,
  login,
  logout,
  getMe,
};
