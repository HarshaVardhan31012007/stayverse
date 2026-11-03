const Redis = require('ioredis');

/**
 * StayVerse Redis Cache Service
 * Provides robust cache-aside helper methods with automatic TTL expiration,
 * wildcard pattern invalidation, and graceful failover when Redis is unreachable.
 */

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isEnabled = process.env.REDIS_ENABLED !== 'false';
    const rawUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redisUrl = rawUrl.replace(/^redis-cli\s+-u\s+/i, '').trim();

    if (this.isEnabled) {
      this._initClient();
    }
  }

  _initClient() {
    try {
      const keyPrefix = process.env.NODE_ENV === 'test' ? 'stayverse:test:' : 'stayverse:';
      this.client = new Redis(this.redisUrl, {
        keyPrefix,
        lazyConnect: true,
        enableOfflineQueue: false, // Prevents queuing when disconnected
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop reconnecting after 3 attempts, fallback cleanly
          }
          return Math.min(times * 300, 1500);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        if (this.client && this.client.stream && typeof this.client.stream.unref === 'function') {
          this.client.stream.unref();
        }
        if (process.env.NODE_ENV !== 'test') {
          console.log('[StayVerse Cache] Redis client connected');
        }
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        if (this.client && this.client.stream && typeof this.client.stream.unref === 'function') {
          this.client.stream.unref();
        }
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        // Log cleanly without throwing unhandled exceptions
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`[StayVerse Cache] Redis unavailable (${err.code || err.message}). Operating in direct database mode.`);
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      // Attempt async background connect
      this.client.connect().catch(() => {
        this.isConnected = false;
      });
    } catch (err) {
      this.isConnected = false;
    }
  }

  /**
   * Check if cache is active and available
   */
  isAvailable() {
    return this.isEnabled && this.isConnected && this.client !== null;
  }

  /**
   * Retrieve cached value by key
   */
  async get(key) {
    if (!this.isAvailable()) return null;
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }

  /**
   * Set cached value with TTL in seconds
   */
  async set(key, value, ttlSeconds = 300) {
    if (!this.isAvailable()) return false;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete a specific cache key
   */
  async del(key) {
    if (!this.isAvailable()) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete all keys matching a wildcard pattern (e.g. "property:list:*")
   */
  async delByPattern(pattern) {
    if (!this.isAvailable()) return false;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Flush all Redis keys (testing or manual clear)
   */
  async flushAll() {
    if (!this.isAvailable()) return false;
    try {
      await this.client.flushdb();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Disconnect Redis cleanly on server shutdown
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (err) {
        this.client.disconnect();
      }
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
module.exports = cacheService;
