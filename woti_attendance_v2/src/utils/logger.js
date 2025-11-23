// src/utils/logger.js
/**
 * Structured Logging Utility
 * Provides consistent logging across the application
 */

const winston = require('winston');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.metadata ? ' ' + JSON.stringify(info.metadata) : ''}`
  )
);

// Define which transports to use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: format,
  }),
  
  // Error log file
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
