// src/utils/spoofingDetection.js
/**
 * GPS Spoofing Detection Utility
 * Provides functions to detect potential GPS spoofing or fraudulent location data
 */

const { query } = require('../config/database');
const logger = require('./logger');
const { haversineDistance } = require('./geofencing');

// Maximum realistic travel speed in km/h
const MAX_SPEED_KMH = 150;

// GPS accuracy thresholds in meters
const MIN_SUSPICIOUS_ACCURACY = 1; // Too perfect (possibly fake)
const MAX_ACCEPTABLE_ACCURACY = 500; // Too inaccurate

/**
 * Detect impossible travel speed between two locations
 * @param {Object} lastLocation - Previous location {latitude, longitude, timestamp}
 * @param {Object} currentLocation - Current location {latitude, longitude, timestamp}
 * @returns {Object} Detection result
 */
const detectImpossibleSpeed = (lastLocation, currentLocation) => {
  if (!lastLocation || !currentLocation) {
    return { suspicious: false, speed: null, reason: null };
  }

  if (!lastLocation.latitude || !lastLocation.longitude || 
      !currentLocation.latitude || !currentLocation.longitude) {
    return { suspicious: false, speed: null, reason: null };
  }

  const lastTime = new Date(lastLocation.timestamp);
  const currentTime = new Date(currentLocation.timestamp);
  const timeDiffHours = (currentTime - lastTime) / (1000 * 60 * 60);

  // If time difference is too small or negative, flag as suspicious
  if (timeDiffHours <= 0) {
    return { 
      suspicious: true, 
      speed: null, 
      reason: 'Invalid time sequence detected'
    };
  }

  // Calculate distance in meters
  const distanceMeters = haversineDistance(
    lastLocation.latitude,
    lastLocation.longitude,
    currentLocation.latitude,
    currentLocation.longitude
  );

  // Calculate speed in km/h
  const distanceKm = distanceMeters / 1000;
  const speedKmh = distanceKm / timeDiffHours;

  if (speedKmh > MAX_SPEED_KMH) {
    logger.warn('Impossible speed detected', {
      speedKmh: Math.round(speedKmh),
      maxAllowed: MAX_SPEED_KMH,
      distanceKm: distanceKm.toFixed(2),
      timeDiffHours: timeDiffHours.toFixed(2)
    });

    return {
      suspicious: true,
      speed: Math.round(speedKmh),
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      timeDiffHours: parseFloat(timeDiffHours.toFixed(2)),
      reason: `Travel speed of ${Math.round(speedKmh)} km/h exceeds maximum allowed (${MAX_SPEED_KMH} km/h)`
    };
  }

  return { 
    suspicious: false, 
    speed: Math.round(speedKmh),
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    timeDiffHours: parseFloat(timeDiffHours.toFixed(2)),
    reason: null 
  };
};

/**
 * Detect mock location based on is_mocked flag
 * @param {boolean} isMocked - Mock location flag from device
 * @returns {Object} Detection result
 */
const detectMockLocation = (isMocked) => {
  if (isMocked === true) {
    return {
      suspicious: true,
      reason: 'Mock location detected. Please disable fake GPS apps.'
    };
  }
  return { suspicious: false, reason: null };
};

/**
 * Validate GPS accuracy
 * @param {number} accuracy - GPS accuracy in meters
 * @returns {Object} Validation result
 */
const validateGpsAccuracy = (accuracy) => {
  if (accuracy === undefined || accuracy === null) {
    return { valid: true, warning: null, error: null };
  }

  if (accuracy > MAX_ACCEPTABLE_ACCURACY) {
    return {
      valid: false,
      warning: null,
      error: `GPS accuracy too low (${Math.round(accuracy)}m). Please move to an open area for better GPS signal.`
    };
  }

  if (accuracy < MIN_SUSPICIOUS_ACCURACY) {
    logger.warn('Suspiciously perfect GPS accuracy', { accuracy });
    return {
      valid: true,
      warning: `Unusually precise GPS reading (${accuracy}m). This may indicate a simulated location.`,
      error: null
    };
  }

  return { valid: true, warning: null, error: null };
};

/**
 * Get last attendance location for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Last attendance with location data
 */
const getLastAttendanceWithLocation = async (userId) => {
  const result = await query(
    `SELECT 
      id,
      clock_in_latitude as latitude,
      clock_in_longitude as longitude,
      clock_in_time as timestamp,
      metadata
    FROM attendance
    WHERE user_id = $1
      AND clock_in_latitude IS NOT NULL
      AND clock_in_longitude IS NOT NULL
    ORDER BY clock_in_time DESC
    LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

/**
 * Log suspicious activity
 * @param {string} userId - User UUID
 * @param {Object} details - Suspicious activity details
 * @returns {Promise<void>}
 */
const logSuspiciousActivity = async (userId, details) => {
  try {
    await query(
      `INSERT INTO activities (user_id, action, entity_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'suspicious_location',
        'attendance',
        details.reason || 'Suspicious GPS activity detected',
        JSON.stringify(details)
      ]
    );

    logger.warn('Suspicious location activity logged', {
      userId,
      reason: details.reason
    });
  } catch (error) {
    logger.error('Failed to log suspicious activity:', error);
  }
};

/**
 * Run all spoofing detection checks
 * @param {Object} locationData - Location data to validate
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Combined detection results
 */
const runSpoofingChecks = async (locationData, userId) => {
  const results = {
    passed: true,
    errors: [],
    warnings: [],
    flags: []
  };

  // Check mock location flag
  const mockCheck = detectMockLocation(locationData.is_mocked);
  if (mockCheck.suspicious) {
    results.passed = false;
    results.errors.push(mockCheck.reason);
    results.flags.push('mock_location');
  }

  // Check GPS accuracy
  const accuracyCheck = validateGpsAccuracy(locationData.accuracy);
  if (!accuracyCheck.valid) {
    results.passed = false;
    results.errors.push(accuracyCheck.error);
    results.flags.push('low_accuracy');
  }
  if (accuracyCheck.warning) {
    results.warnings.push(accuracyCheck.warning);
    results.flags.push('suspicious_accuracy');
  }

  // Check impossible speed
  if (userId && locationData.latitude && locationData.longitude) {
    const lastAttendance = await getLastAttendanceWithLocation(userId);
    if (lastAttendance) {
      const speedCheck = detectImpossibleSpeed(
        {
          latitude: parseFloat(lastAttendance.latitude),
          longitude: parseFloat(lastAttendance.longitude),
          timestamp: lastAttendance.timestamp
        },
        {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          timestamp: new Date()
        }
      );

      if (speedCheck.suspicious) {
        results.passed = false;
        results.errors.push(speedCheck.reason);
        results.flags.push('impossible_speed');

        // Log suspicious activity
        await logSuspiciousActivity(userId, {
          type: 'impossible_speed',
          reason: speedCheck.reason,
          speed: speedCheck.speed,
          distance: speedCheck.distanceKm,
          timeDiff: speedCheck.timeDiffHours
        });
      }
    }
  }

  return results;
};

module.exports = {
  detectImpossibleSpeed,
  detectMockLocation,
  validateGpsAccuracy,
  getLastAttendanceWithLocation,
  logSuspiciousActivity,
  runSpoofingChecks,
  MAX_SPEED_KMH,
  MIN_SUSPICIOUS_ACCURACY,
  MAX_ACCEPTABLE_ACCURACY
};
