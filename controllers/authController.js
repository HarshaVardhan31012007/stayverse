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

/**
 * Render user profile page with activity stats, preferences, and security settings
 */
const renderProfile = async (req, res) => {
  const Booking = require('../models/Booking');
  const Property = require('../models/Property');
  const Refund = require('../models/Refund');

  const user = await User.findById(req.user._id);

  let stats = {};
  if (user.role === 'host') {
    const propertiesCount = await Property.countDocuments({ host: user._id });
    const userPropIds = await Property.find({ host: user._id }).distinct('_id');
    const totalHostBookings = await Booking.countDocuments({ property: { $in: userPropIds } });
    stats = {
      propertiesCount,
      totalHostBookings,
    };
  } else {
    const totalBookings = await Booking.countDocuments({ user: user._id });
    const upcomingCount = await Booking.countDocuments({
      user: user._id,
      checkIn: { $gte: new Date() },
      status: 'confirmed',
    });
    const cancelledCount = await Booking.countDocuments({
      user: user._id,
      status: 'cancelled',
    });
    stats = {
      totalBookings,
      upcomingCount,
      cancelledCount,
      totalRefunded: user.cumulativeRefunded || 0,
    };
  }

  const recentRefunds = await Refund.find({ user: user._id }).sort({ processedAt: -1 }).limit(5);

  res.render('auth/profile', {
    title: 'My Profile — StayVerse',
    user,
    stats,
    recentRefunds,
  });
};

/**
 * Update user profile details (Name, Email)
 */
const updateProfile = async (req, res, next) => {
  const { name, email } = req.body;
  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (!name || !name.trim()) {
    if (isApiRequest) return next(new ExpressError('Name is required', 400));
    res.cookie('errorMsg', 'Please provide a valid name.', { maxAge: 5000 });
    return res.redirect('/profile');
  }

  // Check email uniqueness if changing email
  if (email && email.toLowerCase().trim() !== req.user.email) {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      if (isApiRequest) return next(new ExpressError('Email is already in use by another account', 409));
      res.cookie('errorMsg', 'This email is already in use by another account.', { maxAge: 5000 });
      return res.redirect('/profile');
    }
  }

  const user = await User.findById(req.user._id);
  user.name = name.trim();
  if (email && email.trim()) {
    user.email = email.toLowerCase().trim();
  }
  await user.save();

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  }

  res.cookie('successMsg', 'Your profile details have been updated successfully!', { maxAge: 5000 });
  res.redirect('/profile');
};

/**
 * Update user password
 */
const updatePassword = async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (!currentPassword || !newPassword) {
    const msg = 'Please provide your current password and a new password.';
    if (isApiRequest) return next(new ExpressError(msg, 400));
    res.cookie('errorMsg', msg, { maxAge: 5000 });
    return res.redirect('/profile');
  }

  if (newPassword.length < 6) {
    const msg = 'New password must be at least 6 characters long.';
    if (isApiRequest) return next(new ExpressError(msg, 400));
    res.cookie('errorMsg', msg, { maxAge: 5000 });
    return res.redirect('/profile');
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    const msg = 'New password and confirmation password do not match.';
    if (isApiRequest) return next(new ExpressError(msg, 400));
    res.cookie('errorMsg', msg, { maxAge: 5000 });
    return res.redirect('/profile');
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    const msg = 'Current password is incorrect.';
    if (isApiRequest) return next(new ExpressError(msg, 401));
    res.cookie('errorMsg', msg, { maxAge: 5000 });
    return res.redirect('/profile');
  }

  user.password = newPassword;
  await user.save();

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  }

  res.cookie('successMsg', 'Your password has been changed securely!', { maxAge: 5000 });
  res.redirect('/profile');
};

module.exports = {
  renderRegister,
  register,
  renderLogin,
  login,
  logout,
  getMe,
  renderProfile,
  updateProfile,
  updatePassword,
};
