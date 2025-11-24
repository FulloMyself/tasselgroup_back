// middleware/cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = req.originalUrl;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log('✅ Serving from cache:', key);
      return res.json(cachedResponse);
    }

    // Override res.json to cache response
    const originalJson = res.json;
    res.json = (body) => {
      cache.set(key, body, duration);
      originalJson.call(res, body);
    };

    next();
  };
};

module.exports = cacheMiddleware;