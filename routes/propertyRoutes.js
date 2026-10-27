const express = require('express');
const router = express.Router();

const propertyController = require('../controllers/propertyController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole, checkPropertyOwnership } = require('../middleware/roleMiddleware');
const { validateProperty } = require('../middleware/validationMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const { catchAsync } = require('../middleware/errorMiddleware');

// 1. List all properties (public)
router.get('/', catchAsync(propertyController.index));

// 2. Render new property form (Host only)
router.get('/new', requireAuth, requireRole('host'), propertyController.renderNew);

// 3. Create property (Host only)
router.post(
  '/',
  requireAuth,
  requireRole('host'),
  upload.array('images', 5),
  validateProperty,
  catchAsync(propertyController.create)
);

// 4. View host's own properties
router.get('/my', requireAuth, requireRole('host'), catchAsync(propertyController.getMyProperties));

// 4.1 GeoJSON FeatureCollection for interactive map exploration
router.get('/geojson', catchAsync(propertyController.getGeoJSON));

// 4.2 Nearby search exploration (must come before /:id)
router.get('/nearby', catchAsync(propertyController.nearby));

// 5. Show property details (public)
router.get('/:id', catchAsync(propertyController.show));

// 6. Render edit property form (Host & Owner only)
router.get(
  '/:id/edit',
  requireAuth,
  requireRole('host'),
  catchAsync(checkPropertyOwnership),
  propertyController.renderEdit
);

// 7. Update property (Host & Owner only)
router.put(
  '/:id',
  requireAuth,
  requireRole('host'),
  catchAsync(checkPropertyOwnership),
  upload.array('images', 5),
  validateProperty,
  catchAsync(propertyController.update)
);

// 8. Delete property (Host & Owner only)
router.delete(
  '/:id',
  requireAuth,
  requireRole('host'),
  catchAsync(checkPropertyOwnership),
  catchAsync(propertyController.destroy)
);

// 9. Nested Reviews routes
const reviewRoutes = require('./reviewRoutes');
router.use('/:id/reviews', reviewRoutes);

// 10. Reserve dates / Create booking for this property
const bookingController = require('../controllers/bookingController');
router.post('/:id/bookings', requireAuth, catchAsync(bookingController.createBooking));

module.exports = router;
