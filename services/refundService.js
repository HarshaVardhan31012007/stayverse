const Refund = require('../models/Refund');
const User = require('../models/User');
const ExpressError = require('../utils/ExpressError');

/**
 * StayVerse Refund Service
 * Handles calculation, idempotency, permanent audit ledger entry,
 * and user cumulative balance synchronization.
 */

/**
 * Calculates refund amount and percentage based on standard platform policy:
 * - Property Deletion / Host Cancellation / Admin: 100% full refund.
 * - User Cancellation:
 *     - If >= 48 hours before checkIn: 100% full refund.
 *     - If < 48 hours before checkIn (and before start): 80% partial refund.
 *     - If stay already started or ended: 0% non-refundable.
 */
const calculateRefund = (booking, reason = 'user_cancellation') => {
  if (!booking || !booking.totalPrice) {
    return {
      amount: 0,
      percentage: 0,
      policy: 'Ineligible: Booking total price is invalid or zero',
    };
  }

  // Admin, Host, or Property Deletion triggers 100% full traveler refund
  if (
    reason === 'property_deletion' ||
    reason === 'host_cancellation' ||
    reason === 'admin_cancellation'
  ) {
    return {
      amount: Math.round(booking.totalPrice),
      percentage: 100,
      policy: '100% Full Refund — Host/Property Deletion Guarantee',
    };
  }

  const now = new Date();
  const checkIn = new Date(booking.checkIn);
  const diffHours = (checkIn - now) / (1000 * 60 * 60);

  if (diffHours >= 48) {
    return {
      amount: Math.round(booking.totalPrice),
      percentage: 100,
      policy: '100% Full Refund — Cancelled > 48h prior to check-in',
    };
  } else if (diffHours > 0) {
    const amount = Math.round(booking.totalPrice * 0.8);
    return {
      amount,
      percentage: 80,
      policy: '80% Partial Refund — Cancelled within 48h of check-in',
    };
  } else {
    return {
      amount: 0,
      percentage: 0,
      policy: '0% Non-refundable — Check-in date has already begun or passed',
    };
  }
};

/**
 * Process a refund idempotently and record it in the permanent Refund ledger.
 * Also synchronizes the user's cumulative refunded balance.
 */
const processRefund = async ({
  booking,
  userId = null,
  propertyTitle = null,
  reason = 'user_cancellation',
  session = null,
  notes = '',
}) => {
  if (!booking) {
    throw new ExpressError('Booking object is required for refund processing', 400);
  }

  const bookingId = booking._id || booking.id;

  // 1. Idempotency Check: Prevent duplicate refund if already completed
  const existingRefund = await Refund.findOne({ bookingId });
  if (existingRefund) {
    return {
      refund: existingRefund,
      alreadyProcessed: true,
      amount: existingRefund.amount,
    };
  }

  // 2. Prevent refunding a booking that is already marked fully refunded
  if (booking.refundStatus === 'full') {
    throw new ExpressError('This booking has already been marked as fully refunded.', 400);
  }

  // 3. Compute refund amount & policy
  const { amount, percentage, policy } = calculateRefund(booking, reason);

  // 4. Determine beneficiary traveler user ID
  const recipientUserId =
    userId ||
    (booking.user && (booking.user._id || booking.user.id)) ||
    booking.user;

  // Snapshot property title and ID to preserve audit data even if property is deleted
  let propTitle = propertyTitle || 'Vacation Rental';
  let propId = null;

  if (booking.property) {
    if (typeof booking.property === 'object' && booking.property.title) {
      propTitle = booking.property.title;
      propId = booking.property._id || booking.property.id;
    } else {
      propId = booking.property;
    }
  }

  // 5. Create immutable Refund Ledger entry
  const refundDocData = {
    bookingId,
    user: recipientUserId,
    propertyId: propId,
    propertyTitle: propTitle,
    amount,
    originalAmount: booking.totalPrice,
    refundPercentage: percentage,
    reason,
    policyApplied: policy,
    status: 'completed',
    processedAt: new Date(),
    notes: notes || `Refund processed for booking ${bookingId}`,
  };

  let refundRecord;
  if (session) {
    const createdDocs = await Refund.create([refundDocData], { session });
    refundRecord = createdDocs[0];
  } else {
    refundRecord = await Refund.create(refundDocData);
  }

  // 6. Atomically update traveler's cumulativeRefunded amount
  if (amount > 0 && recipientUserId) {
    await User.findByIdAndUpdate(
      recipientUserId,
      { $inc: { cumulativeRefunded: amount } },
      session ? { session } : {}
    );
  }

  // 7. Update booking state if booking document is mutable
  booking.refundAmount = amount;
  booking.refundStatus = percentage === 100 ? 'full' : percentage > 0 ? 'partial' : 'none';
  booking.paymentStatus = 'refunded';
  booking.refundedAt = new Date();
  booking.status = 'cancelled';

  if (typeof booking.save === 'function') {
    if (session) {
      await booking.save({ session });
    } else {
      await booking.save();
    }
  }

  return {
    refund: refundRecord,
    alreadyProcessed: false,
    amount,
    percentage,
  };
};

/**
 * Retrieve user's refund history for transparency and ledger auditing.
 * Automatically reconciles any legacy or unrecorded cancelled bookings so
 * user's refunded balance always strictly matches total cancelled bookings.
 */
const getUserRefundHistory = async (userId) => {
  try {
    const Booking = require('../models/Booking');
    const cancelledWithoutRefund = await Booking.find({
      user: userId,
      status: 'cancelled',
      $or: [{ refundStatus: { $ne: 'full' } }, { refundAmount: 0 }],
    }).populate('property');

    for (const b of cancelledWithoutRefund) {
      const existing = await Refund.findOne({ bookingId: b._id });
      if (!existing && b.totalPrice > 0) {
        const propTitle = (b.property && b.property.title) ? b.property.title : 'Vacation Stay';
        await Refund.create({
          bookingId: b._id,
          user: userId,
          propertyId: b.property ? (b.property._id || b.property) : null,
          propertyTitle: propTitle,
          amount: b.totalPrice,
          originalAmount: b.totalPrice,
          refundPercentage: 100,
          reason: 'user_cancellation',
          policyApplied: '100% Full Refund — Cancellation Policy Guarantee',
          status: 'completed',
          processedAt: b.updatedAt || new Date(),
          notes: `Reconciled refund for cancelled booking ${b._id}`,
        });

        b.refundAmount = b.totalPrice;
        b.refundStatus = 'full';
        b.paymentStatus = 'refunded';
        b.refundedAt = b.refundedAt || b.updatedAt || new Date();
        await b.save();

        await User.findByIdAndUpdate(userId, { $inc: { cumulativeRefunded: b.totalPrice } });
      }
    }
  } catch (err) {
    // Non-blocking auto-reconcile
  }

  return Refund.find({ user: userId }).sort({ processedAt: -1 }).lean();
};

/**
 * Retrieve all refunds associated with a property (audit history)
 */
const getPropertyRefunds = async (propertyId) => {
  return Refund.find({ propertyId }).sort({ processedAt: -1 }).lean();
};

module.exports = {
  calculateRefund,
  processRefund,
  getUserRefundHistory,
  getPropertyRefunds,
};
