const bookingService = require('../services/bookingService');
const Property = require('../models/Property');
const ExpressError = require('../utils/ExpressError');

/**
 * Booking Controller
 */

// Create a new reservation
const createBooking = async (req, res, next) => {
  const propertyId = req.params.id || req.body.propertyId;
  const { checkIn, checkOut, guests, specialRequests, paymentTransactionId, paymentMethod } = req.body;

  const booking = await bookingService.createBooking({
    propertyId,
    userId: req.user._id,
    checkIn,
    checkOut,
    guests,
    specialRequests,
    paymentTransactionId,
    paymentMethod,
  });

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully!',
      data: booking,
    });
  }

  res.cookie('successMsg', '🎉 Your stay is confirmed! Pack your bags for an amazing getaway.', { maxAge: 6000 });
  res.redirect('/dashboard/traveler');
};

// Render traveler bookings dashboard
const getTravelerBookings = async (req, res) => {
  const bookings = await bookingService.getUserBookings(req.user._id);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  }

  res.render('dashboard/traveler', {
    title: 'My Booked Stays — StayVerse',
    bookings,
  });
};

// Cancel an upcoming reservation
const cancelBooking = async (req, res) => {
  const { bookingId } = req.params;

  const booking = await bookingService.cancelBooking(bookingId, req.user._id);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: booking,
    });
  }

  res.cookie('successMsg', 'Your reservation has been cancelled.', { maxAge: 5000 });
  res.redirect('/dashboard/traveler');
};

module.exports = {
  createBooking,
  getTravelerBookings,
  cancelBooking,
};
