// src/modules/attendance/attendance.service.js
/**
 * Attendance Service
 * Business logic for attendance operations with offline sync
 */

const attendanceRepository = require('./attendance.repository');
const { batchResolveConflicts, validateSyncMetadata } = require('../../utils/syncResolver');
const logger = require('../../utils/logger');
const { query } = require('../../config/database');

/**
 * Clock in user
 * @param {Object} clockInData - Clock in data
 * @param {Object} user - User clocking in
 * @returns {Promise<Object>} Created attendance record
 */
const clockIn = async (clockInData, user) => {
  // Check if user already has an active attendance
  const activeAttendance = await attendanceRepository.findActiveByUserId(user.id);
  
  if (activeAttendance) {
    throw new Error('You already have an active clock-in. Please clock out first.');
  }
  
  const attendanceData = {
    user_id: user.id,
    facility_id: clockInData.facility_id,
    clock_in_time: clockInData.clock_in_time || new Date().toISOString(),
    clock_in_latitude: clockInData.clock_in_latitude,
    clock_in_longitude: clockInData.clock_in_longitude,
    device_id: clockInData.device_id,
    client_timestamp: clockInData.client_timestamp || new Date().toISOString(),
    synced: clockInData.synced !== undefined ? clockInData.synced : true,
    metadata: {
      ...clockInData.metadata,
      clock_in_method: clockInData.synced === false ? 'offline' : 'online'
    }
  };
  
  const attendance = await attendanceRepository.clockIn(attendanceData);
  
  // Log activity
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user.id,
      'clock_in',
      'attendance',
      attendance.id,
      `User clocked in at ${attendance.clock_in_time}`,
      JSON.stringify({ facility_id: attendance.facility_id, device_id: attendance.device_id })
    ]
  );
  
  logger.info('User clocked in', {
    userId: user.id,
    attendanceId: attendance.id,
    facilityId: attendance.facility_id
  });
  
  return attendance;
};

/**
 * Clock out user
 * @param {Object} clockOutData - Clock out data
 * @param {Object} user - User clocking out
 * @returns {Promise<Object>} Updated attendance record
 */
const clockOut = async (clockOutData, user) => {
  // Get active attendance
  const activeAttendance = await attendanceRepository.findActiveByUserId(user.id);
  
  if (!activeAttendance) {
    throw new Error('No active clock-in found. Please clock in first.');
  }
  
  const clockOutInfo = {
    clock_out_time: clockOutData.clock_out_time || new Date().toISOString(),
    clock_out_latitude: clockOutData.clock_out_latitude,
    clock_out_longitude: clockOutData.clock_out_longitude,
    notes: clockOutData.notes,
    metadata: {
      ...activeAttendance.metadata,
      ...clockOutData.metadata,
      clock_out_method: clockOutData.synced === false ? 'offline' : 'online'
    }
  };
  
  const attendance = await attendanceRepository.clockOut(activeAttendance.id, clockOutInfo);
  
  // Log activity
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user.id,
      'clock_out',
      'attendance',
      attendance.id,
      `User clocked out at ${attendance.clock_out_time}`,
      JSON.stringify({ facility_id: attendance.facility_id, duration_hours: attendance.clock_out_time ? (new Date(attendance.clock_out_time) - new Date(attendance.clock_in_time)) / (1000 * 60 * 60) : null })
    ]
  );
  
  logger.info('User clocked out', {
    userId: user.id,
    attendanceId: attendance.id
  });
  
  return attendance;
};

/**
 * Sync offline attendance records
 * @param {Array} records - Array of attendance records from mobile device
 * @param {Object} user - User syncing records
 * @returns {Promise<Object>} Sync results
 */
const syncOfflineRecords = async (records, user) => {
  logger.info(`Starting sync of ${records.length} offline records`, {
    userId: user.id
  });
  
  // Validate sync metadata for all records
  const validationErrors = [];
  const validRecords = [];
  
  for (let i = 0; i < records.length; i++) {
    const record = { ...records[i], user_id: user.id };
    const validation = validateSyncMetadata(record);
    
    if (!validation.isValid) {
      validationErrors.push({
        index: i,
        errors: validation.errors,
        record
      });
    } else {
      validRecords.push(record);
    }
  }
  
  if (validRecords.length === 0) {
    return {
      success: false,
      message: 'No valid records to sync',
      validation_errors: validationErrors
    };
  }
  
  // Fetch existing server records for conflict detection
  const deviceIds = [...new Set(validRecords.map(r => r.device_id))];
  const clientTimestamps = validRecords.map(r => r.client_timestamp);
  
  // Perform bulk sync with conflict resolution
  const syncResults = await attendanceRepository.bulkSync(validRecords);
  
  // Log sync activity
  await query(
    `INSERT INTO activities (user_id, action, entity_type, description, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      user.id,
      'sync',
      'attendance',
      `Synced ${syncResults.inserted.length + syncResults.updated.length} offline attendance records`,
      JSON.stringify({
        total_records: records.length,
        valid_records: validRecords.length,
        inserted: syncResults.inserted.length,
        updated: syncResults.updated.length,
        errors: syncResults.errors.length,
        validation_errors: validationErrors.length
      })
    ]
  );
  
  logger.info('Offline sync completed', {
    userId: user.id,
    inserted: syncResults.inserted.length,
    updated: syncResults.updated.length,
    errors: syncResults.errors.length
  });
  
  return {
    success: true,
    summary: {
      total_submitted: records.length,
      valid_records: validRecords.length,
      inserted: syncResults.inserted.length,
      updated: syncResults.updated.length,
      failed: syncResults.errors.length,
      validation_errors: validationErrors.length
    },
    validation_errors: validationErrors,
    sync_errors: syncResults.errors
  };
};

/**
 * Get user's attendance records
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Attendance records
 */
const getUserAttendance = async (userId, filters = {}) => {
  return await attendanceRepository.findAll({ ...filters, user_id: userId });
};

/**
 * Get all attendance records (admin)
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Attendance records
 */
const getAllAttendance = async (filters) => {
  return await attendanceRepository.findAll(filters);
};

/**
 * Get attendance statistics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Statistics
 */
const getAttendanceStatistics = async (filters) => {
  return await attendanceRepository.getStatistics(filters);
};

module.exports = {
  clockIn,
  clockOut,
  syncOfflineRecords,
  getUserAttendance,
  getAllAttendance,
  getAttendanceStatistics
};
