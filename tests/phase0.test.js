const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');

describe('PHASE 0: Foundation, Architecture, & Error Handling', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await connectDB(uri);
  });

  afterAll(async () => {
    await disconnectDB();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Health and System Routes', () => {
    it('GET /health should return 200 OK with health status JSON', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('GET / should return 200 OK and render the StayVerse home page', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Stay');
      expect(res.text).toContain('Verse');
    });
  });

  describe('Centralized Error Handling', () => {
    it('GET /api/unhandled-route should return 404 JSON response for API requests', async () => {
      const res = await request(app)
        .get('/api/unhandled-route')
        .set('Accept', 'application/json');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('statusCode', 404);
      expect(res.body.message).toMatch(/Page Not Found/);
    });

    it('GET /random-page-does-not-exist should render 404 HTML error page for browser requests', async () => {
      const res = await request(app).get('/random-page-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('404');
      expect(res.text).toContain('Page Not Found');
    });
  });

  describe('Database Connection Module', () => {
    it('should be connected to MongoDB in test environment', () => {
      expect(mongoose.connection.readyState).toBe(1); // 1 = connected
    });
  });
});
