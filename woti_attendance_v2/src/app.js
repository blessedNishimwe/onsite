// src/app.js
/**
 * Main Application Configuration
 * WOTI Attendance V2 - High-Performance Monolithic Backend
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler.middleware');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const facilitiesRoutes = require('./modules/facilities/facilities.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const locationsRoutes = require('./modules/locations/locations.routes');

const app = express();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGINS || '').split(',').filter(Boolean)
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// ============================================================================
// LOGGING MIDDLEWARE
// ============================================================================

// HTTP request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// ============================================================================
// BODY PARSING MIDDLEWARE
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// CREATE REQUIRED DIRECTORIES
// ============================================================================

const requiredDirs = ['uploads', 'logs'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve frontend for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});


// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

app.get('/health', async (req, res) => {
  const { healthCheck, getPoolStats } = require('./config/database');
  
  const dbHealthy = await healthCheck();
  const poolStats = getPoolStats();
  
  const health = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    database: {
      connected: dbHealthy,
      pool: poolStats
    },
    memory: process.memoryUsage()
  };
  
  res.status(dbHealthy ? 200 : 503).json(health);
});

// ============================================================================
// API ROUTES
// ============================================================================

// Root API endpoint
/*app.get('/api', (req, res) => {
  res.json({
    name: 'WOTI Attendance API v2',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      facilities: '/api/facilities',
      attendance: '/api/attendance'
    },
    documentation: '/api/docs'
  });
});*/

// Root endpoint
/*app.get('/', (req, res) => {
  res.json({
    name: 'WOTI Attendance API v2',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      users: '/api/users',
      facilities: '/api/facilities',
      attendance: '/api/attendance'
    },
    documentation: '/api/docs'
  });
});*/

// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationsRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================================================
// EXPORT APP
// ============================================================================

module.exports = app;