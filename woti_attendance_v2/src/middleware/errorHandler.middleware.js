// src/middleware/errorHandler.middleware.js
/**
 * Centralized Error Handling Middleware
 * Handles all errors in a consistent format
 */

const logger = require('../utils/logger');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle database errors
 */
const handleDatabaseError = (error) => {
  logger.error('Database error:', error);
  
  // PostgreSQL error codes
  if (error.code === '23505') {
    // Unique violation
    return new AppError('Duplicate entry. This record already exists.', 409, 'DUPLICATE_ENTRY');
  }
  
  if (error.code === '23503') {
    // Foreign key violation
    return new AppError('Referenced record does not exist.', 400, 'INVALID_REFERENCE');
  }
  
  if (error.code === '23502') {
    // Not null violation
    return new AppError('Required field is missing.', 400, 'MISSING_FIELD');
  }
  
  if (error.code === '23514') {
    // Check violation
    return new AppError('Invalid data provided.', 400, 'INVALID_DATA');
  }
  
  if (error.code === '22P02') {
    // Invalid text representation
    return new AppError('Invalid data format.', 400, 'INVALID_FORMAT');
  }
  
  // Generic database error
  return new AppError('Database operation failed.', 500, 'DATABASE_ERROR');
};

/**
 * Development error response
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    error: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack,
    details: err
  });
};

/**
 * Production error response
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      code: err.code
    });
  } else {
    // Programming or unknown error: don't leak error details
    logger.error('Unexpected error:', err);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.name = err.name || 'Error';
  
  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    statusCode: err.statusCode,
    code: err.code,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    stack: err.stack
  });
  
  // Handle database errors
  if (err.code && err.code.startsWith('23')) {
    err = handleDatabaseError(err);
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    err = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
  
  if (err.name === 'TokenExpiredError') {
    err = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    err = new AppError(err.message, 400, 'VALIDATION_ERROR');
  }
  
  // Send response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    sendErrorProd(err, res);
  }
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFound
};
