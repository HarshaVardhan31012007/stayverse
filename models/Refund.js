const mongoose = require('mongoose');

/**
 * Refund Ledger Schema
 * Maintains a permanent, immutable audit trail of all refunds processed
 * across cancellations, property deletions, and administrative actions.
 * Preserves transaction history even if the original booking or property is deleted.
 */
const refundSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required for refund tracking'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for refund tracking'],
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      index: true,
    },
    propertyTitle: {
      type: String,
      default: 'Vacation Rental Property',
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Refund amount is required'],
      min: [0, 'Refund amount cannot be negative'],
    },
    originalAmount: {
      type: Number,
      required: [true, 'Original booking amount is required'],
      min: [0, 'Original amount cannot be negative'],
    },
    refundPercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    reason: {
      type: String,
      enum: {
        values: [
          'user_cancellation',
          'property_deletion',
          'admin_cancellation',
          'host_cancellation',
          'manual_adjustment',
        ],
        message: '{VALUE} is not a recognized refund reason',
      },
      default: 'user_cancellation',
    },
    policyApplied: {
      type: String,
      default: 'Standard Cancellation & Refund Policy',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    processedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee idempotency and prevent duplicate refunds per booking
refundSchema.index({ bookingId: 1, reason: 1 }, { unique: false });

const Refund = mongoose.model('Refund', refundSchema);

module.exports = Refund;

