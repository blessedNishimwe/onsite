// src/middleware/rateLimiter.middleware.js
/**
 * Rate Limiting Middleware
 * Protects sensitive endpoints from abuse
 */

const logger = require('../utils/logger');

/**
 * In-memory store for rate limiting
 * In production, use Redis for distributed rate limiting
 */
class RateLimitStore {
  constructor() {
    this.requests = new Map();
    this.blocked = new Map();
    
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  /**
   * Get request count for identifier
   */
  get(identifier) {
    return this.requests.get(identifier) || { count: 0, resetTime: Date.now() };
  }
  
  /**
   * Increment request count
   */
  increment(identifier, windowMs) {
    const now = Date.now();
    const data = this.get(identifier);
    
    // Reset if window has passed
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
    } else {
      data.count++;
    }
    
    this.requests.set(identifier, data);
    return data;
  }
  
  /**
   * Block identifier for duration
   */
  block(identifier, duration) {
    const unblockTime = Date.now() + duration;
    this.blocked.set(identifier, unblockTime);
    logger.warn('Rate limit exceeded, blocking identifier', { identifier, duration });
  }
  
  /**
   * Check if identifier is blocked
   */
  isBlocked(identifier) {
    const unblockTime = this.blocked.get(identifier);
    
    if (!unblockTime) return false;
    
    if (Date.now() > unblockTime) {
      this.blocked.delete(identifier);
      return false;
    }
    
    return true;
  }
  
  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    
    // Clean up request counts
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime + 60000) { // Keep for 1 extra minute
        this.requests.delete(key);
      }
    }
    
    // Clean up blocked entries
    for (const [key, unblockTime] of this.blocked.entries()) {
      if (now > unblockTime) {
        this.blocked.delete(key);
      }
    }
    
    logger.debug('Rate limiter store cleaned up', {
      requests: this.requests.size,
      blocked: this.blocked.size
    });
  }
}

const store = new RateLimitStore();

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @returns {Function} Middleware function
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxAttempts = 5,
    blockDuration = 30 * 60 * 1000, // 30 minutes
    keyGenerator = (req) => req.ip, // Default to IP address
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;
  
  return (req, res, next) => {
    const identifier = keyGenerator(req);
    
    // Check if blocked
    if (store.isBlocked(identifier)) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'You have been temporarily blocked due to too many requests',
        code: 'RATE_LIMIT_BLOCKED'
      });
    }
    
    // Increment request count
    const data = store.increment(identifier, windowMs);
    
    // Add headers
    res.setHeader('X-RateLimit-Limit', maxAttempts);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxAttempts - data.count));
    res.setHeader('X-RateLimit-Reset', new Date(data.resetTime).toISOString());
    
    // Check if limit exceeded
    if (data.count > maxAttempts) {
      store.block(identifier, blockDuration);
      
      logger.warn('Rate limit exceeded', {
        identifier,
        count: data.count,
        maxAttempts,
        path: req.path
      });
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(blockDuration / 1000)
      });
    }
    
    // Hook into response to handle skip options
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send.bind(res);
      res.send = function (body) {
        const shouldSkip = 
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);
        
        if (shouldSkip) {
          data.count--;
          store.requests.set(identifier, data);
        }
        
        return originalSend(body);
      };
    }
    
    next();
  };
};

/**
 * Rate limiter for authentication endpoints
 * Stricter limits for login/register
 */
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  blockDuration: 30 * 60 * 1000, // 30 minutes
  keyGenerator: (req) => {
    // Use email + IP for auth endpoints
    const email = req.body?.email || 'unknown';
    return `${email}-${req.ip}`;
  },
  skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * Rate limiter for API endpoints
 * More lenient for general API access
 */
const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 100,
  blockDuration: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Rate limiter for file uploads
 * Very strict limits
 */
const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 10,
  blockDuration: 60 * 60 * 1000, // 1 hour
  keyGenerator: (req) => req.user?.id || req.ip
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  uploadRateLimiter
};
