// src/modules/admin/admin.service.js
/**
 * Admin Service
 * Business logic for admin operations
 */

const { query, getClient } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats
 */
const getDashboardStats = async () => {
  try {
    // Total users
    const totalUsersResult = await query(
      'SELECT COUNT(*) as count FROM users'
    );
    
    // Pending users
    const pendingUsersResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE is_active = FALSE AND email_verified = FALSE'
    );
    
    // Active users
    const activeUsersResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE'
    );
    
    // Total facilities
    const facilitiesResult = await query(
      'SELECT COUNT(*) as count FROM facilities WHERE is_active = TRUE'
    );
    
    // Total regions
    const regionsResult = await query(
      'SELECT COUNT(*) as count FROM regions WHERE is_active = TRUE'
    );
    
    // Total councils
    const councilsResult = await query(
      'SELECT COUNT(*) as count FROM councils WHERE is_active = TRUE'
    );
    
    // Recent activities
    const recentActivitiesResult = await query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM activities a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 10`
    );
    
    return {
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      pendingUsers: parseInt(pendingUsersResult.rows[0].count),
      activeUsers: parseInt(activeUsersResult.rows[0].count),
      totalFacilities: parseInt(facilitiesResult.rows[0].count),
      totalRegions: parseInt(regionsResult.rows[0].count),
      totalCouncils: parseInt(councilsResult.rows[0].count),
      recentActivities: recentActivitiesResult.rows
    };
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

/**
 * Get all pending users
 * @returns {Promise<Array>} Pending users
 */
const getPendingUsers = async () => {
  try {
    const result = await query(
      `SELECT 
        u.id,
        u.email,
        u.phone,
        u.first_name,
        u.last_name,
        u.role,
        u.created_at,
        f.name as facility_name,
        f.code as facility_code,
        c.name as council_name,
        r.name as region_name
      FROM users u
      LEFT JOIN facilities f ON u.facility_id = f.id
      LEFT JOIN councils c ON f.council_id = c.id
      LEFT JOIN regions r ON c.region_id = r.id
      WHERE u.is_active = FALSE AND u.email_verified = FALSE
      ORDER BY u.created_at DESC`
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error fetching pending users:', error);
    throw error;
  }
};

/**
 * Get all users with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Users and pagination
 */
const getAllUsers = async (filters = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      is_active,
      facility_id,
      search
    } = filters;
    
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    
    if (is_active !== undefined) {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }
    
    if (facility_id) {
      whereConditions.push(`u.facility_id = $${paramIndex}`);
      params.push(facility_id);
      paramIndex++;
    }
    
    if (search) {
      whereConditions.push(`(
        u.first_name ILIKE $${paramIndex} OR 
        u.last_name ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count 
       FROM users u 
       ${whereClause}`,
      params
    );
    
    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);
    
    // Get users
    params.push(limit, offset);
    const result = await query(
      `SELECT 
        u.id,
        u.email,
        u.phone,
        u.first_name,
        u.last_name,
        u.role,
        u.is_active,
        u.email_verified,
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
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages
      }
    };
  } catch (error) {
    logger.error('Error fetching all users:', error);
    throw error;
  }
};

/**
 * Approve user (admin action)
 * @param {string} userId - User ID to approve
 * @param {Object} adminUser - Admin user performing action
 * @returns {Promise<Object>} Approved user
 */
