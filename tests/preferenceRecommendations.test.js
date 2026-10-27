const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const Property = require('../models/Property');
const propertyService = require('../services/propertyService');

describe('Personalized Preference Recommendation Engine', () => {
  let mongoServer;
  let host;
  let traveler;
  let warangalStay, goaStay, manaliStay, luxuryPenthouse;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    host = await User.create({
      name: 'Host Partner',
      email: 'rec_host_test@test.com',
      password: 'password123',
      role: 'host',
    });

    traveler = await User.create({
      name: 'Harsha Traveler',
      email: 'harsha_rec@test.com',
      password: 'password123',
      role: 'traveler',
    });

    // 1. Heritage property in Warangal, India - Budget ₹3,200
    warangalStay = await Property.create({
      title: 'Heritage Haveli near Warangal Fort',
      description: 'Historic haveli with traditional stone architecture, courtyard and Fort views.',
      pricePerNight: 3200,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [79.5941, 17.9784],
      },
      address: 'Fort Road',
      city: 'Warangal',
      country: 'India',
      amenities: ['WiFi', 'Air Conditioning', 'Free Parking'],
      averageRating: 4.9,
      reviewCount: 14,
      host: host._id,
    });

    // 2. Beach villa in Goa, India - ₹12,000
    goaStay = await Property.create({
      title: 'Beachfront Villa in North Goa',
      description: 'Stunning beachfront villa with private beach access and infinity pool.',
      pricePerNight: 12000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [73.7520, 15.5520],
      },
      address: 'Baga Coast',
      city: 'Goa',
      country: 'India',
      amenities: ['WiFi', 'Pool', 'Ocean View', 'Air Conditioning'],
      averageRating: 4.8,
      reviewCount: 22,
      host: host._id,
    });

    // 3. Mountain Chalet in Manali, India - ₹6,500
    manaliStay = await Property.create({
      title: 'Himalayan Chalet in Manali',
      description: 'Cozy pine cabin with log fireplace and panoramic mountain views.',
      pricePerNight: 6500,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [77.1887, 32.2396],
      },
      address: 'Old Manali',
      city: 'Manali',
      country: 'India',
      amenities: ['WiFi', 'Fireplace', 'Mountain View', 'Free Parking'],
      averageRating: 4.7,
      reviewCount: 9,
      host: host._id,
    });

    // 4. Ultra luxury penthouse in Dubai - International ₹35,000
    luxuryPenthouse = await Property.create({
      title: 'Skyline Luxury Penthouse',
      description: 'Downtown modern penthouse with private elevator and city skyline views.',
      pricePerNight: 35000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [55.2708, 25.2048],
      },
      address: 'Downtown Dubai',
      city: 'Dubai',
      country: 'UAE',
      amenities: ['WiFi', 'Pool', 'Dedicated Workspace', 'Gym'],
      averageRating: 5.0,
      reviewCount: 30,
      host: host._id,
    });

    await Property.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Algorithm Scoring & Matching Logic', () => {
    it('ranks Warangal heritage haveli #1 when traveler prefers Heritage vibe in India within budget', async () => {
      const recs = await propertyService.getPreferenceRecommendations({
        vibe: 'heritage',
        region: 'india',
        minPrice: 1000,
        maxPrice: 5000,
        amenities: ['WiFi', 'Air Conditioning'],
      });

      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThanOrEqual(1);

      // Top recommendation must be the Warangal stay
      const topMatch = recs[0];
      expect(topMatch.property._id.toString()).toBe(warangalStay._id.toString());
      expect(topMatch.matchPercentage).toBeGreaterThanOrEqual(85);
      expect(topMatch.matchGrade).toMatch(/Exceptional|Great/);

      // Check match reasons
      expect(topMatch.matchReasons.length).toBeGreaterThan(0);
      const reasonsText = topMatch.matchReasons.join(' ');
      expect(reasonsText).toMatch(/budget|heritage|india|amenities/i);
    });

    it('ranks Goa beachfront villa #1 when traveler prefers Beach vibe', async () => {
      const recs = await propertyService.getPreferenceRecommendations({
        vibe: 'beach',
        region: 'india',
        minPrice: 8000,
        maxPrice: 15000,
      });

      expect(recs.length).toBeGreaterThanOrEqual(1);
      expect(recs[0].property._id.toString()).toBe(goaStay._id.toString());
      expect(recs[0].matchPercentage).toBeGreaterThanOrEqual(80);
    });

    it('filters out non-Indian properties when region is set to India', async () => {
      const recs = await propertyService.getPreferenceRecommendations({
        region: 'india',
      });

      const hasDubai = recs.some((r) => r.property.country === 'UAE');
      expect(hasDubai).toBe(false);
    });

    it('filters out Indian properties when region is set to International', async () => {
      const recs = await propertyService.getPreferenceRecommendations({
        region: 'international',
      });

      const hasIndia = recs.some((r) => r.property.country === 'India');
      expect(hasIndia).toBe(false);
      expect(recs[0].property.country).toBe('UAE');
    });

    it('filters strictly by minimum rating when specified', async () => {
      const recs = await propertyService.getPreferenceRecommendations({
        minRating: 4.9,
      });

      // Only properties with averageRating >= 4.9 should be returned (Warangal 4.9 and Dubai 5.0)
      recs.forEach((r) => {
        expect(r.property.averageRating).toBeGreaterThanOrEqual(4.9);
      });
    });

    it('filters properties strictly within the specified radius distance from traveler location', async () => {
      // Traveler is in Warangal, searching within 50 km radius
      const recs = await propertyService.getPreferenceRecommendations({
        userLat: 17.9784,
        userLng: 79.5941,
        radius: 50,
      });

      expect(recs.length).toBe(1);
      expect(recs[0].property.title).toContain('Warangal');
      expect(recs[0].distanceKm).toBeLessThanOrEqual(50);
      expect(recs[0].matchReasons.some(r => r.includes('Within your 50 km radius'))).toBe(true);

      // Expanding radius to 1000 km includes Goa (~750 km) but not Manali (~1600 km) or Dubai
      const expandedRecs = await propertyService.getPreferenceRecommendations({
        userLat: 17.9784,
        userLng: 79.5941,
        radius: 1000,
      });

      expect(expandedRecs.length).toBe(2);
      const cities = expandedRecs.map(r => r.property.city);
      expect(cities).toContain('Warangal');
      expect(cities).toContain('Goa');
      expect(cities).not.toContain('Manali');
    });
  });

  describe('HTTP Endpoints (/recommendations)', () => {
    it('GET /recommendations renders HTML page with status 200', async () => {
      const res = await request(app).get('/recommendations');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Stays Matched to');
      expect(res.text).toContain('Customize Your Stay Preferences');
    });

    it('GET /api/recommendations returns JSON format with scored recommendations', async () => {
      const res = await request(app)
        .get('/api/recommendations?vibe=heritage&region=india&maxPrice=5000')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('matchPercentage');
      expect(res.body.data[0]).toHaveProperty('matchReasons');
    });

    it('POST /recommendations/preferences saves preference cookie', async () => {
      const res = await request(app)
        .post('/recommendations/preferences')
        .send({
          vibe: 'mountain',
          region: 'india',
          minPrice: 2000,
          maxPrice: 10000,
          amenities: ['WiFi', 'Fireplace'],
        });

      expect(res.status).toBe(302); // Redirect back with cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.includes('stayverse_preferences'))).toBe(true);
    });
  });
});
