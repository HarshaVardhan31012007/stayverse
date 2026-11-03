require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('./models/Property');
const User = require('./models/User');
const Booking = require('./models/Booking');
const { generateToken } = require('./utils/generateToken');

async function runConcurrencyTest() {
  console.log('====================================================');
  console.log('       STAYVERSE CONCURRENCY TEST (LOCALHOST)       ');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[1/4] Connected to MongoDB Atlas Replica Set.');

  // Find 2 different traveler accounts
  const travelers = await User.find({ role: 'traveler' }).limit(2);
  if (travelers.length < 2) {
    console.error('Error: Need at least 2 travelers in database to simulate concurrency.');
    process.exit(1);
  }

  // Find a property
  const prop = await Property.findOne({ host: { $nin: [travelers[0]._id, travelers[1]._id] } });
  if (!prop) {
    console.error('Error: Property not found.');
    process.exit(1);
  }

  const token1 = generateToken(travelers[0]);
  const token2 = generateToken(travelers[1]);

  // Test dates in future
  const testCheckIn = '2027-04-10';
  const testCheckOut = '2027-04-15';

  // Clean up any existing booking in this test date window
  await Booking.deleteMany({
    property: prop._id,
    checkIn: { $gte: new Date('2027-04-01'), $lte: new Date('2027-04-30') },
  });

  console.log(`[2/4] Target Property: "${prop.title}" (${prop.city})`);
  console.log(`      Traveler A: ${travelers[0].email}`);
  console.log(`      Traveler B: ${travelers[1].email}`);
  console.log(`      Target Dates: ${testCheckIn} -> ${testCheckOut} (OVERLAPPING!)\n`);

  console.log('[3/4] Firing two parallel HTTP POST requests to localhost:3000 at the EXACT same millisecond...');

  const tStart = Date.now();

  const reqA = fetch(`http://localhost:3000/properties/${prop._id}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': `token=${token1}`,
    },
    body: JSON.stringify({
      checkIn: testCheckIn,
      checkOut: testCheckOut,
      guests: 2,
    }),
  });

  const reqB = fetch(`http://localhost:3000/properties/${prop._id}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': `token=${token2}`,
    },
    body: JSON.stringify({
      checkIn: '2027-04-12', // overlaps with April 10-15!
      checkOut: '2027-04-14',
      guests: 1,
    }),
  });

  // Run both requests in true concurrency
  const [resA, resB] = await Promise.all([reqA, reqB]);
  const jsonA = await resA.json();
  const jsonB = await resB.json();
  const durationMs = Date.now() - tStart;

  console.log(`\n[4/4] Both requests finished in ${durationMs}ms.\n`);
  console.log('----------------------------------------------------');
  console.log('RESULTS:');
  console.log(`Traveler A: HTTP ${resA.status} -> ${jsonA.message || (jsonA.success ? 'Confirmed' : JSON.stringify(jsonA))}`);
  console.log(`Traveler B: HTTP ${resB.status} -> ${jsonB.message || (jsonB.success ? 'Confirmed' : JSON.stringify(jsonB))}`);
  console.log('----------------------------------------------------\n');

  if ((resA.status === 201 && resB.status === 400) || (resA.status === 400 && resB.status === 201)) {
    console.log('SUCCESS! Concurrency isolation worked:');
    console.log('-> Exactly ONE reservation was confirmed.');
    console.log('-> The second simultaneous reservation was safely REJECTED without double-booking!\n');
  } else if (resA.status === 201 && resB.status === 201) {
    console.log('RACE CONDITION DETECTED:');
    console.log('-> Both bookings were confirmed for overlapping dates (Double-Booking)!');
  }

  // Clean up test bookings
  await Booking.deleteMany({
    property: prop._id,
    checkIn: { $gte: new Date('2027-04-01'), $lte: new Date('2027-04-30') },
  });
  await mongoose.disconnect();
}

runConcurrencyTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
