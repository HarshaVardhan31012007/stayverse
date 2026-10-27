const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Booking must belong to a property'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking must belong to a user'],
      index: true,
    },
    checkIn: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    checkOut: {
      type: Date,
      required: [true, 'Check-out date is required'],
      validate: {
        validator(val) {
          return val > this.checkIn;
        },
        message: 'Check-out date must be after check-in date',
      },
    },
    totalNights: {
      type: Number,
      required: true,
      min: [1, 'Booking must be for at least 1 night'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
    guests: {
      type: Number,
      default: 1,
      min: [1, 'Number of guests must be at least 1'],
    },
    status: {
      type: String,
      enum: {
        values: ['confirmed', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid booking status',
      },
      default: 'confirmed',
    },
    specialRequests: {
      type: String,
      trim: true,
      maxlength: [500, 'Special requests cannot exceed 500 characters'],
      default: '',
    },
    paymentMethod: {
      type: String,
      default: 'stripe',
    },
    paymentTransactionId: {
      type: String,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'paid',
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index to quickly query reservations by property and dates
bookingSchema.index({ property: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });

// Virtual to determine if the booking stay has already ended
bookingSchema.virtual('isEnded').get(function () {
  const now = new Date();
  const end = new Date(this.checkOut);
  return end <= now;
});

// Virtual to determine if the booking is currently active (stay in progress)
bookingSchema.virtual('isActive').get(function () {
  const now = new Date();
  const start = new Date(this.checkIn);
  const end = new Date(this.checkOut);
  return this.status === 'confirmed' && start <= now && end > now;
});

// Virtual to determine if the booking is in the future
bookingSchema.virtual('isUpcoming').get(function () {
  const now = new Date();
  const start = new Date(this.checkIn);
  return this.status === 'confirmed' && start > now;
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
