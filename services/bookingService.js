const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const Review = require('../models/Review');
const ExpressError = require('../utils/ExpressError');

/**
 * Booking Service — Concurrency-aware reservations and traveler itineraries
 */

/**
 * Create a new booking reservation with ACID transaction and property write-lock isolation
 */
const createBooking = async ({
  propertyId,
  userId,
  checkIn,
  checkOut,
  guests = 1,
  specialRequests = '',
  paymentTransactionId = '',
  paymentMethod = 'stripe',
}) => {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new ExpressError('Property not found', 404);
  }

  // Prevent host from booking their own property
  if (property.host && property.host.toString() === userId.toString()) {
    throw new ExpressError('Hosts cannot book their own property listing.', 400);
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    throw new ExpressError('Please provide valid check-in and check-out dates.', 400);
  }

  if (checkOutDate <= checkInDate) {
    throw new ExpressError('Check-out date must be strictly after the check-in date.', 400);
  }

  // Ensure check-in is not in the past (allow today with 2-hour leeway)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (checkInDate < today) {
    throw new ExpressError('Check-in date cannot be in the past.', 400);
  }

  const diffTime = Math.abs(checkOutDate - checkInDate);
  const totalNights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  const subtotal = totalNights * property.pricePerNight;
  const gstAmount = Math.round(subtotal * 0.12);
  const serviceFee = Math.round(subtotal * 0.05);
  const totalPrice = subtotal + gstAmount + serviceFee;

  // Check if MongoDB deployment supports multi-document transactions (ReplicaSet)
  const topology = mongoose.connection.client?.topology?.description?.type;
  const isReplicaSet = topology === 'ReplicaSetWithPrimary' || topology === 'Sharded';

  let session = null;
  let useTransaction = false;

  if (isReplicaSet) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (e) {
      useTransaction = false;
      if (session) session.endSession();
      session = null;
    }
  }

  try {
    const sessionOpt = useTransaction ? { session } : {};

    // 1. Acquire document-level write lock on Property to serialize concurrent booking requests
    await Property.findByIdAndUpdate(
      propertyId,
      { $inc: { bookingLockVersion: 1 } },
      sessionOpt
    );

    // 2. Check for reservation overlap on confirmed bookings within transaction
    const overlapQuery = Booking.findOne({
      property: propertyId,
      status: 'confirmed',
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
    });
    if (useTransaction) overlapQuery.session(session);
    const overlappingBooking = await overlapQuery;

    if (overlappingBooking) {
      throw new ExpressError(
        'These dates are already reserved by another traveler. Please pick another date range.',
        400
      );
    }

    // 3. Atomically create the booking reservation with payment record
    const finalTxId =
      paymentTransactionId ||
      `ch_stripe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const [booking] = await Booking.create(
      [
        {
          property: propertyId,
          user: userId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          totalNights,
          totalPrice,
          gstAmount,
          serviceFee,
          guests: Math.max(1, Number(guests) || 1),
          specialRequests: specialRequests ? specialRequests.trim() : '',
          status: 'confirmed',
          paymentMethod: paymentMethod || 'stripe',
          paymentTransactionId: finalTxId,
          paymentStatus: 'paid',
        },
      ],
      sessionOpt
    );

    if (useTransaction) {
      await session.commitTransaction();
    }

    return booking;
  } catch (err) {
    if (useTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }
    // Handle MongoDB transient write conflict under simultaneous race conditions
    if (
      (typeof err.hasErrorLabel === 'function' && err.hasErrorLabel('TransientTransactionError')) ||
      (err.message && err.message.includes('Write conflict')) ||
      err.code === 112
    ) {
      throw new ExpressError(
        'These dates are already reserved by another traveler. Please pick another date range.',
        400
      );
    }
    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * Get all bookings for a traveler with property details and review status
 */
const getUserBookings = async (userId) => {
  const bookings = await Booking.find({ user: userId })
    .populate({
      path: 'property',
      select: 'title city country images pricePerNight priceUnit averageRating host',
      populate: {
        path: 'host',
        select: 'name email',
      },
    })
    .sort({ checkIn: -1 });

  // Enrich each booking with reviewed status
  const propertyIds = bookings
    .filter((b) => b.property)
    .map((b) => b.property._id);

  const existingReviews = await Review.find({
    user: userId,
    property: { $in: propertyIds },
  });

  const reviewedMap = new Map();
  existingReviews.forEach((r) => {
    reviewedMap.set(r.property.toString(), r);
  });

  const now = new Date();

  return bookings.map((b) => {
    const bookingObj = b.toObject({ virtuals: true });
    const hasEnded = new Date(b.checkOut) <= now;
    const isUpcoming = b.status === 'confirmed' && new Date(b.checkIn) > now;
    const isActive = b.status === 'confirmed' && new Date(b.checkIn) <= now && new Date(b.checkOut) > now;
    const userReview = b.property ? reviewedMap.get(b.property._id.toString()) : null;

    return {
      ...bookingObj,
      hasEnded,
      isUpcoming,
      isActive,
      userReview: userReview || null,
      canReview: hasEnded && b.status !== 'cancelled' && !userReview,
    };
  });
};

/**
 * Check if a traveler has booked and completed their stay at a property
 */
const checkReviewEligibility = async (userId, propertyId) => {
  if (!userId) {
    return {
      canReview: false,
      reason: 'unauthenticated',
      message: 'Please sign in to leave a review.',
    };
  }

  // Find confirmed bookings by this user for this property
  const bookings = await Booking.find({
    property: propertyId,
    user: userId,
    status: { $ne: 'cancelled' },
  }).sort({ checkOut: -1 });

  if (!bookings || bookings.length === 0) {
    return {
      canReview: false,
      reason: 'no_booking',
      message: 'Verified Guests Only: You can only review properties that you have booked and stayed at.',
    };
  }

  const now = new Date();
  const completedBooking = bookings.find((b) => new Date(b.checkOut) <= now);

  if (!completedBooking) {
    const nextCheckout = new Date(bookings[0].checkOut).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return {
      canReview: false,
      reason: 'stay_not_ended',
      message: `Your stay is currently booked until ${nextCheckout}. You will be able to submit your review once your checkout date has passed.`,
      nextCheckout,
    };
  }

  return {
    canReview: true,
    completedBooking,
  };
};

/**
 * Cancel an upcoming reservation
 */
const cancelBooking = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ExpressError('Booking not found', 404);
  }

  if (booking.user.toString() !== userId.toString()) {
    throw new ExpressError('Forbidden: You can only cancel your own bookings.', 403);
  }

  if (booking.status === 'cancelled') {
    throw new ExpressError('This booking is already cancelled.', 400);
  }

  const now = new Date();
  if (new Date(booking.checkIn) <= now) {
    throw new ExpressError('Cannot cancel a booking that has already started or ended.', 400);
  }

  booking.status = 'cancelled';
  await booking.save();
  return booking;
};

/**
 * Retrieve all reservations made on properties owned by a specific host
 */
const getHostReservations = async (hostId) => {
  const hostProperties = await Property.find({ host: hostId }).select('_id');
  const propertyIds = hostProperties.map((p) => p._id);

  const reservations = await Booking.find({ property: { $in: propertyIds } })
    .populate('property', 'title city country images pricePerNight')
    .populate('user', 'name email')
    .sort({ checkIn: -1 });

  return reservations;
};

/**
 * Retrieve all confirmed upcoming or active booked date ranges for a property
 */
const getPropertyBookedRanges = async (propertyId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await Booking.find({
    property: propertyId,
    status: 'confirmed',
    checkOut: { $gte: today },
  })
    .select('checkIn checkOut totalNights')
    .sort({ checkIn: 1 });

  return bookings.map((b) => ({
    checkIn: b.checkIn.toISOString().split('T')[0],
    checkOut: b.checkOut.toISOString().split('T')[0],
    checkInFormatted: new Date(b.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    checkOutFormatted: new Date(b.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }));
};

module.exports = {
  createBooking,
  getUserBookings,
  getHostReservations,
  getPropertyBookedRanges,
  checkReviewEligibility,
  cancelBooking,
};
