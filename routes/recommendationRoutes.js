const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { catchAsync } = require('../middleware/errorMiddleware');

// Get personalized recommendations (public & authenticated)
router.get('/', catchAsync(recommendationController.getRecommendations));

// Quick AJAX matcher endpoint for live preference slider/chips updates
router.get('/match', catchAsync(recommendationController.getRecommendations));

// Save traveler preferences to profile / cookie
router.post('/preferences', catchAsync(recommendationController.savePreferences));

module.exports = router;
