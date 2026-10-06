const ExpressError = require('../utils/ExpressError');
const { validateRegisterInput, validateLoginInput } = require('../utils/validation');

/**
 * Middleware to validate user registration payloads
 */
const validateRegister = (req, res, next) => {
  const { isValid, errors } = validateRegisterInput(req.body);
  if (!isValid) {
    const isApiRequest =
      req.originalUrl.startsWith('/api') ||
      req.xhr ||
      req.headers.accept?.includes('application/json');

    if (isApiRequest) {
      return next(new ExpressError(errors[0], 400));
    }

    return res.status(400).render('auth/register', {
      title: 'Sign Up',
      errorMsg: errors[0],
      formData: req.body,
    });
  }
  next();
};

/**
 * Middleware to validate user login payloads
 */
const validateLogin = (req, res, next) => {
  const { isValid, errors } = validateLoginInput(req.body);
  if (!isValid) {
    const isApiRequest =
      req.originalUrl.startsWith('/api') ||
      req.xhr ||
      req.headers.accept?.includes('application/json');

    if (isApiRequest) {
      return next(new ExpressError(errors[0], 400));
    }

    return res.status(400).render('auth/login', {
      title: 'Sign In',
      errorMsg: errors[0],
      formData: req.body,
    });
  }
  next();
};

/**
 * Middleware to validate property creation and updates
 */
const validateProperty = (req, res, next) => {
  const { title, description, pricePerNight, address, city, country, latitude, longitude } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Property title is required');
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push('Property description is required');
  }

  const price = Number(pricePerNight);
  if (isNaN(price) || price <= 0) {
    errors.push('Price per night must be a valid number greater than 0');
  }

  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    errors.push('Address is required');
  }

  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    errors.push('City is required');
  }

  if (!country || typeof country !== 'string' || country.trim().length === 0) {
    errors.push('Country is required');
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    errors.push('Latitude must be a valid number between -90 and 90');
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    errors.push('Longitude must be a valid number between -180 and 180');
  }

  if (errors.length > 0) {
    const isApiRequest =
      req.originalUrl.startsWith('/api') ||
      req.xhr ||
      req.headers.accept?.includes('application/json');

    if (isApiRequest) {
      return next(new ExpressError(errors[0], 400));
    }

    return res.status(400).render(req.params.id ? 'properties/edit' : 'properties/new', {
      title: req.params.id ? 'Edit Property' : 'Add Property',
      errorMsg: errors[0],
      property: {
        _id: req.params.id,
        ...req.body,
        location: { coordinates: [lng, lat] },
      },
    });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProperty,
};
