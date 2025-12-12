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
    // Timeout for the initial connection
    connectTimeout: 10000, // 10 seconds
    // Timeout for any command that is waiting for a reply
    // This is the most important one to prevent hangs
    reconnectStrategy: retries => Math.min(retries * 50, 500) // Reconnect every 0.5s max
  }
});

redisClient.on('connect', () => {
  console.log('Connected to Redis server successfully.');
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

module.exports = { redisClient, connectRedis };