/**
 * Jest Global Teardown
 * Disconnects all shared Redis connections to prevent Jest from hanging
 * due to open event-loop handles (sockets, timers).
 */
module.exports = async () => {
  try {
    const { disconnectRedis } = require('../config/redis');
    await disconnectRedis();
  } catch (_) {
    // config/redis may not have been initialised — ignore
  }

  try {
    const cacheService = require('../services/cacheService');
    await cacheService.disconnect();
  } catch (_) {
    // cacheService may not have been initialised — ignore
  }
};

