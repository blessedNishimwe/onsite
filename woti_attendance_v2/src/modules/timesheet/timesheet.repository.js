// src/modules/timesheet/timesheet.repository.js
/**
 * Timesheet Repository
 * Database queries for timesheet and activities operations
 */

const { query } = require('../../config/database');

/**
 * Get all active activities ordered by display_order
 * @returns {Promise<Array>} List of activities
 */
const getActivities = async () => {
  const result = await query(
    `SELECT id, name, description, display_order
     FROM timesheet_activities
     WHERE is_active = TRUE
     ORDER BY display_order ASC, name ASC`
  );
  return result.rows;
};

/**
 * Get activity by ID
 * @param {string} activityId - Activity UUID
 * @returns {Promise<Object|null>} Activity or null
 */
const getActivityById = async (activityId) => {
  const result = await query(
    `SELECT id, name, description, is_active, display_order
     FROM timesheet_activities
     WHERE id = $1`,
    [activityId]
  );
  return result.rows[0] || null;
};

/**
 * Get monthly attendance records for a user
 * @param {string} userId - User UUID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @returns {Promise<Array>} Attendance records with calculated hours
 */
const getMonthlyAttendance = async (userId, month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const result = await query(
    `SELECT 
      a.id,
      a.user_id,
      a.facility_id,
      a.clock_in_time,
      a.clock_out_time,
      a.clock_in_latitude,
      a.clock_in_longitude,
      a.clock_out_latitude,
      a.clock_out_longitude,
      a.status,
      a.activity_id,
      a.activity_description,
      a.metadata,
      ta.name as activity_name,
      f.name as facility_name,
      u.first_name,
      u.last_name,
      u.email,
      EXTRACT(EPOCH FROM (a.clock_out_time - a.clock_in_time)) / 3600 as hours_worked
     FROM attendance a
     LEFT JOIN timesheet_activities ta ON a.activity_id = ta.id
     LEFT JOIN facilities f ON a.facility_id = f.id
     LEFT JOIN users u ON a.user_id = u.id
     WHERE a.user_id = $1
       AND a.clock_in_time >= $2
       AND a.clock_in_time <= $3
     ORDER BY a.clock_in_time ASC`,
    [userId, startDate, endDate]
  );
  return result.rows;
};

/**
 * Get user with facility and location details
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} User details
 */
const getUserDetails = async (userId) => {
  const result = await query(
    `SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      f.id as facility_id,
      f.name as facility_name,
      c.name as council_name,
      r.name as region_name
     FROM users u
     LEFT JOIN facilities f ON u.facility_id = f.id
     LEFT JOIN councils c ON f.council_id = c.id
     LEFT JOIN regions r ON c.region_id = r.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Update attendance activity
 * @param {string} attendanceId - Attendance UUID
 * @param {string} activityId - Activity UUID (optional, null to clear)
 * @param {string} description - Activity description
 * @returns {Promise<Object>} Updated attendance record
 */
const updateAttendanceActivity = async (attendanceId, activityId, description) => {
  const result = await query(
    `UPDATE attendance
     SET activity_id = $1,
         activity_description = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [activityId, description, attendanceId]
  );
  return result.rows[0] || null;
};

/**
 * Get attendance by ID
 * @param {string} attendanceId - Attendance UUID
 * @returns {Promise<Object|null>} Attendance record
 */
const getAttendanceById = async (attendanceId) => {
  const result = await query(
    `SELECT 
      a.*,
      ta.name as activity_name,
      f.name as facility_name
     FROM attendance a
     LEFT JOIN timesheet_activities ta ON a.activity_id = ta.id
     LEFT JOIN facilities f ON a.facility_id = f.id
     WHERE a.id = $1`,
    [attendanceId]
  );
  return result.rows[0] || null;
};

/**
 * Check if all attendance records for a month have activities
 * @param {string} userId - User UUID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Object>} Validation result
 */
const validateTimesheetCompleteness = async (userId, month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const result = await query(
    `SELECT 
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE activity_id IS NULL AND status = 'completed') as missing_activity,
      COUNT(*) FILTER (WHERE clock_out_time IS NULL AND status = 'active') as incomplete_records
     FROM attendance
     WHERE user_id = $1
       AND clock_in_time >= $2
       AND clock_in_time <= $3`,
    [userId, startDate, endDate]
  );

  const stats = result.rows[0];
  return {
    totalRecords: parseInt(stats.total_records),
    missingActivity: parseInt(stats.missing_activity),
    incompleteRecords: parseInt(stats.incomplete_records),
    isComplete: parseInt(stats.missing_activity) === 0 && parseInt(stats.incomplete_records) === 0
  };
};

module.exports = {
  getActivities,
  getActivityById,
  getMonthlyAttendance,
  getUserDetails,
  updateAttendanceActivity,
  getAttendanceById,
  validateTimesheetCompleteness
};
