console.log('🔵 Step 1: Starting server.js');
require('dotenv').config();
console.log('🔵 Step 2: dotenv loaded');

const app = require('./app');
console.log('🔵 Step 3: app loaded');

const { pool } = require('./config/database');
console.log('🔵 Step 4: database configured');

const PORT = process.env.PORT || 5500;

// Test database connection BEFORE starting server
const startServer = async () => {
  try {
    // Test database connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', result.rows[0].now);
    
    // Start server only if DB is connected
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`🔗 Health: http://localhost:${PORT}/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('⚠️  SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        pool.end(() => {
          console.log('✅ Database pool closed');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('\n⚠️  SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        pool.end(() => {
          console.log('✅ Database pool closed');
          process.exit(0);
        });
      });
    });
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Make sure PostgreSQL is running and credentials are correct');
    console.error('📋 Error details:', error);
    process.exit(1);
  }
};

// Start the server
startServer();