const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ExpressError = require('../utils/ExpressError');

/**
 * Extract JWT from cookie or Bearer header
 */
const extractToken = (req) => {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

/**
 * Optional Auth Middleware:
 * Attaches user to req.user and res.locals if valid token is present, but never blocks.
 */
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    res.locals.currentUser = null;
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'stayverse_default_dev_jwt_secret'
    );
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      req.user = null;
      res.locals.currentUser = null;
    }
  } catch (error) {
    req.user = null;
    res.locals.currentUser = null;
  }
  next();
};

/**
 * Require Authentication Middleware:
 * Blocks unauthenticated requests with 401 or login redirect.
 */
const requireAuth = async (req, res, next) => {
  const token = extractToken(req);
  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (!token) {
    if (isApiRequest) {
      return next(new ExpressError('Authentication required. Token missing.', 401));
    }
    res.cookie('errorMsg', 'Please log in to access this page.', { maxAge: 5000 });
    return res.redirect('/auth/login');
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'stayverse_default_dev_jwt_secret'
    );
    const user = await User.findById(decoded.id);

    if (!user) {
      if (isApiRequest) {
        return next(new ExpressError('The account for this token no longer exists.', 401));
      }
      res.clearCookie('token');
      res.cookie('errorMsg', 'User session expired. Please log in again.', { maxAge: 5000 });
      return res.redirect('/auth/login');
    }

    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    if (isApiRequest) {
      return next(new ExpressError('Invalid or expired authentication token.', 401));
    }
    res.clearCookie('token');
    res.cookie('errorMsg', 'Session expired. Please log in again.', { maxAge: 5000 });
    return res.redirect('/auth/login');
  }
};

module.exports = {
  extractToken,
  optionalAuth,
  requireAuth,
};
