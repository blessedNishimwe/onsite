// src/modules/attendance/attendance.service.js
/**
 * Attendance Service
 * Business logic for attendance operations with offline sync, geofencing and spoofing detection
 */

const attendanceRepository = require('./attendance.repository');
const { validateSyncMetadata } = require('../../utils/syncResolver');
const logger = require('../../utils/logger');
const { query } = require('../../config/database');
const { validateGeofence } = require('../../utils/geofencing');
const { runSpoofingChecks, MAX_ACCEPTABLE_ACCURACY } = require('../../utils/spoofingDetection');
const { validateGpsCoordinates } = require('../../utils/validators');

/**
 * Clock in user with GPS validation
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

  // Use user's facility_id if not provided in request
  const facilityId = clockInData.facility_id || user.facility_id;
  
  if (!facilityId) {
    throw new Error('Facility ID is required. Please ensure you are assigned to a facility.');
  }

  // Initialize metadata for GPS tracking
  const metadata = {
    ...clockInData.metadata,
    clock_in_method: clockInData.synced === false ? 'offline' : 'online'
  };

  // Initialize validation status and tracking fields
  let validationStatus = 'verified';
  let clockInAccuracyMeters = null;
  let clockInDistanceMeters = null;
  const deviceFingerprint = clockInData.device_fingerprint || null;

  // For online clock-ins, GPS is REQUIRED
  if (clockInData.synced !== false) {
    // Validate GPS coordinates are provided and valid
    const coordValidation = validateGpsCoordinates(
      clockInData.clock_in_latitude,
      clockInData.clock_in_longitude
    );

    if (!coordValidation.isValid) {
      throw new Error(coordValidation.error);
    }

    if (coordValidation.warning) {
      metadata.coordinate_warning = coordValidation.warning;
      validationStatus = 'flagged';
    }

    // Validate accuracy is provided and acceptable
    if (clockInData.accuracy === undefined || clockInData.accuracy === null) {
      throw new Error('GPS accuracy is required for clock-in');
    }

    if (clockInData.accuracy > MAX_ACCEPTABLE_ACCURACY) {
      throw new Error(`GPS accuracy too low (${Math.round(clockInData.accuracy)}m). Maximum allowed: ${MAX_ACCEPTABLE_ACCURACY}m. Please move to an open area for better GPS signal.`);
    }

    clockInAccuracyMeters = clockInData.accuracy;

    // 1. Run spoofing detection checks
    const spoofingResult = await runSpoofingChecks({
      latitude: clockInData.clock_in_latitude,
      longitude: clockInData.clock_in_longitude,
      accuracy: clockInData.accuracy,
      is_mocked: clockInData.is_mocked
    }, user.id);

    if (!spoofingResult.passed) {
      throw new Error(spoofingResult.errors[0] || 'Location verification failed');
    }

    // Store spoofing warnings in metadata
    if (spoofingResult.warnings.length > 0) {
      metadata.spoofing_warnings = spoofingResult.warnings;
      metadata.spoofing_flags = spoofingResult.flags;
      validationStatus = 'flagged';
    }

    // 2. Validate geofence
    const geofenceResult = await validateGeofence(
      facilityId,
      clockInData.clock_in_latitude,
      clockInData.clock_in_longitude
    );

    if (geofenceResult.error) {
      throw new Error(geofenceResult.error);
    }

    if (!geofenceResult.isWithinGeofence) {
      throw new Error(
        `You are ${geofenceResult.distance}m away from ${geofenceResult.facilityName || 'facility'}. Maximum allowed: ${geofenceResult.maxRadius}m`
      );
    }

    // Store distance for tracking
    clockInDistanceMeters = geofenceResult.distance;

    // Store geofence data in metadata
    metadata.distance_from_facility = geofenceResult.distance;
    metadata.geofence_radius = geofenceResult.maxRadius;
    metadata.gps_accuracy = clockInData.accuracy;

    if (geofenceResult.warning) {
      metadata.geofence_warning = geofenceResult.warning;
    }
  } else {
    // Offline clock-in - mark as unverified
    validationStatus = 'unverified';
  }
  
  const attendanceData = {
    user_id: user.id,
    facility_id: facilityId,
    clock_in_time: clockInData.clock_in_time || new Date().toISOString(),
    clock_in_latitude: clockInData.clock_in_latitude,
    clock_in_longitude: clockInData.clock_in_longitude,
    clock_in_accuracy_meters: clockInAccuracyMeters,
    clock_in_distance_meters: clockInDistanceMeters,
    device_fingerprint: deviceFingerprint,
    validation_status: validationStatus,
    device_id: clockInData.device_id,
    client_timestamp: clockInData.client_timestamp || new Date().toISOString(),
    synced: clockInData.synced !== undefined ? clockInData.synced : true,
    metadata
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
      JSON.stringify({ 
        facility_id: attendance.facility_id, 
        device_id: attendance.device_id,
        distance_from_facility: metadata.distance_from_facility 
      })
    ]
  );
  
  logger.info('User clocked in', {
    userId: user.id,
    attendanceId: attendance.id,
    facilityId: attendance.facility_id,
    distance: metadata.distance_from_facility
  });
  
  return attendance;
};

/**
 * Clock out user with GPS validation
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

  // Initialize metadata
  const metadata = {
    ...activeAttendance.metadata,
    ...clockOutData.metadata,
    clock_out_method: clockOutData.synced === false ? 'offline' : 'online'
  };

  // Initialize clock-out tracking fields
  let clockOutAccuracyMeters = null;
  let clockOutDistanceMeters = null;

  // For online clock-outs, GPS is REQUIRED
  if (clockOutData.synced !== false) {
    // Validate GPS coordinates are provided and valid
    const coordValidation = validateGpsCoordinates(
      clockOutData.clock_out_latitude,
      clockOutData.clock_out_longitude
    );

    if (!coordValidation.isValid) {
      throw new Error(coordValidation.error);
    }

    if (coordValidation.warning) {
      metadata.clock_out_coordinate_warning = coordValidation.warning;
    }

    // Validate accuracy is provided and acceptable
    if (clockOutData.accuracy === undefined || clockOutData.accuracy === null) {
      throw new Error('GPS accuracy is required for clock-out');
    }

    if (clockOutData.accuracy > MAX_ACCEPTABLE_ACCURACY) {
      throw new Error(`GPS accuracy too low (${Math.round(clockOutData.accuracy)}m). Maximum allowed: ${MAX_ACCEPTABLE_ACCURACY}m. Please move to an open area for better GPS signal.`);
    }

    clockOutAccuracyMeters = clockOutData.accuracy;

    // 1. Run spoofing detection checks
    const spoofingResult = await runSpoofingChecks({
      latitude: clockOutData.clock_out_latitude,
      longitude: clockOutData.clock_out_longitude,
      accuracy: clockOutData.accuracy,
      is_mocked: clockOutData.is_mocked
    }, user.id);

    if (!spoofingResult.passed) {
      throw new Error(spoofingResult.errors[0] || 'Location verification failed');
    }

    // Store spoofing warnings in metadata
    if (spoofingResult.warnings.length > 0) {
      metadata.clock_out_spoofing_warnings = spoofingResult.warnings;
      metadata.clock_out_spoofing_flags = spoofingResult.flags;
    }

    // 2. Validate geofence for clock-out
    const geofenceResult = await validateGeofence(
      activeAttendance.facility_id,
      clockOutData.clock_out_latitude,
      clockOutData.clock_out_longitude
    );

    if (geofenceResult.error) {
      throw new Error(geofenceResult.error);
    }

    if (!geofenceResult.isWithinGeofence) {
      throw new Error(
        `You are ${geofenceResult.distance}m away from ${geofenceResult.facilityName || 'facility'}. Maximum allowed: ${geofenceResult.maxRadius}m`
      );
    }

    // Store distance for tracking
    clockOutDistanceMeters = geofenceResult.distance;

    // Store geofence data in metadata
    metadata.clock_out_distance_from_facility = geofenceResult.distance;
    metadata.clock_out_gps_accuracy = clockOutData.accuracy;

    if (geofenceResult.warning) {
      metadata.clock_out_geofence_warning = geofenceResult.warning;
    }
  }
  
  const clockOutInfo = {
    clock_out_time: clockOutData.clock_out_time || new Date().toISOString(),
    clock_out_latitude: clockOutData.clock_out_latitude,
    clock_out_longitude: clockOutData.clock_out_longitude,
    clock_out_accuracy_meters: clockOutAccuracyMeters,
    clock_out_distance_meters: clockOutDistanceMeters,
    notes: clockOutData.notes,
    metadata
  };
  
  const attendance = await attendanceRepository.clockOut(activeAttendance.id, clockOutInfo);
  
  // Calculate duration
  const durationHours = attendance.clock_out_time 
    ? (new Date(attendance.clock_out_time) - new Date(attendance.clock_in_time)) / (1000 * 60 * 60) 
    : null;

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
      JSON.stringify({ 
        facility_id: attendance.facility_id, 
        duration_hours: durationHours,
        distance_from_facility: metadata.clock_out_distance_from_facility
      })
    ]
  );
  
  logger.info('User clocked out', {
    userId: user.id,
    attendanceId: attendance.id,
    durationHours,
    distance: metadata.clock_out_distance_from_facility
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
 * Get current attendance status for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Active attendance or null
 */
const getCurrentStatus = async (userId) => {
  return await attendanceRepository.findActiveByUserId(userId);
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
  getCurrentStatus,
  getUserAttendance,
  getAllAttendance,
  getAttendanceStatistics
};
