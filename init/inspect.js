require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Property = require('../models/Property');
const Review = require('../models/Review');
const { connectDB, disconnectDB } = require('../config/db');

async function inspectDatabase() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stayverse';
    const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    
    console.log('\n======================================================');
    console.log('             STAYVERSE DATABASE OVERVIEW              ');
    console.log('======================================================');
    console.log(`📡 Cluster URI : ${maskedUri}`);

    await connectDB(uri);

    const dbName = mongoose.connection.name;
    console.log(`✅ Status      : Connected`);
    console.log(`📂 Database    : ${dbName}\n`);

    // 1. Users
    const userCount = await User.countDocuments();
    const hosts = await User.countDocuments({ role: 'host' });
    const travelers = await User.countDocuments({ role: 'traveler' });
    console.log(`------------------------------------------------------`);
    console.log(`👤 USERS COLLECTION (${userCount} total: ${hosts} hosts, ${travelers} travelers)`);
    console.log(`------------------------------------------------------`);
    const sampleUsers = await User.find({}).limit(6).select('name email role');
    sampleUsers.forEach((u) => {
      console.log(`  • ${u.name.padEnd(16)} | ${u.email.padEnd(24)} | [${u.role.toUpperCase()}]`);
    });

    // 2. Properties
    const propertyCount = await Property.countDocuments();
    console.log(`\n------------------------------------------------------`);
    console.log(`🏡 PROPERTIES COLLECTION (${propertyCount} total)`);
    console.log(`------------------------------------------------------`);
    const sampleProperties = await Property.find({}).limit(5).select('title city country pricePerNight priceUnit averageRating reviewCount');
    if (sampleProperties.length === 0) {
      console.log('  (No properties found. Run: npm run seed)');
    } else {
      sampleProperties.forEach((p, idx) => {
        const rateUnit = p.priceUnit ? p.priceUnit : 'night';
        const formattedPrice = p.pricePerNight ? `₹${p.pricePerNight.toLocaleString('en-IN')}` : 'N/A';
        const ratingStr = p.averageRating ? `⭐ ${p.averageRating.toFixed(1)}/5` : '⭐ New';
        console.log(`  ${idx + 1}. "${p.title}"`);
        console.log(`     📍 ${p.city}, ${p.country}`);
        console.log(`     💰 ${formattedPrice} / ${rateUnit}`);
        console.log(`     📊 ${ratingStr} (${p.reviewCount || 0} reviews)`);
      });
    }

    // 3. Reviews
    const reviewCount = await Review.countDocuments();
    console.log(`\n------------------------------------------------------`);
    console.log(`💬 REVIEWS COLLECTION (${reviewCount} total)`);
    console.log(`------------------------------------------------------`);
    const sampleReviews = await Review.find({}).populate('user', 'name').limit(4);
    if (sampleReviews.length === 0) {
      console.log('  (No reviews yet)');
    } else {
      sampleReviews.forEach((r, idx) => {
        const authorName = r.user ? r.user.name : 'Verified Guest';
        console.log(`  ${idx + 1}. [${'⭐'.repeat(r.rating)}] by ${authorName}`);
        console.log(`     "${r.comment.slice(0, 80)}${r.comment.length > 80 ? '...' : ''}"`);
      });
    }

    // 4. Bookings
    const Booking = require('../models/Booking');
    const bookingCount = await Booking.countDocuments();
    const upcomingBookings = await Booking.countDocuments({ checkIn: { $gt: new Date() }, status: 'confirmed' });
    const pastBookings = await Booking.countDocuments({ checkOut: { $lte: new Date() }, status: 'confirmed' });
    console.log(`\n------------------------------------------------------`);
    console.log(`🧳 BOOKINGS COLLECTION (${bookingCount} total: ${upcomingBookings} upcoming, ${pastBookings} completed)`);
    console.log(`------------------------------------------------------`);
    const sampleBookings = await Booking.find({}).populate('user', 'name').populate('property', 'title city').limit(4);
    sampleBookings.forEach((b, idx) => {
      const guest = b.user ? b.user.name : 'Guest';
      const propTitle = b.property ? b.property.title : 'Property';
      const inDate = new Date(b.checkIn).toLocaleDateString();
      const outDate = new Date(b.checkOut).toLocaleDateString();
      console.log(`  ${idx + 1}. ${guest} -> "${propTitle}" | ${inDate} to ${outDate} [${b.status.toUpperCase()}]`);
    });

    console.log('\n======================================================\n');
  } catch (error) {
    console.error('\n❌ Database Connection Failed:');
    console.error(error.message);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

inspectDatabase();
