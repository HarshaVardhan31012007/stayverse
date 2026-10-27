const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const Property = require('../models/Property');

describe('MODULE 3: Geospatial Mapping & 2dsphere Proximity Search', () => {
  let mongoServer;
  let host;
  let propGoa, propMumbai, propDelhi;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    host = await User.create({
      name: 'Geo Host',
      email: 'geohost@test.com',
      password: 'password123',
      role: 'host',
    });

    // 1. Goa Property (lng: 73.8567, lat: 15.4909)
    propGoa = await Property.create({
      title: 'Goa Coastal Villa',
      description: 'Right on the beach in Goa.',
      pricePerNight: 12000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [73.8567, 15.4909],
      },
      address: '10 Candolim Road',
      city: 'Goa',
      country: 'India',
      host: host._id,
    });

    // 2. Mumbai Property (~400 km north of Goa: lng: 72.8777, lat: 19.0760)
    propMumbai = await Property.create({
      title: 'Mumbai Sea-Facing Apartment',
      description: 'Luxury skyline apartment in Bandra.',
      pricePerNight: 15000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.0760],
      },
      address: '45 Bandra West',
      city: 'Mumbai',
      country: 'India',
      host: host._id,
    });

    // 3. New Delhi Property (~1,500 km north: lng: 77.2090, lat: 28.6139)
    propDelhi = await Property.create({
      title: 'Delhi Heritage Haveli',
      description: 'Historic villa in central Delhi.',
      pricePerNight: 9000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [77.2090, 28.6139],
      },
      address: '12 Connaught Place',
      city: 'New Delhi',
      country: 'India',
      host: host._id,
    });

    // Ensure 2dsphere index is built
    await Property.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('GeoJSON Endpoint for MapLibre Vector Discovery', () => {
    it('returns a valid GeoJSON FeatureCollection with coordinates and metadata', async () => {
      const res = await request(app).get('/api/properties/geojson');

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
      expect(res.body.features.length).toBe(3);

      const firstFeature = res.body.features[0];
      expect(firstFeature.geometry.type).toBe('Point');
      expect(firstFeature.geometry.coordinates).toHaveLength(2);
      expect(firstFeature.properties).toHaveProperty('title');
      expect(firstFeature.properties).toHaveProperty('price');
    });
  });

  describe('2dsphere $near Proximity Search', () => {
    it('finds properties within 50km of Panaji, Goa (returns Goa villa, excludes Mumbai & Delhi)', async () => {
      // Panaji, Goa coordinates: lng 73.8278, lat 15.4989
      const res = await request(app)
        .get('/api/properties')
        .query({
          lng: 73.8278,
          lat: 15.4989,
          radius: 50, // 50km
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Goa Coastal Villa');
    });

    it('orders results by proximity distance when searching wider radius', async () => {
      // Search from Pune (between Goa and Mumbai): lng 73.8567, lat 18.5204
      const res = await request(app)
        .get('/api/properties')
        .query({
          lng: 73.8567,
          lat: 18.5204,
          radius: 600, // 600km: includes both Mumbai (~120km) and Goa (~360km)
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);

      // Mumbai is much closer to Pune (~120km) than Goa (~360km)
      expect(res.body.data[0].title).toBe('Mumbai Sea-Facing Apartment');
      expect(res.body.data[1].title).toBe('Goa Coastal Villa');
    });
  });
});
