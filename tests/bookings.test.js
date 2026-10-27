const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { generateToken } = require('../utils/generateToken');

describe('Traveler Bookings & Review Eligibility Integration Tests', () => {
  let mongoServer;
  let hostUser, hostToken;
  let traveler1, traveler1Token;
  let traveler2, traveler2Token;
  let testProperty;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create Host
    hostUser = await User.create({
      name: 'Host User',
      email: 'host@test.com',
      password: 'password123',
      role: 'host',
    });
    hostToken = generateToken(hostUser);

    // Create Travelers
    traveler1 = await User.create({
      name: 'Traveler One',
      email: 'traveler1@test.com',
      password: 'password123',
      role: 'traveler',
    });
    traveler1Token = generateToken(traveler1);

    traveler2 = await User.create({
      name: 'Traveler Two',
      email: 'traveler2@test.com',
      password: 'password123',
      role: 'traveler',
    });
    traveler2Token = generateToken(traveler2);

    // Create Property
    testProperty = await Property.create({
      title: 'Oceanview Sanctuary',
      description: 'Stunning oceanside villa with panoramic views.',
      pricePerNight: 8000,
      priceUnit: 'night',
      location: {
        type: 'Point',
        coordinates: [73.8567, 15.4909],
      },
      address: '12 Beach Road',
      city: 'Goa',
      country: 'India',
      host: hostUser._id,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Booking Creation & Concurrency/Overlap Check', () => {
    it('prevents host from booking their own listing', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const afterTomorrow = new Date(tomorrow);
      afterTomorrow.setDate(afterTomorrow.getDate() + 3);

      const res = await request(app)
        .post(`/properties/${testProperty._id}/bookings`)
        .set('Cookie', [`token=${hostToken}`])
        .set('Accept', 'application/json')
        .send({
          checkIn: tomorrow.toISOString().split('T')[0],
          checkOut: afterTomorrow.toISOString().split('T')[0],
          guests: 2,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot book their own property/i);
    });

    it('allows a traveler to book available dates', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 5);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const res = await request(app)
        .post(`/properties/${testProperty._id}/bookings`)
        .set('Cookie', [`token=${traveler1Token}`])
        .set('Accept', 'application/json')
        .send({
          checkIn: checkIn.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          guests: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalNights).toBe(3);
      expect(res.body.data.totalPrice).toBe(24000);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('rejects overlapping reservation for the same property', async () => {
      const overlapIn = new Date();
      overlapIn.setDate(overlapIn.getDate() + 6); // falls within +5 to +8
      const overlapOut = new Date(overlapIn);
      overlapOut.setDate(overlapOut.getDate() + 4);

      const res = await request(app)
        .post(`/properties/${testProperty._id}/bookings`)
        .set('Cookie', [`token=${traveler2Token}`])
        .set('Accept', 'application/json')
        .send({
          checkIn: overlapIn.toISOString().split('T')[0],
          checkOut: overlapOut.toISOString().split('T')[0],
          guests: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already reserved/i);
    });
  });

  describe('Traveler Bookings Dashboard', () => {
    it('returns the traveler bookings list', async () => {
      const res = await request(app)
        .get('/dashboard/traveler')
        .set('Cookie', [`token=${traveler1Token}`])
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].property._id.toString()).toBe(testProperty._id.toString());
    });
  });

  describe('Review Rules: Only Booked and Ended Stays', () => {
    it('blocks a traveler from reviewing if they have never booked the stay', async () => {
      const res = await request(app)
        .post(`/properties/${testProperty._id}/reviews`)
        .set('Cookie', [`token=${traveler2Token}`])
        .set('Accept', 'application/json')
        .send({
          rating: 5,
          comment: 'Never stayed here but writing a fake review.',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/only review properties that you have booked/i);
    });

    it('blocks a traveler from reviewing if their booking is upcoming (stay not ended)', async () => {
      // traveler1 has an upcoming booking from day +5 to +8
      const res = await request(app)
        .post(`/properties/${testProperty._id}/reviews`)
        .set('Cookie', [`token=${traveler1Token}`])
        .set('Accept', 'application/json')
        .send({
          rating: 5,
          comment: 'Reviewing before check-in.',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/once your checkout date has passed/i);
    });

    it('allows review after the booking has completed and ended', async () => {
      // Create a completed booking in the past for traveler2
      const pastStart = new Date();
      pastStart.setDate(pastStart.getDate() - 10);
      const pastEnd = new Date();
      pastEnd.setDate(pastEnd.getDate() - 4);

      await Booking.create({
        property: testProperty._id,
        user: traveler2._id,
        checkIn: pastStart,
        checkOut: pastEnd,
        totalNights: 6,
        totalPrice: testProperty.pricePerNight * 6,
        guests: 2,
        status: 'confirmed',
      });

      const res = await request(app)
        .post(`/properties/${testProperty._id}/reviews`)
        .set('Cookie', [`token=${traveler2Token}`])
        .set('Accept', 'application/json')
        .send({
          rating: 5,
          comment: 'We had an unforgettable experience! Pristine location and thoughtful amenities.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);

      // Verify that property averageRating updated
      const updatedProp = await Property.findById(testProperty._id);
      expect(updatedProp.averageRating).toBe(5);
      expect(updatedProp.reviewCount).toBe(1);
    });

    it('blocks duplicate reviews from the same traveler on the same property', async () => {
      const res = await request(app)
        .post(`/properties/${testProperty._id}/reviews`)
        .set('Cookie', [`token=${traveler2Token}`])
        .set('Accept', 'application/json')
        .send({
          rating: 4,
          comment: 'Trying to leave a second review.',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already submitted a review/i);
    });
  });
});
