const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Review must belong to a property'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must have an author'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate reviews: 1 review per user per property
reviewSchema.index({ property: 1, user: 1 }, { unique: true });

/**
 * Static method to calculate and update average rating & review count for a property
 */
reviewSchema.statics.calculateAverageRating = async function (propertyId) {
  const stats = await this.aggregate([
    { $match: { property: new mongoose.Types.ObjectId(propertyId) } },
    {
      $group: {
        _id: '$property',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  const Property = mongoose.model('Property');

  if (stats.length > 0) {
    await Property.findByIdAndUpdate(propertyId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].numReviews,
    });
  } else {
    await Property.findByIdAndUpdate(propertyId, {
      averageRating: 0,
      reviewCount: 0,
    });
  }
};

// Update property stats after saving a review
reviewSchema.post('save', async function () {
  await this.constructor.calculateAverageRating(this.property);
});

// Update property stats after deleting a review
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await doc.constructor.calculateAverageRating(doc.property);
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
