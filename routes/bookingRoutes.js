const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/authMiddleware');
const { catchAsync } = require('../middleware/errorMiddleware');
const { bookingLimiter } = require('../middleware/rateLimitMiddleware');

// Traveler Bookings Dashboard
router.get('/', requireAuth, catchAsync(bookingController.getTravelerBookings));
router.get('/my-bookings', requireAuth, catchAsync(bookingController.getTravelerBookings));

// Cancel a booking (with booking rate limiter)
router.post('/:bookingId/cancel', requireAuth, bookingLimiter, catchAsync(bookingController.cancelBooking));

// Delete a booking with cascading refund accounting (with booking rate limiter)
router.delete('/:bookingId', requireAuth, bookingLimiter, catchAsync(bookingController.deleteBooking));
router.post('/:bookingId/delete', requireAuth, bookingLimiter, catchAsync(bookingController.deleteBooking));

module.exports = router;
