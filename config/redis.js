require('dotenv').config();
const { createClient } = require('redis');

/**
 * Reusable Redis Client Configuration using the official 'redis' npm package.
 * Implements safe connection pooling, automatic reconnection backoff,
 * and resilient error isolation so failures never crash the Express application.
 */

const rawUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisUrl = rawUrl.replace(/^redis-cli\s+-u\s+/i, '').trim();
const isEnabled = process.env.REDIS_ENABLED !== 'false';

let client = null;
let connectPromise = null;
let isConnected = false;

const getRedisClient = () => {
  if (!isEnabled) return null;

  if (!client) {
    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 3000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            return new Error('Max Redis reconnection attempts reached');
          }
          return Math.min(retries * 200, 1000);
        },
      },
    });

    client.on('connect', () => {
      isConnected = true;
      if (process.env.NODE_ENV !== 'test') {
        console.log('[StayVerse Redis] Connected successfully');
      }
    });

    client.on('ready', () => {
      isConnected = true;
    });

    client.on('error', (err) => {
      isConnected = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[StayVerse Redis] Warning: ${err.message}. Operating in fallback mode.`);
      }
    });

    client.on('end', () => {
      isConnected = false;
    });

    // Asynchronous background connect
    connectPromise = client.connect().catch((err) => {
      isConnected = false;
    });
  }

  return client;
};

/**
 * Executes a raw Redis command with automatic connection resolution.
 */
const sendRedisCommand = async (args) => {
  const redisClient = getRedisClient();
  if (!redisClient) throw new Error('Redis not enabled');
  if (connectPromise && !redisClient.isOpen) {
    try {
      await connectPromise;
    } catch (err) {
      // let sendCommand handle or reject cleanly
    }
  }
  return redisClient.sendCommand(args);
};

const isRedisReady = () => isEnabled && isConnected && client !== null && client.isOpen;

const disconnectRedis = async () => {
  if (client && client.isOpen) {
    try {
      await client.quit();
    } catch (err) {
      client.disconnect();
    } finally {
      isConnected = false;
      client = null;
      connectPromise = null;
    }
  }
};

module.exports = {
  getRedisClient,
  sendRedisCommand,
  isRedisReady,
  disconnectRedis,
};
