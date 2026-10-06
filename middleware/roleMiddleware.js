const ExpressError = require('../utils/ExpressError');

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access to routes based on user role(s)
 * @param  {...string} allowedRoles - List of permitted roles (e.g. 'host', 'traveler')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      const isApiRequest =
        req.originalUrl.startsWith('/api') ||
        req.xhr ||
        req.headers.accept?.includes('application/json');

      if (isApiRequest) {
        return next(new ExpressError('Authentication required.', 401));
      }
      res.cookie('errorMsg', 'Please log in to perform this action.', { maxAge: 5000 });
      return res.redirect('/auth/login');
    }

    if (!allowedRoles.includes(req.user.role)) {
      const isApiRequest =
        req.originalUrl.startsWith('/api') ||
        req.xhr ||
        req.headers.accept?.includes('application/json');

      const message = `Forbidden: Access restricted to [${allowedRoles.join(', ')}] accounts only. Your current role is "${req.user.role}".`;

      if (isApiRequest) {
        return next(new ExpressError(message, 403));
      }

      return res.status(403).render('errors/error', {
        title: 'Access Forbidden',
        statusCode: 403,
        message,
        stack: null,
      });
    }

    next();
  };
};

const Property = require('../models/Property');

/**
 * Middleware to verify that the logged-in user is the owner of the requested property
 */
const checkPropertyOwnership = async (req, res, next) => {
  const { id } = req.params;

  const property = await Property.findById(id);
  if (!property) {
    const isApiRequest =
      req.originalUrl.startsWith('/api') ||
      req.xhr ||
      req.headers.accept?.includes('application/json');

    if (isApiRequest) {
      return next(new ExpressError('Property not found', 404));
    }

    return res.status(404).render('errors/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'Property not found',
      stack: null,
    });
  }

  // Ensure current user is the property host
  if (property.host.toString() !== req.user._id.toString()) {
    const isApiRequest =
      req.originalUrl.startsWith('/api') ||
      req.xhr ||
      req.headers.accept?.includes('application/json');

    const message = 'Forbidden: You do not have permission to modify this property.';

    if (isApiRequest) {
      return next(new ExpressError(message, 403));
    }

    return res.status(403).render('errors/error', {
      title: 'Access Forbidden',
      statusCode: 403,
      message,
      stack: null,
    });
  }

  req.property = property;
  next();
};

module.exports = {
  requireRole,
  checkPropertyOwnership,
};
