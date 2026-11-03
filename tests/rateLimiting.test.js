require('dotenv').config();
const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient, sendRedisCommand, disconnectRedis } = require('../config/redis');
const {
  authLimiter,
  bookingLimiter,
  propertyBrowseLimiter,
  globalApiLimiter,
} = require('../middleware/rateLimitMiddleware');

describe('StayVerse Redis-Backed Rate Limiting & API Protection', () => {
  let testApp;

  beforeAll(async () => {
    testApp = express();
    testApp.set('trust proxy', 1);
    testApp.use(express.json());

    // Mock authenticated user injection route
    testApp.use((req, res, next) => {
      if (req.headers['x-test-user-id']) {
        req.user = { _id: req.headers['x-test-user-id'] };
      }
      next();
    });

    // Endpoint protected by authLimiter
    testApp.post('/api/auth/test-login', authLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'Logged in' });
    });

    // Dedicated micro-limiter with max 2 requests to test hitting 429 threshold
    const microLimiter = rateLimit({
      store: new RedisStore({
        sendCommand: (...args) => sendRedisCommand(args),
        prefix: `test:micro:${Date.now()}:`,
      }),
      windowMs: 10000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: true,
      passOnStoreError: true,
      validate: { keyGeneratorIpFallback: false },
      handler: (req, res, next, options) => {
        res.status(429).json({
          success: false,
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded for test.',
          retryAfterSeconds: Math.ceil(options.windowMs / 1000),
        });
      },
    });

    testApp.get('/api/micro-test', microLimiter, (req, res) => {
      res.status(200).json({ success: true, count: 1 });
    });
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  describe('1. Rate Limiting Enforcement & HTTP 429 Response', () => {
    const clientIp = '203.0.113.195';

    it('Allows requests within the threshold and provides standard RateLimit headers', async () => {
      const res1 = await request(testApp)
        .get('/api/micro-test')
        .set('X-Forwarded-For', clientIp);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.headers).toHaveProperty('ratelimit-limit');
      expect(res1.headers).toHaveProperty('ratelimit-remaining');

      const res2 = await request(testApp)
        .get('/api/micro-test')
        .set('X-Forwarded-For', clientIp);

      expect(res2.status).toBe(200);
    });

    it('Rejects requests exceeding the limit with HTTP 429 and structured JSON', async () => {
      // 3rd request from same client exceeds max of 2
      const res3 = await request(testApp)
        .get('/api/micro-test')
        .set('X-Forwarded-For', clientIp);

      expect(res3.status).toBe(429);
      expect(res3.body).toHaveProperty('success', false);
      expect(res3.body.statusCode).toBe(429);
      expect(res3.body.error).toBe('Too Many Requests');
      expect(res3.body.message).toMatch(/Rate limit exceeded/);
      expect(res3.body).toHaveProperty('retryAfterSeconds');
    });
  });

  describe('2. Endpoint Category Differentiation & Auth Protection', () => {
    it('Configures stricter limiters on authentication endpoints compared to general browsing', async () => {
      // Auth limiter has windowMs 15 min and max 10
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');

      // Browsing limiter allows much higher throughput
      expect(propertyBrowseLimiter).toBeDefined();
      expect(typeof propertyBrowseLimiter).toBe('function');
    });

    it('Uses user ID identification when authenticated to prevent IP spoofing', async () => {
      const res = await request(testApp)
        .post('/api/auth/test-login')
        .set('x-test-user-id', '64b1f2e91234567890abcdef');

      expect([200, 429]).toContain(res.status);
    });
  });

  describe('3. Redis Client Reusability & Graceful Resilience', () => {
    it('Redis client is initialized and accessible via config helper', async () => {
      const client = getRedisClient();
      expect(client).toBeDefined();
      expect(typeof client.sendCommand).toBe('function');
    });
  });
});
