const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Property = require('../models/Property');
const { connectDB, disconnectDB } = require('../config/db');

describe('MODULE 2: Property Management (CRUD, Ownership RBAC, Filters, Uploads)', () => {
  let mongoServer;
  let host1Token, host1User;
  let host2Token, host2User;
  let travelerToken, travelerUser;

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
    await Property.deleteMany({});
    await User.deleteMany({});

    // Create Host 1
    const h1Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Host Alice',
        email: 'alice@host.com',
        password: 'password123',
        role: 'host',
      })
      .set('Accept', 'application/json');
    host1Token = h1Res.body.token;
    host1User = h1Res.body.user;

    // Create Host 2
    const h2Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Host Bob',
        email: 'bob@host.com',
        password: 'password123',
        role: 'host',
      })
      .set('Accept', 'application/json');
    host2Token = h2Res.body.token;
    host2User = h2Res.body.user;

    // Create Traveler
    const tRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Traveler Charlie',
        email: 'charlie@travel.com',
        password: 'password123',
        role: 'traveler',
      })
      .set('Accept', 'application/json');
    travelerToken = tRes.body.token;
    travelerUser = tRes.body.user;
  });

  describe('1. Property Creation & Validation', () => {
    it('should allow a verified host to create a new property with valid data', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${host1Token}`)
        .send({
          title: 'Seaside Sanctuary Villa',
          description: 'A stunning modern oceanfront escape with floor-to-ceiling glass.',
          pricePerNight: 350,
          address: '400 Pacific Coast Hwy',
          city: 'Malibu',
          country: 'United States',
          latitude: 34.0259,
          longitude: -118.7798,
          amenities: 'WiFi, Pool, Hot Tub, Ocean View',
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Seaside Sanctuary Villa');
      expect(res.body.data.pricePerNight).toBe(350);
      expect(res.body.data.priceUnit).toBe('night'); // Default unit
      expect(res.body.data.location.type).toBe('Point');
      expect(res.body.data.location.coordinates).toEqual([-118.7798, 34.0259]);
      expect(res.body.data.host.toString()).toBe(host1User.id);
    });

    it('should allow setting custom priceUnit (e.g. per day or per week)', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${host1Token}`)
        .send({
          title: 'Daily Event Villa',
          description: 'Spacious villa available for day events or stays.',
          pricePerNight: 500,
          priceUnit: 'day',
          address: '50 Sunset Blvd',
          city: 'Los Angeles',
          country: 'United States',
          latitude: 34.0928,
          longitude: -118.3287,
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.data.priceUnit).toBe('day');
    });

    it('should reject creation without authentication (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/properties')
        .send({
          title: 'Unauthenticated Stay',
          description: 'Valid description text here',
          pricePerNight: 100,
          address: '123 St',
          city: 'Austin',
          country: 'USA',
          latitude: 30.2672,
          longitude: -97.7431,
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });

    it('should reject creation when requested by a traveler (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          title: 'Traveler Listing Attempt',
          description: 'Valid description text here',
          pricePerNight: 100,
          address: '123 St',
          city: 'Austin',
          country: 'USA',
          latitude: 30.2672,
          longitude: -97.7431,
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/restricted to \[host\] accounts only/i);
    });

    it('should reject invalid input data (price <= 0 or invalid coords) with 400 Bad Request', async () => {
      // Negative price
      const res1 = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${host1Token}`)
        .send({
          title: 'Invalid Price Stay',
          description: 'Valid description',
          pricePerNight: -50,
          address: '123 St',
          city: 'Miami',
          country: 'USA',
          latitude: 25.7617,
          longitude: -80.1918,
        })
        .set('Accept', 'application/json');
      expect(res1.status).toBe(400);

      // Invalid latitude (> 90)
      const res2 = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${host1Token}`)
        .send({
          title: 'Invalid Lat Stay',
          description: 'Valid description',
          pricePerNight: 150,
          address: '123 St',
          city: 'Miami',
          country: 'USA',
          latitude: 120.5,
          longitude: -80.1918,
        })
        .set('Accept', 'application/json');
      expect(res2.status).toBe(400);
    });

    it('should support multipart file upload with property images', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${host1Token}`)
        .field('title', 'Mountain View Cabin')
        .field('description', 'Rustic alpine cabin nestled in the pines.')
        .field('pricePerNight', 220)
        .field('address', '77 Alpine Way')
        .field('city', 'Aspen')
        .field('country', 'United States')
        .field('latitude', 39.1911)
        .field('longitude', -106.8175)
        .attach('images', Buffer.from('fake-image-bytes'), 'cabin.jpg')
        .set('Accept', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.data.images.length).toBeGreaterThan(0);
      expect(res.body.data.images[0]).toHaveProperty('url');
    });
  });

  describe('2. Property Read, Search, Sort & Pagination', () => {
    beforeEach(async () => {
      // Seed 3 properties
      await Property.create([
        {
          title: 'Alpine Chalet',
          description: 'Snowy cabin in the peaks',
          pricePerNight: 120,
          address: '10 Peak St',
          city: 'Denver',
          country: 'USA',
          location: { type: 'Point', coordinates: [-104.9903, 39.7392] },
          amenities: ['WiFi', 'Kitchen'],
          host: host1User.id,
          averageRating: 4.8,
          reviewCount: 15,
        },
        {
          title: 'Sunny Beachfront Condo',
          description: 'Right on the sand with panoramic ocean sunsets',
          pricePerNight: 280,
          address: '200 Ocean Dr',
          city: 'Miami',
          country: 'USA',
          location: { type: 'Point', coordinates: [-80.13, 25.79] },
          amenities: ['Pool', 'WiFi', 'Beach Access'],
          host: host1User.id,
          averageRating: 4.2,
          reviewCount: 8,
        },
        {
          title: 'Downtown Luxury Loft',
          description: 'High ceiling industrial penthouse',
          pricePerNight: 450,
          address: '50 Wall St',
          city: 'New York',
          country: 'USA',
          location: { type: 'Point', coordinates: [-74.006, 40.7128] },
          amenities: ['WiFi', 'Gym', 'Workspace'],
          host: host2User.id,
          averageRating: 4.9,
          reviewCount: 30,
        },
      ]);
    });

    it('should list all properties with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/properties?page=1&limit=2')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
      expect(res.body.pagination.hasNextPage).toBe(true);
    });

    it('should search properties by keyword', async () => {
      const res = await request(app)
        .get('/api/properties?search=beachfront')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Sunny Beachfront Condo');
    });

    it('should sort properties by price: low to high', async () => {
      const res = await request(app)
        .get('/api/properties?sort=price-asc')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data[0].pricePerNight).toBe(120);
      expect(res.body.data[2].pricePerNight).toBe(450);
    });

    it('should return single property details by ID with populated host', async () => {
      const prop = await Property.findOne({ title: 'Alpine Chalet' });
      const res = await request(app)
        .get(`/api/properties/${prop._id}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Alpine Chalet');
      expect(res.body.data.host.name).toBe('Host Alice');
    });

    it('should return 404 Not Found for non-existent property ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/properties/${fakeId}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(404);
    });
  });

  describe('3. Ownership Authorization (Update & Delete)', () => {
    let createdProperty;

    beforeEach(async () => {
      createdProperty = await Property.create({
        title: 'Original Property by Alice',
        description: 'Original description',
        pricePerNight: 200,
        address: '100 Main St',
        city: 'Seattle',
        country: 'USA',
        location: { type: 'Point', coordinates: [-122.3321, 47.6062] },
        host: host1User.id,
      });
    });

    it('should allow the owner host to update the property', async () => {
      const res = await request(app)
        .put(`/api/properties/${createdProperty._id}`)
        .set('Authorization', `Bearer ${host1Token}`)
        .send({
          title: 'Updated Modern Villa by Alice',
          description: 'Updated description',
          pricePerNight: 260,
          address: '100 Main St',
          city: 'Seattle',
          country: 'USA',
          latitude: 47.6062,
          longitude: -122.3321,
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Modern Villa by Alice');
      expect(res.body.data.pricePerNight).toBe(260);
    });

    it('should PREVENT another host from editing someone else\'s property (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/properties/${createdProperty._id}`)
        .set('Authorization', `Bearer ${host2Token}`)
        .send({
          title: 'Hacked Title Attempt',
          description: 'Unauthorized edit',
          pricePerNight: 1,
          address: '100 Main St',
          city: 'Seattle',
          country: 'USA',
          latitude: 47.6062,
          longitude: -122.3321,
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission to modify this property/i);

      // Verify DB unchanged
      const unchanged = await Property.findById(createdProperty._id);
      expect(unchanged.title).toBe('Original Property by Alice');
    });

    it('should PREVENT a traveler from editing a property (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/properties/${createdProperty._id}`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          title: 'Traveler Edit Attempt',
          description: 'Unauthorized edit',
          pricePerNight: 50,
          address: '100 Main St',
          city: 'Seattle',
          country: 'USA',
          latitude: 47.6062,
          longitude: -122.3321,
        })
        .set('Accept', 'application/json');

      expect(res.status).toBe(403);
    });

    it('should PREVENT another host from deleting someone else\'s property (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/properties/${createdProperty._id}`)
        .set('Authorization', `Bearer ${host2Token}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission to modify this property/i);

      // Verify property still exists
      const stillExists = await Property.findById(createdProperty._id);
      expect(stillExists).not.toBeNull();
    });

    it('should allow the owner host to delete their own property', async () => {
      const res = await request(app)
        .delete(`/api/properties/${createdProperty._id}`)
        .set('Authorization', `Bearer ${host1Token}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted from DB
      const deleted = await Property.findById(createdProperty._id);
      expect(deleted).toBeNull();
    });
  });
});
