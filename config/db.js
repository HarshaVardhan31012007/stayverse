const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * @param {string} uri - Optional MongoDB URI (defaults to process.env.MONGODB_URI)
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async (uri = process.env.MONGODB_URI) => {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[StayVerse DB] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[StayVerse DB] Connection Error: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[StayVerse DB] MongoDB Connection closed');
  } catch (error) {
    console.error(`[StayVerse DB] Disconnect Error: ${error.message}`);
  }
};

module.exports = { connectDB, disconnectDB };
