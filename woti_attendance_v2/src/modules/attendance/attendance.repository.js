// src/modules/attendance/attendance.repository.js
/**
 * Attendance Repository
 * Optimized database queries for attendance records
 */

const { query, getClient } = require('../../config/database');

/**
 * Find attendance by ID
 * @param {string} attendanceId - Attendance ID
 * @returns {Promise<Object>} Attendance record
 */
const findById = async (attendanceId) => {
  const result = await query(
    `SELECT 
      a.*,
      u.first_name, u.last_name, u.email,
      f.name as facility_name, f.code as facility_code
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    JOIN facilities f ON a.facility_id = f.id
    WHERE a.id = $1`,
    [attendanceId]
  );
  
  return result.rows[0] || null;
};

/**
 * Find user's active attendance (not clocked out)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Active attendance record
 */
const findActiveByUserId = async (userId) => {
  const result = await query(
    `SELECT * FROM attendance 
     WHERE user_id = $1 
     AND status = 'active' 
     AND clock_out_time IS NULL
     ORDER BY clock_in_time DESC
     LIMIT 1`,
    [userId]
  );
  
  return result.rows[0] || null;
};

/**
 * Create clock-in record
 * @param {Object} attendanceData - Attendance data
 * @returns {Promise<Object>} Created attendance record
 */
