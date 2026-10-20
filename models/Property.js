const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  filename: {
    type: String,
    default: 'stayverse-image',
  },
});

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Property title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Property description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price is required'],
      min: [1, 'Price must be at least ₹1'],
    },
    priceUnit: {
      type: String,
      enum: {
        values: ['night', 'day', 'week', 'month'],
        message: '{VALUE} is not a valid pricing unit. Choose "night", "day", "week", or "month"',
      },
      default: 'night',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      // GeoJSON: [longitude, latitude]
      coordinates: {
        type: [Number],
        required: [true, 'Coordinates [longitude, latitude] are required'],
        validate: {
          validator(coords) {
            return (
              Array.isArray(coords) &&
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 && // longitude
              coords[1] >= -90 &&
              coords[1] <= 90 // latitude
            );
          },
          message: 'Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)]',
        },
      },
    },
    address: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    images: {
      type: [imageSchema],
      default: [
        {
          url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
          filename: 'default-luxury-stay',
        },
      ],
    },
    amenities: {
      type: [String],
      default: [],
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Property must belong to a host'],
      index: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (val) => Math.round(val * 10) / 10, // Round to 1 decimal place
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 2dsphere index for high-performance geospatial queries ($near, $geoNear)
propertySchema.index({ location: '2dsphere' });
propertySchema.index({ pricePerNight: 1 });
propertySchema.index({ averageRating: -1 });

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
