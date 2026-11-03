const path = require('path');
require('dotenv').config();

const express = require('express');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');

const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Secure Reverse Proxy Configuration (Render, Cloudflare, Heroku)
app.set('trust proxy', 1);

// Global API Rate Limiter
const { globalApiLimiter } = require('./middleware/rateLimitMiddleware');
app.use('/api', globalApiLimiter);

// View Engine Setup with ejs-mate layout support
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Core Request Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Optional Authentication Middleware (populates req.user & res.locals.currentUser)
const { optionalAuth } = require('./middleware/authMiddleware');
app.use(optionalAuth);

// Global Context Middleware for Views
app.use((req, res, next) => {
  res.locals.title = 'StayVerse — Modern Vacation Rental Platform';
  res.locals.maplibreStyleUrl = process.env.MAPLIBRE_STYLE_URL || 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
  res.locals.successMsg = req.cookies?.successMsg || null;
  res.locals.errorMsg = req.cookies?.errorMsg || null;

  // Clear flash cookies if present
  if (req.cookies?.successMsg) res.clearCookie('successMsg');
  if (req.cookies?.errorMsg) res.clearCookie('errorMsg');

  next();
});

// Mount Routes
const authRoutes = require('./routes/authRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const propertyController = require('./controllers/propertyController');
const bookingController = require('./controllers/bookingController');
const authController = require('./controllers/authController');
const { requireAuth } = require('./middleware/authMiddleware');
const { requireRole } = require('./middleware/roleMiddleware');
const { catchAsync } = require('./middleware/errorMiddleware');

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/properties', propertyRoutes);
app.use('/api/properties', propertyRoutes);

app.use('/bookings', bookingRoutes);
app.use('/api/bookings', bookingRoutes);

app.use('/recommendations', recommendationRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Host Dashboard direct route
app.get(
  '/dashboard/host',
  requireAuth,
  requireRole('host'),
  catchAsync(propertyController.getMyProperties)
);

// Traveler Dashboard direct route (My Bookings)
app.get(
  '/dashboard/traveler',
  requireAuth,
  catchAsync(bookingController.getTravelerBookings)
);

// User Profile direct routes
app.route('/profile')
  .get(requireAuth, catchAsync(authController.renderProfile))
  .post(requireAuth, catchAsync(authController.updateProfile))
  .put(requireAuth, catchAsync(authController.updateProfile));

app.route('/profile/password')
  .post(requireAuth, catchAsync(authController.updatePassword))
  .put(requireAuth, catchAsync(authController.updatePassword));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Home Page
app.get('/', (req, res) => {
  res.render('home', {
    title: 'Discover Stays',
  });
});

// 404 Route Catch-All
app.use(notFoundHandler);

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
