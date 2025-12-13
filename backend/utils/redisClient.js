// utils/redisClient.js
const redis = require('redis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not defined in the .env file.");
}

const redisClient = redis.createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 10000,
    keepAlive: 10000,
    reconnectStrategy: retries => Math.min(retries * 200, 5000) // gradual backoff up to 5s
  }
});

redisClient.on('connect', () => {
  console.log('Connected to Redis server successfully.');
});

redisClient.on('ready', () => {
  console.log('Redis client is ready.');
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('end', () => {
  console.warn('Redis connection closed. Will attempt to reconnect on next request.');
});

redisClient.on('reconnecting', () => {
  console.warn('Redis reconnecting...');
});
let connectingPromise = null;

const ensureRedisConnection = async () => {
  if (redisClient.isReady) {
    return;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.ping();
  })();

  try {
    await connectingPromise;
  } finally {
    connectingPromise = null;
  }
};

module.exports = { redisClient, ensureRedisConnection };