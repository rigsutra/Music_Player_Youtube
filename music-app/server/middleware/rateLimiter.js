// /middleware/rateLimiter.js - Rate limiting middleware
const rateLimitMap = new Map();

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxRequests = 120;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const requests = rateLimitMap.get(ip);
  
  // Remove old requests
  while (requests.length > 0 && now - requests[0] > windowMs) {
    requests.shift();
  }

  // Check if limit exceeded
  if (requests.length >= maxRequests) {
    return res.status(429).json({
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
    });
  }

  // Add current request
  requests.push(now);
  rateLimitMap.set(ip, requests);

  next();
};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const windowMs = 60_000;
  
  for (const [ip, requests] of rateLimitMap.entries()) {
    const validRequests = requests.filter(time => now - time <= windowMs);
    
    if (validRequests.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validRequests);
    }
  }
}, 300_000);

module.exports = { rateLimiter };