const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');

describe('MODULE 1: Authentication & Security (JWT, bcrypt, RBAC)', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());
  });

  afterAll(async () => {
    await disconnectDB();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('1. User Registration', () => {
    it('should register a new traveler successfully and return JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Traveler',
          email: 'jane@example.com',
          password: 'password123',
          role: 'traveler',
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toMatchObject({
        name: 'Jane Traveler',
        email: 'jane@example.com',
        role: 'traveler',
      });
      // Security: password must NEVER be in response
      expect(res.body.user.password).toBeUndefined();

      // Check database directly: password must be hashed with bcrypt
      const dbUser = await User.findOne({ email: 'jane@example.com' }).select('+password');
      expect(dbUser).not.toBeNull();
      expect(dbUser.password).not.toBe('password123');
      expect(dbUser.password).toMatch(/^\$2[aby]\$/);
    });

    it('should register a new host successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob Host',
          email: 'bob@stayverse.com',
          password: 'securepassword',
          role: 'host',
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('host');
    });

    it('should reject duplicate email with 409 Conflict', async () => {
      await User.create({
        name: 'Existing User',
        email: 'existing@stayverse.com',
        password: 'password123',
        role: 'traveler',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: 'existing@stayverse.com',
          password: 'password123',
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should reject invalid input with 400 Bad Request', async () => {
      // Short password (< 6 chars)
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test@example.com',
          password: '123',
        })
        .set('Accept', 'application/json');
      expect(res1.status).toBe(400);

      // Invalid email
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'not-an-email',
          password: 'password123',
        })
        .set('Accept', 'application/json');
      expect(res2.status).toBe(400);
    });
  });

  describe('2. User Login & Verification', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Alice Cooper',
        email: 'alice@example.com',
        password: 'alicepassword',
        role: 'traveler',
      });
    });

    it('should log in with correct credentials and set JWT cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'alicepassword',
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject login with incorrect password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'wrongpassword',
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email or password/i);
    });

    it('should reject login with non-existent email with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ghost@example.com',
          password: 'password123',
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });
  });

  describe('3. JWT Authentication Middleware & Protected Routes', () => {
    let travelerToken;
    let hostToken;

    beforeEach(async () => {
      const travelerRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Traveler Tom',
          email: 'tom@example.com',
          password: 'password123',
          role: 'traveler',
        })
        .set('Accept', 'application/json');
      travelerToken = travelerRes.body.token;

      const hostRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Host Helen',
          email: 'helen@example.com',
          password: 'password123',
          role: 'host',
        })
        .set('Accept', 'application/json');
      hostToken = hostRes.body.token;
    });

    it('should reject access to protected route when no token is provided (401)', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('should grant access to protected route with valid Bearer token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${travelerToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('tom@example.com');
    });

    it('should grant access via token cookie', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', [`token=${travelerToken}`])
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('tom@example.com');
    });

    it('should enforce role-based authorization (requireRole)', async () => {
      // Traveler accessing host-only route should receive 403 Forbidden
      const travelerAttempt = await request(app)
        .get('/auth/host-only')
        .set('Authorization', `Bearer ${travelerToken}`)
        .set('Accept', 'application/json');

      expect(travelerAttempt.status).toBe(403);
      expect(travelerAttempt.body.message).toMatch(/Access restricted to \[host\] accounts only/i);

      // Host accessing host-only route should succeed
      const hostAttempt = await request(app)
        .get('/auth/host-only')
        .set('Authorization', `Bearer ${hostToken}`)
        .set('Accept', 'application/json');

      expect(hostAttempt.status).toBe(200);
      expect(hostAttempt.body.message).toBe('Welcome to host portal');
    });

    it('should clear token on logout', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.headers['set-cookie'][0]).toMatch(/token=;/);
    });
  });
});
