const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/authMiddleware');
const { catchAsync } = require('../middleware/errorMiddleware');

// Traveler Bookings Dashboard
router.get('/', requireAuth, catchAsync(bookingController.getTravelerBookings));
router.get('/my-bookings', requireAuth, catchAsync(bookingController.getTravelerBookings));

// Cancel a booking
router.post('/:bookingId/cancel', requireAuth, catchAsync(bookingController.cancelBooking));

module.exports = router;
