const redis = require('redis');

let redisClient;
const memoryCache = new Map();

async function connectRedis() {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: false
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis client connected');
  });

  try {
    await redisClient.connect();
  } catch (error) {
    redisClient = null;
    console.warn('Redis unavailable; using in-memory cache for this process.');
  }
  return redisClient;
}

// Cache helpers
async function setCache(key, value, expirySeconds = 3600) {
  if (!redisClient) {
    memoryCache.set(key, {
      value: typeof value === 'string' ? value : JSON.stringify(value),
      expiresAt: Date.now() + expirySeconds * 1000
    });
    return;
  }

  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await redisClient.setEx(key, expirySeconds, stringValue);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

async function getCache(key) {
  if (!redisClient) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value);
    } catch {
      return entry.value;
    }
  }

  try {
    const value = await redisClient.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

async function deleteCache(key) {
  if (!redisClient) {
    memoryCache.delete(key);
    return;
  }

  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

async function deleteCachePattern(pattern) {
  if (!redisClient) {
    const patternRegex = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&').replace(/\\*/g, '.*')}$`);
    for (const key of memoryCache.keys()) {
      if (patternRegex.test(key)) memoryCache.delete(key);
    }
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Redis delete pattern error:', error);
  }
}

// Session helpers
async function setSession(sessionId, userId, data = {}) {
  const sessionData = {
    userId,
    ...data,
    createdAt: new Date().toISOString()
  };
  await setCache(`session:${sessionId}`, sessionData, 86400); // 24 hours
}

async function getSession(sessionId) {
  return await getCache(`session:${sessionId}`);
}

async function deleteSession(sessionId) {
  await deleteCache(`session:${sessionId}`);
}

function getClient() {
  return redisClient;
}

module.exports = {
  connectRedis,
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  setSession,
  getSession,
  deleteSession,
  getClient
};