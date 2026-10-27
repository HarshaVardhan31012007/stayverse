require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Property = require('../models/Property');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const { connectDB, disconnectDB } = require('../config/db');

// Sample listings with GeoJSON coordinates and realistic pricing
const rawListings = require('./data.js').data;

const seedDatabase = async () => {
  try {
    console.log('[StayVerse Seed] Connecting to MongoDB...');
    await connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stayverse');

    // 1. Create Demo Host
    let demoHost = await User.findOne({ email: 'host@stayverse.com' });
    if (!demoHost) {
      demoHost = await User.create({
        name: 'Elena Rostova',
        email: 'host@stayverse.com',
        password: 'HostPassword123',
        role: 'host',
      });
      console.log('[StayVerse Seed] Created demo host: host@stayverse.com (password: HostPassword123)');
    }

    // 2. Create Demo Verified Travelers for Authentic Reviews
    const demoTravelers = [
      { name: 'Harsha', email: 'hv31012007@gmail.com', password: 'HarshaPass123', role: 'traveler' },
      { name: 'Rahul Sharma', email: 'rahul@stayverse.com', password: 'TravelerPass123', role: 'traveler' },
      { name: 'Priya Patel', email: 'priya@stayverse.com', password: 'TravelerPass123', role: 'traveler' },
      { name: 'Ananya Sen', email: 'ananya@stayverse.com', password: 'TravelerPass123', role: 'traveler' },
      { name: 'Marcus Vance', email: 'marcus@stayverse.com', password: 'TravelerPass123', role: 'traveler' },
      { name: 'Sarah Jenkins', email: 'sarah@stayverse.com', password: 'TravelerPass123', role: 'traveler' },
    ];

    const travelers = [];
    for (const t of demoTravelers) {
      let u = await User.findOne({ email: t.email });
      if (!u) {
        u = await User.create(t);
      }
      travelers.push(u);
    }
    console.log(`[StayVerse Seed] Verified ${travelers.length} guest traveler accounts.`);

    // 3. Clear existing properties, reviews, and bookings
    await Property.deleteMany({});
    await Review.deleteMany({});
    await Booking.deleteMany({});
    console.log('[StayVerse Seed] Cleared existing property, review, and booking collections');

    // 4. Map and insert listings
    const standardAmenities = [
      ['WiFi', 'Kitchen', 'Ocean View', 'Air Conditioning', 'Free Parking'],
      ['WiFi', 'Dedicated Workspace', 'Gym', 'City Skyline', 'Kitchen'],
      ['WiFi', 'Fireplace', 'Mountain View', 'Hot Tub', 'Ski Storage'],
      ['WiFi', 'Pool', 'Vineyard View', 'Wine Cellar', 'Chef Kitchen'],
      ['WiFi', 'Beachfront', 'Infinity Pool', 'Cabana', 'Ocean View'],
    ];

    const sampleReviewsData = [
      {
        rating: 5,
        comment: 'Absolutely breathtaking! The sunset views from the terrace are unforgettable. Impeccably clean, seamless keyless check-in, and the host was responsive within minutes.',
      },
      {
        rating: 5,
        comment: 'One of the best stays we have ever experienced! The kitchen was fully equipped with premium cookware, beds were cloud-soft, and the neighborhood is wonderfully tranquil.',
      },
      {
        rating: 4,
        comment: 'Stunning property in a prime location. Close to local cafes and scenic trails. Internet was fast and reliable for remote work. Highly recommended for couples or families!',
      },
      {
        rating: 5,
        comment: 'Exceptional architectural detailing and secluded privacy. The host provided great local dining recommendations and check-in was instantaneous. 10/10 stay.',
      },
    ];

    const createdProperties = [];

    for (let idx = 0; idx < rawListings.length; idx++) {
      const item = rawListings[idx];
      const amenitiesList = standardAmenities[idx % standardAmenities.length];

      // Default safe coordinates fallback if missing or corrupt
      let coords = [77.209, 28.6139]; // Default: New Delhi
      if (item.geometry && Array.isArray(item.geometry.coordinates) && item.geometry.coordinates.length === 2) {
        coords = item.geometry.coordinates;
      }

      const prop = await Property.create({
        title: item.title,
        description: item.description,
        pricePerNight: item.price || 5000,
        priceUnit: 'night',
        address: `${idx + 10} Scenic Boulevard`,
        city: item.location || 'Goa',
        country: item.country || 'India',
        location: {
          type: 'Point',
          coordinates: coords, // [longitude, latitude]
        },
        images: [
          {
            url: (item.image && item.image.url) ? item.image.url : 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
            filename: (item.image && item.image.filename) ? item.image.filename : 'stayverse-seed',
          },
        ],
        amenities: amenitiesList,
        host: demoHost._id,
        averageRating: 0,
        reviewCount: 0,
      });

      createdProperties.push(prop);

      // Create 2 genuine past completed bookings and reviews for each property
      const reviewCountForStay = 2 + (idx % 2);
      for (let r = 0; r < reviewCountForStay; r++) {
        // Pick demo travelers (skipping Harsha for initial reviews so Harsha has fresh unreviewed stays)
        const demoGuests = travelers.filter(u => u.email !== 'hv31012007@gmail.com');
        const traveler = demoGuests[(idx + r) % demoGuests.length];
        const reviewTemplate = sampleReviewsData[(idx + r) % sampleReviewsData.length];

        // Completed booking in the past
        const pastCheckIn = new Date();
        pastCheckIn.setDate(pastCheckIn.getDate() - (40 + r * 10));
        const pastCheckOut = new Date(pastCheckIn);
        pastCheckOut.setDate(pastCheckOut.getDate() + 4);

        await Booking.create({
          property: prop._id,
          user: traveler._id,
          checkIn: pastCheckIn,
          checkOut: pastCheckOut,
          totalNights: 4,
          totalPrice: prop.pricePerNight * 4,
          guests: 2,
          status: 'confirmed',
        });

        await Review.create({
          property: prop._id,
          user: traveler._id,
          rating: reviewTemplate.rating,
          comment: reviewTemplate.comment,
        });
      }
    }

    // Seed specific test bookings for Harsha (hv31012007@gmail.com)
    const harshaUser = travelers.find(u => u.email === 'hv31012007@gmail.com');
    if (harshaUser && createdProperties.length >= 2) {
      // 1. Completed stay (checkout was 3 days ago) -> Eligible to write a review!
      const pastStart = new Date();
      pastStart.setDate(pastStart.getDate() - 7);
      const pastEnd = new Date();
      pastEnd.setDate(pastEnd.getDate() - 3);

      await Booking.create({
        property: createdProperties[0]._id,
        user: harshaUser._id,
        checkIn: pastStart,
        checkOut: pastEnd,
        totalNights: 4,
        totalPrice: createdProperties[0].pricePerNight * 4,
        guests: 2,
        status: 'confirmed',
      });

      // 2. Upcoming stay (starts in 10 days) -> Shows in dashboard, review is locked until checkout!
      const futureStart = new Date();
      futureStart.setDate(futureStart.getDate() + 10);
      const futureEnd = new Date(futureStart);
      futureEnd.setDate(futureEnd.getDate() + 5);

      await Booking.create({
        property: createdProperties[1]._id,
        user: harshaUser._id,
        checkIn: futureStart,
        checkOut: futureEnd,
        totalNights: 5,
        totalPrice: createdProperties[1].pricePerNight * 5,
        guests: 3,
        status: 'confirmed',
      });

      console.log(`[StayVerse Seed] Seeded 1 completed stay (eligible for review) & 1 upcoming trip for Harsha (${harshaUser.email})!`);
    }

    console.log(`[StayVerse Seed] Successfully seeded ${createdProperties.length} properties with completed bookings, verified reviews, and traveler itineraries!`);

    await disconnectDB();
    console.log('[StayVerse Seed] Seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('[StayVerse Seed] Error during seeding:', error.message);
    process.exit(1);
  }
};

seedDatabase();
