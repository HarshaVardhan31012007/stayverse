const propertyService = require('../services/propertyService');
const ExpressError = require('../utils/ExpressError');

/**
 * Property Controller
 */

// List properties with filters, search, sorting & pagination
const index = async (req, res) => {
  const result = await propertyService.listProperties(req.query);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      count: result.properties.length,
      pagination: result.pagination,
      data: result.properties,
    });
  }

  res.render('properties/index', {
    title: 'Explore Vacation Properties',
    properties: result.properties,
    pagination: result.pagination,
    filters: req.query,
    geoFallback: result.geoFallback || false,
  });
};

// Explore properties near traveler's current location
const nearby = async (req, res) => {
  // If coordinates are provided in query string, list properties using geo proximity
  if (req.query.lat && req.query.lng) {
    return index(req, res);
  }

  // Otherwise, load properties and prompt client-side geolocation to locate traveler
  const result = await propertyService.listProperties({ ...req.query, sort: 'newest' });

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      count: result.properties.length,
      pagination: result.pagination,
      data: result.properties,
      autoNearMe: true,
    });
  }

  res.render('properties/index', {
    title: 'Nearby Stays & Vacation Rentals',
    properties: result.properties,
    pagination: result.pagination,
    filters: { ...req.query, autoNearMe: 'true' },
    geoFallback: false,
    autoNearMe: true,
  });
};

// GeoJSON endpoint for interactive MapLibre map exploration
const getGeoJSON = async (req, res) => {
  const geojson = await propertyService.getPropertiesGeoJSON(req.query);
  res.status(200).json(geojson);
};

// Render form to create new property
const renderNew = (req, res) => {
  res.render('properties/new', {
    title: 'List Your Property',
    property: null,
    errorMsg: null,
  });
};

// Create property
const create = async (req, res) => {
  const property = await propertyService.createProperty(req.body, req.user._id, req.files);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: property,
    });
  }

  res.cookie('successMsg', 'Property published successfully!', { maxAge: 5000 });
  res.redirect(`/properties/${property._id}`);
};

// Show single property details
const show = async (req, res, next) => {
  const property = await propertyService.getPropertyById(req.params.id);

  if (!property) {
    return next(new ExpressError('Property not found', 404));
  }

  const Review = require('../models/Review');
  const bookingService = require('../services/bookingService');

  const reviews = await Review.find({ property: req.params.id })
    .populate('user', 'name role')
    .sort({ createdAt: -1 });

  let reviewEligibility = { canReview: false, reason: 'unauthenticated' };
  let userReview = null;

  if (req.user) {
    reviewEligibility = await bookingService.checkReviewEligibility(req.user._id, req.params.id);
    userReview = reviews.find(
      (r) =>
        r.user &&
        (r.user._id?.toString() === req.user._id.toString() ||
          r.user.id?.toString() === req.user._id.toString() ||
          r.user.toString() === req.user._id.toString())
    );
  }

  // Fetch smart proximity and quality recommendations
  const recommendations = await propertyService.getRecommendations(req.params.id, 3);

  // Fetch active and upcoming booked date ranges for availability visibility
  const bookedRanges = await bookingService.getPropertyBookedRanges(req.params.id);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      data: property,
      reviews,
      reviewEligibility,
      userReview,
      recommendations,
      bookedRanges,
    });
  }

  res.render('properties/show', {
    title: property.title,
    property,
    reviews,
    reviewEligibility,
    userReview,
    recommendations,
    bookedRanges,
  });
};

// Render property edit form
const renderEdit = (req, res) => {
  res.render('properties/edit', {
    title: `Edit ${req.property.title}`,
    property: req.property,
    errorMsg: null,
  });
};

// Update property
const update = async (req, res) => {
  const updatedProperty = await propertyService.updateProperty(
    req.property,
    req.body,
    req.files
  );

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      data: updatedProperty,
    });
  }

  res.cookie('successMsg', 'Property details updated!', { maxAge: 5000 });
  res.redirect(`/properties/${updatedProperty._id}`);
};

// Delete property
const destroy = async (req, res) => {
  await propertyService.deleteProperty(req.property);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Property deleted successfully',
    });
  }

  res.cookie('successMsg', 'Property listing removed.', { maxAge: 5000 });
  res.redirect('/properties');
};

// View Host's own properties & reservations
const getMyProperties = async (req, res) => {
  const properties = await propertyService.getHostProperties(req.user._id);
  const bookingService = require('../services/bookingService');
  const reservations = await bookingService.getHostReservations(req.user._id);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
      reservations,
    });
  }

  res.render('dashboard/host', {
    title: 'Host Property Inventory',
    properties,
    reservations,
  });
};

module.exports = {
  index,
  nearby,
  renderNew,
  create,
  show,
  renderEdit,
  update,
  destroy,
  getMyProperties,
  getGeoJSON,
};
