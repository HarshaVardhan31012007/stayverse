const ExpressError = require('../utils/ExpressError');

/**
 * 404 Not Found Middleware
 * Catch all unhandled routes and forward to error handler
 */
const notFoundHandler = (req, res, next) => {
  next(new ExpressError(`Page Not Found - ${req.originalUrl}`, 404));
};

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message = 'Internal Server Error' } = err;

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier: ${err.value}`;
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}. Please use another value.`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = `Validation Error: ${errors.join(', ')}`;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired. Please log in again.';
  }

  const isDev = process.env.NODE_ENV === 'development';
  const isApiRequest = req.originalUrl.startsWith('/api') || 
                       req.xhr || 
                       req.headers.accept?.includes('application/json');

  // If request expects JSON or is an API route, send JSON response
  if (isApiRequest) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      ...(isDev && { stack: err.stack }),
    });
  }

  // Otherwise render EJS error view
  res.status(statusCode).render('errors/error', {
    statusCode,
    message,
    stack: isDev ? err.stack : null,
    currentUser: req.user || null,
  });
};

/**
 * Async wrapper to eliminate repetitive try-catch blocks in route controllers
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  notFoundHandler,
  errorHandler,
  catchAsync,
};
