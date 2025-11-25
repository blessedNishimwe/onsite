// src/modules/users/users.repository.js
/**
 * Users Repository
 * Database queries for users with parameterized statements
 */

const { query, getClient } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Find user by ID with full details
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User with facility/council/region info
 */
const findById = async (userId) => {
  const result = await query(
    `SELECT 
      u.id,
      u.email,
      u.phone,
      u.first_name,
      u.last_name,
      u.role,
      u.facility_id,
      u.supervisor_id,
      u.is_active,
      u.last_login_at,
      u.metadata,
      u.created_at,
      u.updated_at,
      f.name as facility_name,
      f.code as facility_code,
      f.facility_type,
      f.latitude as facility_latitude,
      f.longitude as facility_longitude,
      c.id as council_id,
      c.name as council_name,
      c.code as council_code,
      r.id as region_id,
      r.name as region_name,
      r.code as region_code,
      s.first_name as supervisor_first_name,
      s.last_name as supervisor_last_name,
      s.email as supervisor_email
    FROM users u
    LEFT JOIN facilities f ON u.facility_id = f.id
    LEFT JOIN councils c ON f.council_id = c.id
    LEFT JOIN regions r ON c.region_id = r.id
    LEFT JOIN users s ON u.supervisor_id = s.id
    WHERE u.id = $1`,
    [userId]
  );
  
  return result.rows[0] || null;
};

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Object>} User
 */
const findByEmail = async (email) => {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  return result.rows[0] || null;
};

/**
 * Find all users with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} List of users
 */
const findAll = async (filters = {}) => {
  const {
    role,
    facility_id,
    supervisor_id,
    is_active,
    search,
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = filters;
  
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  // Build WHERE conditions
  if (role) {
    conditions.push(`u.role = $${paramIndex++}`);
    params.push(role);
  }
  
  if (facility_id) {
    conditions.push(`u.facility_id = $${paramIndex++}`);
    params.push(facility_id);
  }
  
  if (supervisor_id) {
    conditions.push(`u.supervisor_id = $${paramIndex++}`);
    params.push(supervisor_id);
  }
  
  if (is_active !== undefined) {
    conditions.push(`u.is_active = $${paramIndex++}`);
    params.push(is_active);
  }
  
  if (search) {
    conditions.push(`(
      u.first_name ILIKE $${paramIndex} OR 
      u.last_name ILIKE $${paramIndex} OR 
      u.email ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Validate sort column to prevent SQL injection
  const allowedSortColumns = ['created_at', 'updated_at', 'first_name', 'last_name', 'email', 'role'];
  const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  // Get total count
  const countQuery = `SELECT COUNT(*) FROM users u ${whereClause}`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Get users
  params.push(limit, offset);
  const usersQuery = `
    SELECT 
      u.id,
      u.email,
      u.phone,
      u.first_name,
      u.last_name,
      u.role,
      u.facility_id,
      u.supervisor_id,
      u.is_active,
      u.last_login_at,
      u.created_at,
      f.name as facility_name,
      f.code as facility_code,
      c.name as council_name,
      r.name as region_name
    FROM users u
    LEFT JOIN facilities f ON u.facility_id = f.id
    LEFT JOIN councils c ON f.council_id = c.id
    LEFT JOIN regions r ON c.region_id = r.id
    ${whereClause}
    ORDER BY u.${validSortBy} ${validSortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;
  
  const result = await query(usersQuery, params);
  
  return {
    users: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Create new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
const create = async (userData) => {
  const result = await query(
    `INSERT INTO users (
      email, phone, password_hash, first_name, last_name, role,
      facility_id, supervisor_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      userData.email,
      userData.phone || null,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.facility_id || null,
      userData.supervisor_id || null,
      userData.metadata || {}
    ]
  );
  
  return result.rows[0];
};

/**
 * Update user
 * @param {string} userId - User ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated user
 */
const update = async (userId, updateData) => {
  const fields = [];
  const params = [];
  let paramIndex = 1;
  
  // Build SET clause dynamically
  if (updateData.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    params.push(updateData.email);
  }
  
  if (updateData.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    params.push(updateData.phone);
  }
  
  if (updateData.password_hash !== undefined) {
    fields.push(`password_hash = $${paramIndex++}`);
    params.push(updateData.password_hash);
  }
  
  if (updateData.first_name !== undefined) {
    fields.push(`first_name = $${paramIndex++}`);
    params.push(updateData.first_name);
  }
  
  if (updateData.last_name !== undefined) {
    fields.push(`last_name = $${paramIndex++}`);
    params.push(updateData.last_name);
  }
  
  if (updateData.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    params.push(updateData.role);
  }
  
  if (updateData.facility_id !== undefined) {
    fields.push(`facility_id = $${paramIndex++}`);
    params.push(updateData.facility_id);
  }
  
  if (updateData.supervisor_id !== undefined) {
    fields.push(`supervisor_id = $${paramIndex++}`);
    params.push(updateData.supervisor_id);
  }
  
  if (updateData.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    params.push(updateData.is_active);
  }
  
  if (updateData.metadata !== undefined) {
    fields.push(`metadata = $${paramIndex++}`);
    params.push(updateData.metadata);
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  params.push(userId);
  const updateQuery = `
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  
  const result = await query(updateQuery, params);
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  return result.rows[0];
};

/**
 * Delete user (soft delete by setting is_active to false)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
const remove = async (userId) => {
  const result = await query(
    'UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id',
    [userId]
  );
  
  return result.rows.length > 0;
};

/**
 * Get user statistics
 * @returns {Promise<Object>} User statistics
 */
const getStatistics = async () => {
  const result = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
      COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_users,
      COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
      COUNT(*) FILTER (WHERE role = 'supervisor') as supervisor_count,
      COUNT(*) FILTER (WHERE role = 'tester') as tester_count,
      COUNT(*) FILTER (WHERE facility_id IS NOT NULL) as users_with_facility
    FROM users
  `);
  
  return result.rows[0];
};

/**
 * Find all pending users (is_active = false)
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} List of pending users with pagination
 */
const findPending = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = filters;
  
  const offset = (page - 1) * limit;
  
  // Validate sort column to prevent SQL injection
  const allowedSortColumns = ['created_at', 'updated_at', 'first_name', 'last_name', 'email', 'role'];
  const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  // Get total count of pending users
  const countResult = await query(
    'SELECT COUNT(*) FROM users WHERE is_active = FALSE'
  );
  const total = parseInt(countResult.rows[0].count);
  
  // Get pending users
  const usersQuery = `
    SELECT 
      u.id,
      u.email,
      u.phone,
      u.first_name,
      u.last_name,
      u.role,
      u.facility_id,
      u.is_active,
      u.created_at,
      f.name as facility_name,
      f.code as facility_code,
      c.name as council_name,
      r.name as region_name
    FROM users u
    LEFT JOIN facilities f ON u.facility_id = f.id
    LEFT JOIN councils c ON f.council_id = c.id
    LEFT JOIN regions r ON c.region_id = r.id
    WHERE u.is_active = FALSE
    ORDER BY u.${validSortBy} ${validSortOrder}
    LIMIT $1 OFFSET $2
  `;
  
  const result = await query(usersQuery, [limit, offset]);
  
  return {
    users: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Approve user (set is_active = true)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user
 */
const approve = async (userId) => {
  const result = await query(
    `UPDATE users 
     SET is_active = TRUE 
     WHERE id = $1 
     RETURNING *`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  return result.rows[0];
};

module.exports = {
  findById,
  findByEmail,
  findAll,
  findPending,
  create,
  update,
  remove,
  approve,
  getStatistics
};
