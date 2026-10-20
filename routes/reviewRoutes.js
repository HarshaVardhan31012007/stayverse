const express = require('express');
const router = express.Router({ mergeParams: true });

const reviewController = require('../controllers/reviewController');
const { requireAuth } = require('../middleware/authMiddleware');
const { catchAsync } = require('../middleware/errorMiddleware');

// Post a review for a property
router.post('/', requireAuth, catchAsync(reviewController.createReview));

// Delete a review
router.delete('/:reviewId', requireAuth, catchAsync(reviewController.deleteReview));

module.exports = router;
