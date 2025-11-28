// src/utils/geofencing.js
/**
 * Geofencing Utility
 * Provides geofence validation using PostGIS spatial functions
 */

const { query } = require('../config/database');
const logger = require('./logger');

/**
 * Calculate distance between two points using Haversine formula (fallback)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Validate if user is within geofence of a facility
 * Uses PostGIS ST_DistanceSphere for accurate distance calculation
 * Falls back to Haversine formula if PostGIS is not available
 * 
 * @param {string} facilityId - Facility UUID
 * @param {number} userLatitude - User's current latitude
 * @param {number} userLongitude - User's current longitude
 * @returns {Promise<Object>} Validation result
 */
const validateGeofence = async (facilityId, userLatitude, userLongitude) => {
  try {
    // First, try to use PostGIS for accurate distance calculation
    const result = await query(
      `SELECT 
        f.id,
        f.name,
        f.latitude,
        f.longitude,
        COALESCE(f.geofence_radius, 100) as geofence_radius,
        ST_DistanceSphere(
          ST_MakePoint(f.longitude, f.latitude),
          ST_MakePoint($2, $3)
        ) as distance_meters
      FROM facilities f
      WHERE f.id = $1 AND f.is_active = TRUE
        AND f.latitude IS NOT NULL AND f.longitude IS NOT NULL`,
      [facilityId, userLongitude, userLatitude]
    );

    if (result.rows.length === 0) {
      // Facility not found or no coordinates, try without PostGIS
      const fallbackResult = await query(
        `SELECT 
          id, name, latitude, longitude,
          COALESCE(geofence_radius, 100) as geofence_radius
        FROM facilities
        WHERE id = $1 AND is_active = TRUE`,
        [facilityId]
      );

      if (fallbackResult.rows.length === 0) {
        return {
          isWithinGeofence: false,
          distance: null,
          maxRadius: null,
          error: 'Facility not found or inactive'
        };
      }

      const facility = fallbackResult.rows[0];

      if (!facility.latitude || !facility.longitude) {
        // No facility coordinates - BLOCK clock-in for security
        logger.warn('Facility has no coordinates, geofencing blocked', { facilityId });
        return {
          isWithinGeofence: false,
          distance: null,
          maxRadius: facility.geofence_radius,
          error: 'Facility location not configured. Please contact your administrator.'
        };
      }

      // Use Haversine fallback
      const distance = haversineDistance(
        parseFloat(facility.latitude),
        parseFloat(facility.longitude),
        userLatitude,
        userLongitude
      );

      return {
        isWithinGeofence: distance <= facility.geofence_radius,
        distance: Math.round(distance),
        maxRadius: facility.geofence_radius,
        method: 'haversine'
      };
    }

    const facility = result.rows[0];
    const distance = Math.round(facility.distance_meters);

    logger.debug('Geofence validation', {
      facilityId,
      facilityName: facility.name,
      distance,
      maxRadius: facility.geofence_radius,
      isWithin: distance <= facility.geofence_radius
    });

    return {
      isWithinGeofence: distance <= facility.geofence_radius,
      distance,
      maxRadius: facility.geofence_radius,
      facilityName: facility.name,
      method: 'postgis'
    };
  } catch (error) {
    // Check if this is a PostGIS-related error (function not found, extension not installed, etc.)
    const isPostgisError = error.code === '42883' || // undefined_function
                           error.code === '42846' || // cannot_coerce
                           (error.message && (
                             error.message.includes('ST_DistanceSphere') ||
                             error.message.includes('ST_MakePoint') ||
                             error.message.includes('postgis')
                           ));

    if (isPostgisError) {
      logger.warn('PostGIS not available, using Haversine fallback', { 
        errorCode: error.code, 
        error: error.message 
      });
      
      const fallbackResult = await query(
        `SELECT 
          id, name, latitude, longitude,
          COALESCE(geofence_radius, 100) as geofence_radius
        FROM facilities
        WHERE id = $1 AND is_active = TRUE`,
        [facilityId]
      );

      if (fallbackResult.rows.length === 0) {
        return {
          isWithinGeofence: false,
          distance: null,
          maxRadius: null,
          error: 'Facility not found or inactive'
        };
      }

      const facility = fallbackResult.rows[0];

      if (!facility.latitude || !facility.longitude) {
        // No facility coordinates - BLOCK clock-in for security
        return {
          isWithinGeofence: false,
          distance: null,
          maxRadius: facility.geofence_radius,
          error: 'Facility location not configured. Please contact your administrator.'
        };
      }

      const distance = haversineDistance(
        parseFloat(facility.latitude),
        parseFloat(facility.longitude),
        userLatitude,
        userLongitude
      );

      return {
        isWithinGeofence: distance <= facility.geofence_radius,
        distance: Math.round(distance),
        maxRadius: facility.geofence_radius,
        method: 'haversine'
      };
    }

    logger.error('Geofence validation error:', error);
    throw error;
  }
};

/**
 * Get facility location details
 * @param {string} facilityId - Facility UUID
 * @returns {Promise<Object|null>} Facility location or null
 */
const getFacilityLocation = async (facilityId) => {
  const result = await query(
    `SELECT 
      id, name, latitude, longitude,
      COALESCE(geofence_radius, 100) as geofence_radius
    FROM facilities
    WHERE id = $1 AND is_active = TRUE`,
    [facilityId]
  );

  return result.rows[0] || null;
};

module.exports = {
  validateGeofence,
  getFacilityLocation,
  haversineDistance
};
