const rateLimit = require('express-rate-limit');

/**
 * StayVerse Redis-Backed Rate Limiting Middleware
 * Protects endpoints from brute-force, scraping, and abuse while maintaining
 * shared counter state across multiple instances and reverse proxies.
 *
 * In test environments, all limiters are replaced with passthrough middleware
 * to prevent rapid sequential test requests from triggering HTTP 429 responses.
 * The rateLimiting.test.js suite tests limiters directly with its own instances.
 */

const isTestEnv = process.env.NODE_ENV === 'test';

/** No-op passthrough middleware used in test environments */
const passthrough = (req, res, next) => next();

if (isTestEnv) {
  module.exports = {
    authLimiter: passthrough,
    bookingLimiter: passthrough,
    propertyMutationLimiter: passthrough,
    propertyBrowseLimiter: passthrough,
    reviewLimiter: passthrough,
    globalApiLimiter: passthrough,
  };
} else {
  const { RedisStore } = require('rate-limit-redis');
  const { getRedisClient, sendRedisCommand } = require('../config/redis');

  /**
   * Store factory: attaches RedisStore backed by shared Redis cluster,
   * otherwise falls back cleanly to express-rate-limit's default in-memory store.
   */
  const createStore = (prefix) => {
    const client = getRedisClient();
    if (client) {
      return new RedisStore({
        sendCommand: (...args) => sendRedisCommand(args),
        prefix: `stayverse:rl:${prefix}:`,
      });
    }
    return undefined;
  };

  /**
   * Identifies users by authenticated user ID if logged in,
   * otherwise falls back to client IP address.
   */
  const resolveKey = (prefix) => (req) => {
    const userId = req.user?._id || req.user?.id;
    if (userId) {
      return `user:${userId}:${prefix}`;
    }
    return `ip:${req.ip || 'unknown'}:${prefix}`;
  };

  /**
   * Custom 429 response handler providing unified JSON payload for API requests
   * and standard error template rendering for browser requests.
   */
  const createLimitHandler = (friendlyMessage, windowMinutes) => (req, res, next, options) => {
    const isApi =
      req.originalUrl.startsWith('/api') ||
      req.xhr ||
      req.headers.accept?.includes('application/json');

    const retryAfterSeconds = Math.ceil(options.windowMs / 1000);

    const errorResponse = {
      success: false,
      statusCode: 429,
      error: 'Too Many Requests',
      message: `${friendlyMessage} Please wait ${windowMinutes} minute${windowMinutes > 1 ? 's' : ''} before trying again.`,
      retryAfterSeconds,
    };

    res.status(429);
    if (isApi) {
      return res.json(errorResponse);
    }

    res.render('errors/error', {
      title: 'Too Many Requests — 429',
      statusCode: 429,
      message: errorResponse.message,
      error: errorResponse,
    });
  };

  /**
   * 1. Authentication Limiter
   * Stricter limit applied to login, registration, password resets, and token validations.
   * Max 10 requests per 15 minutes.
   */
  const authLimiter = rateLimit({
    store: createStore('auth'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    keyGenerator: resolveKey('auth'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    handler: createLimitHandler('Too many authentication attempts.', 15),
  });

  /**
   * 2. Booking Limiter
   * Protects booking creation, cancellation, and deletion endpoints.
   * Max 20 requests per 10 minutes.
   */
  const bookingLimiter = rateLimit({
    store: createStore('booking'),
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20,
    keyGenerator: resolveKey('booking'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    handler: createLimitHandler('Too many booking requests or modifications.', 10),
  });

  /**
   * 3. Property Mutation Limiter
   * Restricts property creation, updates, and deletion.
   * Max 25 requests per 15 minutes.
   */
  const propertyMutationLimiter = rateLimit({
    store: createStore('prop_mut'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25,
    keyGenerator: resolveKey('prop_mut'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    handler: createLimitHandler('Too many property modifications.', 15),
  });

  /**
   * 4. Property Browsing & Search Limiter
   * High-throughput limit for listing, searching, nearby exploration, and GeoJSON feeds.
   * Max 120 requests per minute.
   */
  const propertyBrowseLimiter = rateLimit({
    store: createStore('prop_browse'),
    windowMs: 60 * 1000, // 1 minute
    max: 120,
    keyGenerator: resolveKey('prop_browse'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    handler: createLimitHandler('High search frequency detected.', 1),
  });

  /**
   * 5. Review Limiter
   * Protects against review spam, automated ratings, and fraudulent deletions.
   * Max 20 requests per 15 minutes.
   */
  const reviewLimiter = rateLimit({
    store: createStore('review'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    keyGenerator: resolveKey('review'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    handler: createLimitHandler('Too many review submissions.', 15),
  });

  /**
   * 6. Global API Limiter
   * Sensible blanket protection for general API endpoints.
   * Max 300 requests per 15 minutes.
   */
  const globalApiLimiter = rateLimit({
    store: createStore('global_api'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    keyGenerator: resolveKey('global_api'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true,
    validate: { keyGeneratorIpFallback: false },
    handler: createLimitHandler('API rate limit threshold exceeded.', 15),
  });

  module.exports = {
    authLimiter,
    bookingLimiter,
    propertyMutationLimiter,
    propertyBrowseLimiter,
    reviewLimiter,
    globalApiLimiter,
  };
}
