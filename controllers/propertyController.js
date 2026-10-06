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
  });
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

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      data: property,
    });
  }

  res.render('properties/show', {
    title: property.title,
    property,
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

// View Host's own properties
const getMyProperties = async (req, res) => {
  const properties = await propertyService.getHostProperties(req.user._id);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  }

  res.render('dashboard/host', {
    title: 'Host Property Inventory',
    properties,
  });
};

module.exports = {
  index,
  renderNew,
  create,
  show,
  renderEdit,
  update,
  destroy,
  getMyProperties,
};