const clockIn = async (attendanceData) => {
  const result = await query(
    `INSERT INTO attendance (
      user_id, facility_id, clock_in_time, 
      clock_in_latitude, clock_in_longitude,
      clock_in_accuracy_meters, clock_in_distance_meters,
      device_fingerprint, validation_status,
      device_id, client_timestamp, synced, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      attendanceData.user_id,
      attendanceData.facility_id,
      attendanceData.clock_in_time,
      attendanceData.clock_in_latitude || null,
      attendanceData.clock_in_longitude || null,
      attendanceData.clock_in_accuracy_meters || null,
      attendanceData.clock_in_distance_meters || null,
      attendanceData.device_fingerprint || null,
      attendanceData.validation_status || 'verified',
      attendanceData.device_id,
      attendanceData.client_timestamp || attendanceData.clock_in_time,
      attendanceData.synced !== undefined ? attendanceData.synced : true,
      attendanceData.metadata || {}
    ]
  );
  
  return result.rows[0];
};

/**
 * Update clock-out record
 * @param {string} attendanceId - Attendance ID
 * @param {Object} clockOutData - Clock out data
 * @returns {Promise<Object>} Updated attendance record
 */
const clockOut = async (attendanceId, clockOutData) => {
  const result = await query(
    `UPDATE attendance 
     SET 
       clock_out_time = $1,
       clock_out_latitude = $2,
       clock_out_longitude = $3,
       clock_out_accuracy_meters = $4,
       clock_out_distance_meters = $5,
       status = 'completed',
       notes = COALESCE($6, notes),
       metadata = COALESCE($7, metadata)
     WHERE id = $8
     RETURNING *`,
    [
      clockOutData.clock_out_time,
      clockOutData.clock_out_latitude || null,
      clockOutData.clock_out_longitude || null,
      clockOutData.clock_out_accuracy_meters || null,
      clockOutData.clock_out_distance_meters || null,
      clockOutData.notes || null,
      clockOutData.metadata || null,
      attendanceId
    ]
  );
  
  return result.rows[0];
};

/**
 * Find attendance records with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Attendance records with pagination
 */
const findAll = async (filters = {}) => {
  const {
    user_id,
    facility_id,
    status,
    start_date,
    end_date,
    synced,
    device_id,
    page = 1,
    limit = 10,
    sortBy = 'clock_in_time',
    sortOrder = 'DESC'
  } = filters;
  
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  if (user_id) {
    conditions.push(`a.user_id = $${paramIndex++}`);
    params.push(user_id);
  }
  
  if (facility_id) {
    conditions.push(`a.facility_id = $${paramIndex++}`);
    params.push(facility_id);
  }
  
  if (status) {
    conditions.push(`a.status = $${paramIndex++}`);
    params.push(status);
  }
  
  if (start_date) {
    conditions.push(`a.clock_in_time >= $${paramIndex++}`);
    params.push(start_date);
  }
  
  if (end_date) {
    conditions.push(`a.clock_in_time <= $${paramIndex++}`);
    params.push(end_date);
  }
  
  if (synced !== undefined) {
    conditions.push(`a.synced = $${paramIndex++}`);
    params.push(synced);
  }
  
  if (device_id) {
    conditions.push(`a.device_id = $${paramIndex++}`);
    params.push(device_id);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const allowedSortColumns = ['clock_in_time', 'clock_out_time', 'created_at'];
  const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'clock_in_time';
  const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  const countQuery = `
    SELECT COUNT(*) 
    FROM attendance a
    ${whereClause}
  `;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  params.push(limit, offset);
  const attendanceQuery = `
    SELECT 
      a.*,
      u.first_name, u.last_name, u.email, u.role,
      f.name as facility_name, f.code as facility_code
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    JOIN facilities f ON a.facility_id = f.id
    ${whereClause}
    ORDER BY a.${validSortBy} ${validSortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;
  
  const result = await query(attendanceQuery, params);
  
  return {
    records: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Bulk sync attendance records from offline devices
 * @param {Array} records - Array of attendance records
 * @returns {Promise<Object>} Sync results
 */
const bulkSync = async (records) => {
  const client = await getClient();
  const results = { inserted: [], updated: [], errors: [] };
  
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      try {
        // Check if record exists based on device_id and client_timestamp
        const existing = await client.query(
          `SELECT * FROM attendance 
           WHERE device_id = $1 AND client_timestamp = $2`,
          [record.device_id, record.client_timestamp]
        );
        
        if (existing.rows.length === 0) {
          // Insert new record
          const insertResult = await client.query(
            `INSERT INTO attendance (
              user_id, facility_id, clock_in_time, clock_out_time,
              clock_in_latitude, clock_in_longitude,
              clock_out_latitude, clock_out_longitude,
              status, notes, synced, client_timestamp, device_id,
              sync_version, conflict_resolution_strategy, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
              record.user_id,
              record.facility_id,
              record.clock_in_time,
              record.clock_out_time || null,
              record.clock_in_latitude || null,
              record.clock_in_longitude || null,
              record.clock_out_latitude || null,
              record.clock_out_longitude || null,
              record.status || 'completed',
              record.notes || null,
              true, // Mark as synced
              record.client_timestamp,
              record.device_id,
              record.sync_version || 1,
              record.conflict_resolution_strategy || 'server_wins',
              record.metadata || {}
            ]
          );
          
          results.inserted.push(insertResult.rows[0]);
        } else {
          // Update existing record if sync version is higher
          const existingRecord = existing.rows[0];
          
          if ((record.sync_version || 1) > existingRecord.sync_version) {
            const updateResult = await client.query(
              `UPDATE attendance 
               SET clock_out_time = $1,
                   clock_out_latitude = $2,
                   clock_out_longitude = $3,
                   status = $4,
                   notes = $5,
                   sync_version = $6,
                   metadata = $7
               WHERE id = $8
               RETURNING *`,
              [
                record.clock_out_time || existingRecord.clock_out_time,
                record.clock_out_latitude || existingRecord.clock_out_latitude,
                record.clock_out_longitude || existingRecord.clock_out_longitude,
                record.status || existingRecord.status,
                record.notes || existingRecord.notes,
                record.sync_version || existingRecord.sync_version + 1,
                { ...existingRecord.metadata, ...record.metadata },
                existingRecord.id
              ]
            );
            
            results.updated.push(updateResult.rows[0]);
          }
        }
      } catch (error) {
        results.errors.push({
          record,
          error: error.message
        });
      }
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  return results;
};

/**
 * Get attendance statistics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Statistics
 */
const getStatistics = async (filters = {}) => {
  const { user_id, facility_id, start_date, end_date } = filters;
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  if (user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(user_id);
  }
  
  if (facility_id) {
    conditions.push(`facility_id = $${paramIndex++}`);
    params.push(facility_id);
  }
  
  if (start_date) {
    conditions.push(`clock_in_time >= $${paramIndex++}`);
    params.push(start_date);
  }
  
  if (end_date) {
    conditions.push(`clock_in_time <= $${paramIndex++}`);
    params.push(end_date);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE status = 'active') as active_records,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_records,
      COUNT(*) FILTER (WHERE synced = FALSE) as unsynced_records,
      AVG(EXTRACT(EPOCH FROM (clock_out_time - clock_in_time))/3600) as avg_hours_worked
    FROM attendance
    ${whereClause}
  `, params);
  
  return result.rows[0];
};

module.exports = {
  findById,
  findActiveByUserId,
  clockIn,
  clockOut,
  findAll,
  bulkSync,
  getStatistics
};
