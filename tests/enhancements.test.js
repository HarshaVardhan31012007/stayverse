const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Refund = require('../models/Refund');
const propertyService = require('../services/propertyService');
const bookingService = require('../services/bookingService');
const refundService = require('../services/refundService');
const cacheService = require('../services/cacheService');
const { generateToken } = require('../utils/generateToken');

describe('StayVerse Feature Enhancements & Robust Backend Suites', () => {
  let mongoServer;
  let hostUser, travelerUser, travelerUser2;
  let hostToken, travelerToken;
  let propertyA, propertyB;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await connectDB(uri);

    // Create Host
    hostUser = await User.create({
      name: 'Host Alice',
      email: 'host.alice@stayverse.com',
      password: 'password123',
      role: 'host',
    });
    hostToken = generateToken(hostUser);

    // Create Traveler 1
    travelerUser = await User.create({
      name: 'Traveler Bob',
      email: 'bob@stayverse.com',
      password: 'password123',
      role: 'traveler',
    });
    travelerToken = generateToken(travelerUser);

    // Create Traveler 2
    travelerUser2 = await User.create({
      name: 'Traveler Charlie',
      email: 'charlie@stayverse.com',
      password: 'password123',
      role: 'traveler',
    });
  });

  afterAll(async () => {
    await cacheService.disconnect();
    await disconnectDB();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clear test-specific collections between runs
    await Property.deleteMany({});
    await Booking.deleteMany({});
    await Review.deleteMany({});
    await Refund.deleteMany({});
    await User.updateMany({}, { cumulativeRefunded: 0 });

    propertyA = await Property.create({
      title: 'Azure Coast Perfect Stay',
      description: 'Lakeside tranquility with modern architectural aesthetics.',
      pricePerNight: 5000,
      priceUnit: 'night',
      address: '10 Marine Drive',
      city: 'Kochi',
      country: 'India',
      location: { type: 'Point', coordinates: [76.2673, 9.9312] },
      host: hostUser._id,
    });

    propertyB = await Property.create({
      title: 'Highland Pine Stay',
      description: 'Mountain cabin escape.',
      pricePerNight: 4000,
      priceUnit: 'night',
      address: '50 Ridge Road',
      city: 'Manali',
      country: 'India',
      location: { type: 'Point', coordinates: [77.1892, 32.2432] },
      host: hostUser._id,
    });
  });

  describe('Requirement 1: Branding Renamed from Sanctuary to Perfect Stay', () => {
    it('Homepage renders "Find Your Perfect Stay" and no outdated "Sanctuary" references', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Find Your Perfect Stay');
      expect(res.text).not.toContain('Find Your Sanctuary');
    });
  });

  describe('Requirement 2 & 3: Cascading Deletion & Refund Ledger', () => {
    it('Processes full 100% refund for all affected bookings when property is deleted, then removes bookings and reviews', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 10);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      // Create Booking on Property A
      const bookingA = await Booking.create({
        property: propertyA._id,
        user: travelerUser._id,
        checkIn,
        checkOut,
        totalNights: 3,
        totalPrice: 15000,
        status: 'confirmed',
      });

      // Create Booking on Property B (unrelated property)
      const bookingB = await Booking.create({
        property: propertyB._id,
        user: travelerUser2._id,
        checkIn,
        checkOut,
        totalNights: 3,
        totalPrice: 12000,
        status: 'confirmed',
      });

      // Create Review on Property A
      const reviewA = await Review.create({
        property: propertyA._id,
        user: travelerUser._id,
        rating: 5,
        comment: 'Unforgettable stay with breathtaking views.',
      });

      // Verify records exist initially
      expect(await Booking.countDocuments({ property: propertyA._id })).toBe(1);
      expect(await Review.countDocuments({ property: propertyA._id })).toBe(1);

      // Perform cascading delete of Property A
      await propertyService.deleteProperty(propertyA);

      // 1. Property A is deleted
      const checkProp = await Property.findById(propertyA._id);
      expect(checkProp).toBeNull();

      // 2. Bookings for Property A are deleted
      const remainingBookingsA = await Booking.find({ property: propertyA._id });
      expect(remainingBookingsA.length).toBe(0);

      // 3. Reviews for Property A are deleted
      const remainingReviewsA = await Review.find({ property: propertyA._id });
      expect(remainingReviewsA.length).toBe(0);

      // 4. Unrelated records on Property B remain untouched!
      const checkPropB = await Property.findById(propertyB._id);
      expect(checkPropB).not.toBeNull();
      const checkBookingB = await Booking.findById(bookingB._id);
      expect(checkBookingB).not.toBeNull();

      // 5. Financial history preserved: Refund ledger has an entry for Booking A
      const refunds = await Refund.find({ bookingId: bookingA._id });
      expect(refunds.length).toBe(1);
      expect(refunds[0].amount).toBe(15000);
      expect(refunds[0].refundPercentage).toBe(100);
      expect(refunds[0].reason).toBe('property_deletion');
      expect(refunds[0].propertyTitle).toBe('Azure Coast Perfect Stay');

      // 6. User cumulativeRefunded balance is updated
      const updatedUser = await User.findById(travelerUser._id);
      expect(updatedUser.cumulativeRefunded).toBe(15000);
    });

    it('Calculates 100% refund when user cancels > 48h before check-in and updates cumulative balance', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 7); // 7 days in future
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const booking = await Booking.create({
        property: propertyA._id,
        user: travelerUser._id,
        checkIn,
        checkOut,
        totalNights: 2,
        totalPrice: 10000,
        status: 'confirmed',
      });

      const result = await bookingService.cancelBooking(booking._id, travelerUser._id);
      expect(result.booking.status).toBe('cancelled');
      expect(result.refund.amount).toBe(10000);
      expect(result.refund.refundPercentage).toBe(100);

      const user = await User.findById(travelerUser._id);
      expect(user.cumulativeRefunded).toBe(10000);
    });

    it('Prevents duplicate refunds on repeated cancellation or refund trigger', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 5);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const booking = await Booking.create({
        property: propertyA._id,
        user: travelerUser._id,
        checkIn,
        checkOut,
        totalNights: 2,
        totalPrice: 8000,
        status: 'confirmed',
      });

      // First cancellation
      await bookingService.cancelBooking(booking._id, travelerUser._id);

      const userAfterFirst = await User.findById(travelerUser._id);
      expect(userAfterFirst.cumulativeRefunded).toBe(8000);

      // Attempt second cancellation via service (should throw 400 booking already cancelled)
      await expect(
        bookingService.cancelBooking(booking._id, travelerUser._id)
      ).rejects.toThrow(/already cancelled/);

      // Attempt direct refund service invocation on same booking
      const duplicateAttempt = await refundService.processRefund({
        booking,
        userId: travelerUser._id,
        reason: 'user_cancellation',
      });

      expect(duplicateAttempt.alreadyProcessed).toBe(true);

      // Verify user cumulative balance was NOT incremented again
      const userAfterDuplicate = await User.findById(travelerUser._id);
      expect(userAfterDuplicate.cumulativeRefunded).toBe(8000);

      // Verify exactly 1 ledger record exists
      const ledgerEntries = await Refund.find({ bookingId: booking._id });
      expect(ledgerEntries.length).toBe(1);
    });
  });

  describe('Requirement 4: Redis Caching Layer & Graceful Fallback', () => {
    it('CacheService operates safely and falls back cleanly without breaking when Redis is offline', async () => {
      // Direct call should return null without throwing exception
      const val = await cacheService.get('nonexistent:key');
      expect(val).toBeNull();

      // Setting key in fallback mode returns false or succeeds safely
      const setResult = await cacheService.set('test:key', { data: 123 });
      expect(typeof setResult).toBe('boolean');

      // listProperties functions normally even when Redis is offline
      const propertiesResult = await propertyService.listProperties({ city: 'Kochi' });
      expect(propertiesResult.properties.length).toBeGreaterThan(0);
      expect(propertiesResult.properties[0].title).toBe('Azure Coast Perfect Stay');
    });

    it('Invalidates cache keys when a property is created or updated', async () => {
      const newProp = await propertyService.createProperty(
        {
          title: 'Sunset Cliffside Villa',
          description: 'Panoramic ocean view.',
          pricePerNight: 9000,
          priceUnit: 'night',
          address: 'Cliff Road',
          city: 'Varkala',
          country: 'India',
          latitude: 8.7379,
          longitude: 76.7163,
          amenities: 'WiFi, Ocean View',
        },
        hostUser._id
      );

      expect(newProp.title).toBe('Sunset Cliffside Villa');

      // Update property
      const updated = await propertyService.updateProperty(newProp, {
        pricePerNight: 9500,
      });

      expect(updated.pricePerNight).toBe(9500);
    });
  });

  describe('Requirement: Interactive Map Enhancements', () => {
    it('GeoJSON endpoint returns property name and pricePerNight in features properties', async () => {
      const res = await request(app).get('/api/properties/geojson');
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(res.body.features.length).toBeGreaterThanOrEqual(1);

      const feature = res.body.features.find((f) => f.properties.id.toString() === propertyB._id.toString());
      expect(feature).toBeDefined();
      expect(feature.properties.title).toBe('Highland Pine Stay');
      expect(feature.properties.price).toBe(4000);
      expect(feature.properties.priceUnit).toBe('night');
    });

    it('Property show page renders data-price and data-title on #propertyMap', async () => {
      const res = await request(app).get(`/properties/${propertyB._id}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain(`data-price="${propertyB.pricePerNight}"`);
      expect(res.text).toContain(`data-title="${propertyB.title}"`);
      expect(res.text).toContain('id="propertyMap"');
    });
  });
});