const approveUser = async (userId, adminUser) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get user details
    const userResult = await client.query(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    if (user.is_active) {
      throw new Error('User is already active');
    }
    
    // Update user: set is_active = TRUE and email_verified = TRUE
    await client.query(
      `UPDATE users 
       SET is_active = TRUE, 
           email_verified = TRUE,
           metadata = metadata || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({
          approved_by: adminUser.id,
          approved_at: new Date().toISOString(),
          approved_by_email: adminUser.email
        }),
        userId
      ]
    );
    
    // Log approval activity
    await client.query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        adminUser.id,
        'approve_user',
        'user',
        userId,
        `Admin ${adminUser.email} approved user ${user.email}`,
        JSON.stringify({
          approved_user_id: userId,
          approved_user_email: user.email,
          approved_user_role: user.role
        })
      ]
    );
    
    await client.query('COMMIT');
    
    logger.info('User approved successfully', {
      userId: userId,
      approvedBy: adminUser.id,
      userEmail: user.email
    });
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('User approval failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reject user (admin action)
 * @param {string} userId - User ID to reject
 * @param {string} reason - Rejection reason
 * @param {Object} adminUser - Admin user performing action
 * @returns {Promise<Object>} Result
 */
const rejectUser = async (userId, reason, adminUser) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get user details
    const userResult = await client.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Update user metadata with rejection info
    await client.query(
      `UPDATE users 
       SET metadata = metadata || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({
          rejected_by: adminUser.id,
          rejected_at: new Date().toISOString(),
          rejected_by_email: adminUser.email,
          rejection_reason: reason
        }),
        userId
      ]
    );
    
    // Log rejection activity
    await client.query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        adminUser.id,
        'reject_user',
        'user',
        userId,
        `Admin ${adminUser.email} rejected user ${user.email}`,
        JSON.stringify({
          rejected_user_id: userId,
          rejected_user_email: user.email,
          reason: reason
        })
      ]
    );
    
    // Optionally: Delete the user or keep for records
    // await client.query('DELETE FROM users WHERE id = $1', [userId]);
    
    await client.query('COMMIT');
    
    logger.info('User rejected', {
      userId: userId,
      rejectedBy: adminUser.id,
      reason: reason
    });
    
    return {
      success: true,
      message: 'User registration rejected'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('User rejection failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Deactivate user
 * @param {string} userId - User ID to deactivate
 * @param {Object} adminUser - Admin user performing action
 * @returns {Promise<Object>} Result
 */
const deactivateUser = async (userId, adminUser) => {
  try {
    await query(
      'UPDATE users SET is_active = FALSE WHERE id = $1',
      [userId]
    );
    
    // Log activity
    await query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminUser.id,
        'deactivate_user',
        'user',
        userId,
        `Admin ${adminUser.email} deactivated user`
      ]
    );
    
    logger.info('User deactivated', { userId, deactivatedBy: adminUser.id });
    
    return { success: true, message: 'User deactivated successfully' };
  } catch (error) {
    logger.error('User deactivation failed:', error);
    throw error;
  }
};

/**
 * Activate user
 * @param {string} userId - User ID to activate
 * @param {Object} adminUser - Admin user performing action
 * @returns {Promise<Object>} Result
 */
const activateUser = async (userId, adminUser) => {
  try {
    await query(
      'UPDATE users SET is_active = TRUE, email_verified = TRUE WHERE id = $1',
      [userId]
    );
    
    // Log activity
    await query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminUser.id,
        'activate_user',
        'user',
        userId,
        `Admin ${adminUser.email} activated user`
      ]
    );
    
    logger.info('User activated', { userId, activatedBy: adminUser.id });
    
    return { success: true, message: 'User activated successfully' };
  } catch (error) {
    logger.error('User activation failed:', error);
    throw error;
  }
};
// Add these to existing admin.controller.js

/**
 * Bulk approve users
 * POST /api/admin/users/bulk-approve
 */
const bulkApproveUsers = asyncHandler(async (req, res) => {
  const { user_ids } = req.body;
  const adminUser = req.user;
  
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'user_ids array is required'
    });
  }
  
  const result = await adminService.bulkApproveUsers(user_ids, adminUser);
  
  res.status(200).json({
    success: true,
    message: `Successfully approved ${result.approved_count} user(s)`,
    data: result
  });
});

/**
 * Bulk reject users
 * POST /api/admin/users/bulk-reject
 */
const bulkRejectUsers = asyncHandler(async (req, res) => {
  const { user_ids, reason } = req.body;
  const adminUser = req.user;
  
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'user_ids array is required'
    });
  }
  
  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required'
    });
  }
  
  const result = await adminService.bulkRejectUsers(user_ids, reason, adminUser);
  
  res.status(200).json({
    success: true,
    message: `Successfully rejected ${result.rejected_count} user(s)`,
    data: result
  });
});

/**
 * Search users with advanced filters
 * GET /api/admin/users/search
 */
const searchUsers = asyncHandler(async (req, res) => {
  const filters = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
    search: req.query.search,
    role: req.query.role,
    is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    email_verified: req.query.email_verified === 'true' ? true : req.query.email_verified === 'false' ? false : undefined,
    facility_id: req.query.facility_id,
    region_id: req.query.region_id,
    council_id: req.query.council_id,
    date_from: req.query.date_from,
    date_to: req.query.date_to,
    sort_by: req.query.sort_by,
    sort_order: req.query.sort_order
  };
  
  const result = await adminService.searchUsers(filters);
  
  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Get activity logs
 * GET /api/admin/activities
 */
const getActivityLogs = asyncHandler(async (req, res) => {
  const filters = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
    user_id: req.query.user_id,
    action: req.query.action,
    entity_type: req.query.entity_type,
    date_from: req.query.date_from,
    date_to: req.query.date_to
  };
  
  const result = await adminService.getActivityLogs(filters);
  
  res.status(200).json({
    success: true,
    data: result
  });
});

// Update module.exports
module.exports = {
  // ... existing exports
  getDashboard,
  getPendingUsers,
  getAllUsers,
  approveUser,
  rejectUser,
  deactivateUser,
  activateUser,
  bulkApproveUsers,    // NEW
  bulkRejectUsers,     // NEW
  searchUsers,         // NEW
  getActivityLogs      // NEW
};
