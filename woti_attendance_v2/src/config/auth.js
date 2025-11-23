// src/config/auth.js
/**
 * Authentication Configuration Module
 * JWT and password hashing settings
 */

module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h', // 24-hour expiry
    algorithm: 'HS256',
    issuer: 'woti-attendance-v2',
    audience: 'woti-users'
  },
  
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' // 7 days
  },
  
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12 // 12 rounds as specified
  },
  
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },
  
  // Rate limiting for auth endpoints
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5, // 5 attempts per window
    blockDuration: 30 * 60 * 1000 // 30 minutes block
  }
};
