require('dotenv').config();
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');

describe('StayVerse User Profile Management & Security', () => {
  let mongoServer;
  let testUser;
  let userToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    testUser = await User.create({
      name: 'Harsha Verified',
      email: 'harsha.profile@example.com',
      password: 'OldPassword123',
      role: 'traveler',
      cumulativeRefunded: 14000,
    });

    userToken = generateToken(testUser._id, testUser.role);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('1. Profile Page Access Control', () => {
    it('Redirects unauthenticated users to the login portal with 302', async () => {
      const res = await request(app).get('/profile');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/login');
    });

    it('Renders user profile with name, email, verified badge, and stats for authenticated user', async () => {
      const res = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${userToken}`]);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Harsha Verified');
      expect(res.text).toContain('harsha.profile@example.com');
      expect(res.text).toContain('Personal Details');
      expect(res.text).toContain('Security & Password');
      expect(res.text).toContain('14,000'); // Cumulative refunded balance
    });
  });

  describe('2. Profile Details Modification', () => {
    it('Updates user name successfully and redirects with confirmation', async () => {
      const res = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${userToken}`])
        .send({
          name: 'Harsha Master Traveler',
          email: 'harsha.profile@example.com',
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/profile');

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.name).toBe('Harsha Master Traveler');
    });

    it('Rejects profile update with empty name', async () => {
      const res = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${userToken}`])
        .send({
          name: '',
          email: 'harsha.profile@example.com',
        });

      expect(res.status).toBe(302);
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.name).toBe('Harsha Master Traveler');
    });
  });

  describe('3. Password Change & Security', () => {
    it('Rejects password change if current password is wrong', async () => {
      const res = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${userToken}`])
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'NewSecurePassword123',
          confirmPassword: 'NewSecurePassword123',
        });

      expect(res.status).toBe(302);
      const freshUser = await User.findById(testUser._id).select('+password');
      const isMatch = await freshUser.comparePassword('NewSecurePassword123');
      expect(isMatch).toBe(false);
    });

    it('Successfully updates password when current password matches', async () => {
      const res = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${userToken}`])
        .send({
          currentPassword: 'OldPassword123',
          newPassword: 'NewSecurePassword123',
          confirmPassword: 'NewSecurePassword123',
        });

      expect(res.status).toBe(302);
      const freshUser = await User.findById(testUser._id).select('+password');
      const isMatch = await freshUser.comparePassword('NewSecurePassword123');
      expect(isMatch).toBe(true);
    });
  });
});

