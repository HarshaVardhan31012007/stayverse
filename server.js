require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

const PORT = process.env.PORT || 3000;

// Connect to Database and start Express server
const startServer = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
    } else {
      console.warn('[StayVerse DB] Warning: MONGODB_URI not defined. Database skipped in standalone mode.');
    }

    const server = app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 StayVerse Server running on port ${PORT}`);
      console.log(`🌐 Local: http://localhost:${PORT}`);
      console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=========================================`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n[StayVerse] Received ${signal}. Initiating graceful shutdown...`);
      server.close(async () => {
        await disconnectDB();
        console.log('[StayVerse] HTTP server and database connections closed. Bye!');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error(`[StayVerse] Fatal Startup Error: ${error.message}`);
    process.exit(1);
  }
};

startServer();
