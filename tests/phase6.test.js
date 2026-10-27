const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const Property = require('../models/Property');
const propertyService = require('../services/propertyService');

describe('MODULE 6: Smart Proximity & Quality Recommendations', () => {
  let mongoServer;
  let host;
  let baseProperty, nearbySimilar, distantExpensive, nearbyDifferentPrice;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    host = await User.create({
      name: 'Recommendation Host',
      email: 'rec_host@test.com',
      password: 'password123',
      role: 'host',
    });

    // Base property in Goa at ₹10,000/night
    baseProperty = await Property.create({
      title: 'Base Luxury Villa',
      description: 'Original viewing listing.',
      pricePerNight: 10000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [73.8567, 15.4909],
      },
      address: 'Beach Rd 1',
      city: 'Goa',
      country: 'India',
      averageRating: 4.8,
      reviewCount: 10,
      host: host._id,
    });

    // Nearby property in Goa with similar price (₹11,000) -> Prime recommendation
    nearbySimilar = await Property.create({
      title: 'Nearby Sunny Cottage',
      description: 'Similar proximity and price tier.',
      pricePerNight: 11000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [73.8600, 15.5000],
      },
      address: 'Beach Rd 2',
      city: 'Goa',
      country: 'India',
      averageRating: 4.9,
      reviewCount: 15,
      host: host._id,
    });

    // Far away property with very different price (₹35,000 in Delhi)
    distantExpensive = await Property.create({
      title: 'Ultra Luxury Delhi Palace',
      description: 'Distant and outside price tier.',
      pricePerNight: 35000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [77.2090, 28.6139],
      },
      address: 'Delhi VIP Sector',
      city: 'New Delhi',
      country: 'India',
      averageRating: 5.0,
      reviewCount: 20,
      host: host._id,
    });

    await Property.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Recommendation Engine Logic', () => {
    it('returns similar stays excluding the current property', async () => {
      const recs = await propertyService.getRecommendations(baseProperty._id, 3);

      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThanOrEqual(1);

      // Must never recommend the property itself
      const selfIncluded = recs.some((p) => p._id.toString() === baseProperty._id.toString());
      expect(selfIncluded).toBe(false);

      // Nearby similar stay should be the top match
      expect(recs[0].title).toBe('Nearby Sunny Cottage');
    });

    it('injects recommendations into single property API details response', async () => {
      const res = await request(app).get(`/api/properties/${baseProperty._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('recommendations');
      expect(Array.isArray(res.body.recommendations)).toBe(true);
      expect(res.body.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(res.body.recommendations[0].title).toBe('Nearby Sunny Cottage');
    });
  });
});
