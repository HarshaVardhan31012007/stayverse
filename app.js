const path = require('path');
require('dotenv').config();

const express = require('express');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');

const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

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

// Global Context Middleware for Views
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.title = 'StayVerse — Modern Vacation Rental Platform';
  res.locals.successMsg = req.cookies?.successMsg || null;
  res.locals.errorMsg = req.cookies?.errorMsg || null;

  // Clear flash cookies if present
  if (req.cookies?.successMsg) res.clearCookie('successMsg');
  if (req.cookies?.errorMsg) res.clearCookie('errorMsg');

  next();
});

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
