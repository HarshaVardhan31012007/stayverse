const Review = require('../models/Review');
const Property = require('../models/Property');
const ExpressError = require('../utils/ExpressError');

/**
 * Create a new review for a property
 */
const createReview = async (req, res, next) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  const property = await Property.findById(id);
  if (!property) {
    return next(new ExpressError('Property not found', 404));
  }

  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return next(new ExpressError('Please provide a valid rating between 1 and 5 stars', 400));
  }

  if (!comment || comment.trim().length === 0) {
    return next(new ExpressError('Review comment cannot be empty', 400));
  }

  // Verify that traveler has booked and completed their stay
  const bookingService = require('../services/bookingService');
  const eligibility = await bookingService.checkReviewEligibility(req.user._id, id);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (!eligibility.canReview) {
    const errorMsg = eligibility.message;
    if (isApiRequest) {
      return next(new ExpressError(errorMsg, 403));
    }
    res.cookie('errorMsg', errorMsg, { maxAge: 6000 });
    return res.redirect(`/properties/${id}`);
  }

  // Prevent duplicate review from the same user on the same property
  const existingReview = await Review.findOne({ property: id, user: req.user._id });
  if (existingReview) {
    const errorMsg = 'You have already submitted a review for this stay.';

    if (isApiRequest) {
      return next(new ExpressError(errorMsg, 400));
    }

    res.cookie('errorMsg', errorMsg, { maxAge: 5000 });
    return res.redirect(`/properties/${id}`);
  }

  const review = await Review.create({
    property: id,
    user: req.user._id,
    rating: numRating,
    comment: comment.trim(),
  });
  if (isApiRequest) {
    return res.status(201).json({
      success: true,
      message: 'Review posted successfully',
      data: review,
    });
  }

  res.cookie('successMsg', 'Thank you! Your review and rating have been posted.', { maxAge: 5000 });
  res.redirect(`/properties/${id}`);
};

/**
 * Delete a review
 */
const deleteReview = async (req, res, next) => {
  const { id, reviewId } = req.params;

  const review = await Review.findById(reviewId);
  if (!review) {
    return next(new ExpressError('Review not found', 404));
  }

  // Verify ownership: only the review author can delete it
  if (review.user.toString() !== req.user._id.toString()) {
    return next(new ExpressError('Forbidden: You can only delete your own reviews', 403));
  }

  await Review.findByIdAndDelete(reviewId);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Review removed successfully',
    });
  }

  res.cookie('successMsg', 'Review removed successfully.', { maxAge: 5000 });
  res.redirect(`/properties/${id}`);
};

module.exports = {
  createReview,
  deleteReview,
};
