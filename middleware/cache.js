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

    // Override res.json to cache a plain JSON-serializable copy of the response
    const originalJson = res.json;
    res.json = (body) => {
      try {
        const bodyForCache = JSON.parse(JSON.stringify(body));
        cache.set(key, bodyForCache, duration);
        // Send the serializable copy to the client to avoid mongoose document issues
        return originalJson.call(res, bodyForCache);
      } catch (err) {
        // Fallback: if serialization fails, don't cache and send original body
        console.warn('⚠️ Failed to serialize response for cache:', err.message);
        return originalJson.call(res, body);
      }
    };

    next();
  };
};

module.exports = cacheMiddleware;