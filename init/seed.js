require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Property = require('../models/Property');
const Review = require('../models/Review');
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

    // 3. Clear existing properties & reviews
    await Property.deleteMany({});
    await Review.deleteMany({});
    console.log('[StayVerse Seed] Cleared existing property and review collections');

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
        comment: 'Exceeded all expectations. The architecture and lighting create a wonderful ambience. Waking up to these views was pure luxury. Will definitely book again next season.',
      },
      {
        rating: 4,
        comment: 'Great value for money. Very private, spotless bathrooms, and serene atmosphere. Minor road construction nearby during the day, but our overall stay was thoroughly peaceful.',
      },
    ];

    const createdProperties = [];

    for (let idx = 0; idx < rawListings.length; idx++) {
      const item = rawListings[idx];
      const coords = item.geometry && item.geometry.coordinates ? item.geometry.coordinates : [-118.7798, 34.0259];
      const amenitiesList = standardAmenities[idx % standardAmenities.length];

      const prop = await Property.create({
        title: item.title,
        description: item.description,
        pricePerNight: item.price || 8500,
        priceUnit: idx % 4 === 0 ? 'day' : 'night',
        address: `${100 + idx} Coastal Avenue`,
        city: item.location || 'Malibu',
        country: item.country || 'United States',
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

      // Create 2-3 genuine guest reviews for each property from different travelers
      const reviewCountForStay = 2 + (idx % 3);
      for (let r = 0; r < reviewCountForStay; r++) {
        const traveler = travelers[(idx + r) % travelers.length];
        const reviewTemplate = sampleReviewsData[(idx + r) % sampleReviewsData.length];

        await Review.create({
          property: prop._id,
          user: traveler._id,
          rating: reviewTemplate.rating,
          comment: reviewTemplate.comment,
        });
      }
    }

    console.log(`[StayVerse Seed] Successfully seeded ${createdProperties.length} properties with genuine reviews and calculated ratings!`);

    await disconnectDB();
    console.log('[StayVerse Seed] Seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('[StayVerse Seed] Error during seeding:', error.message);
    process.exit(1);
  }
};

seedDatabase();
