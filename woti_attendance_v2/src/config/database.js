// src/config/database.js
/**
 * Database Configuration Module
 * Manages PostgreSQL connection pool with pgbouncer support
 * Supports 20-100 connections for high-performance operations
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

/**
 * Database connection pool configuration
 * Optimized for 1,000 concurrent users
 */
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'woti_attendance',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  
  // Connection pool settings (tunable: 20-100)
  min: parseInt(process.env.DB_POOL_MIN) || 20,
  max: parseInt(process.env.DB_POOL_MAX) || 100,
  
  // Timeout settings
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
  
  // Statement timeout (30 seconds)
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
  
  // Query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
  
  // pgbouncer compatibility
  application_name: 'woti_attendance_v2',
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DB_SSL_CA,
    cert: process.env.DB_SSL_CERT,
    key: process.env.DB_SSL_KEY
  } : false
};

// Create connection pool
const pool = new Pool(poolConfig);

// Pool event handlers
pool.on('connect', (client) => {
  logger.debug('New database client connected');
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

pool.on('remove', (client) => {
  logger.debug('Client removed from pool');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected database pool error:', err);
  // Don't exit process - let error handling middleware deal with it
});

/**
 * Execute a query with automatic connection management
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Database query error:', { text, error: error.message });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Override query to add logging
  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };
  
  // Override release to add logging
  client.release = () => {
    logger.debug('Client released back to pool');
    return originalRelease();
  };
  
  return client;
};

/**
 * Gracefully close all connections in the pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', error);
    throw error;
  }
};

/**
 * Check database connection health
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    const result = await pool.query('SELECT NOW() as now, version() as version');
    logger.debug('Database health check passed', result.rows[0]);
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

/**
 * Get pool statistics
 * @returns {Object} Pool statistics
 */
const getPoolStats = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
};

module.exports = {
  pool,
  query,
  getClient,
  closePool,
  healthCheck,
  getPoolStats
};