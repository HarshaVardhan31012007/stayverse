require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('Usage: node utils/resetPassword.js <email> <newPassword>');
    console.log('Example: node utils/resetPassword.js hv1900019@gmail.com StayVersePass123');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters long.');
    process.exit(1);
  }

  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stayverse';
    await connectDB(uri);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.error(`❌ User with email "${email}" not found in database.`);
      process.exit(1);
    }

    user.password = newPassword;
    await user.save(); // triggers pre-save bcrypt hash hook

    console.log(`\n✅ Password successfully updated for: ${user.name} (${user.email})`);
    console.log(`🔑 New Password: ${newPassword}`);
    console.log(`Role: ${user.role}\n`);
  } catch (err) {
    console.error('❌ Failed to reset password:', err.message);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

resetPassword();
