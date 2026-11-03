const express = require('express');
const router = express.Router({ mergeParams: true });

const reviewController = require('../controllers/reviewController');
const { requireAuth } = require('../middleware/authMiddleware');
const { catchAsync } = require('../middleware/errorMiddleware');
const { reviewLimiter } = require('../middleware/rateLimitMiddleware');

// Post a review for a property (with review rate limit)
router.post('/', requireAuth, reviewLimiter, catchAsync(reviewController.createReview));

// Delete a review (with review rate limit)
router.delete('/:reviewId', requireAuth, reviewLimiter, catchAsync(reviewController.deleteReview));

module.exports = router;
