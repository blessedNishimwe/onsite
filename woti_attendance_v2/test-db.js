// test-db.js
require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Testing database connection...');
console.log('📍 Host:', process.env.DB_HOST);
console.log('📍 Port:', process.env.DB_PORT);
console.log('📍 Database:', process.env.DB_NAME);
console.log('📍 User:', process.env.DB_USER);
console.log('📍 Password:', process.env.DB_PASSWORD ? '***SET***' : '⚠️  NOT SET');
console.log('');

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('❌ Missing database configuration in .env file!');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.query('SELECT NOW() as current_time, version() as pg_version', (err, res) => {
  if (err) {
    console.error('❌ Database connection FAILED!');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    process.exit(1);
  }
  
  console.log('✅ Database connection SUCCESSFUL!');
  console.log('🕐 Current Time:', res.rows[0].current_time);
  console.log('🐘 PostgreSQL Version:', res.rows[0].pg_version);
  console.log('');
  console.log('✨ Everything is working correctly!');
  
  pool.end();
  process.exit(0);
});