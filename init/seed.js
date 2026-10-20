require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Property = require('../models/Property');
const { connectDB, disconnectDB } = require('../config/db');

// Sample listings with GeoJSON coordinates
const rawListings = require('./data.js').data;

const seedDatabase = async () => {
  try {
    console.log('[StayVerse Seed] Connecting to MongoDB...');
    await connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stayverse');

    // 1. Create default demo host
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

    // 2. Clear existing properties
    await Property.deleteMany({});
    console.log('[StayVerse Seed] Cleared existing property listings');

    // 3. Map listings to StayVerse schema
    const standardAmenities = [
      ['WiFi', 'Kitchen', 'Ocean View', 'Air Conditioning'],
      ['WiFi', 'Dedicated Workspace', 'Gym', 'City Skyline'],
      ['WiFi', 'Fireplace', 'Mountain View', 'Hot Tub'],
      ['WiFi', 'Pool', 'Vineyard View', 'Wine Cellar'],
      ['WiFi', 'Beachfront', 'Infinity Pool', 'Cabana'],
    ];

    const propertiesToInsert = rawListings.map((item, idx) => {
      const coords = item.geometry && item.geometry.coordinates ? item.geometry.coordinates : [-118.7798, 34.0259];
      const amenitiesList = standardAmenities[idx % standardAmenities.length];

      return {
        title: item.title,
        description: item.description,
        pricePerNight: item.price || 150,
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
        averageRating: parseFloat((4.2 + (idx % 7) * 0.1).toFixed(1)),
        reviewCount: 5 + (idx * 3) % 40,
      };
    });

    await Property.insertMany(propertiesToInsert);
    console.log(`[StayVerse Seed] Successfully seeded ${propertiesToInsert.length} properties with MapLibre coordinates!`);

    await disconnectDB();
    console.log('[StayVerse Seed] Seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('[StayVerse Seed] Error during seeding:', error.message);
    process.exit(1);
  }
};

seedDatabase();
