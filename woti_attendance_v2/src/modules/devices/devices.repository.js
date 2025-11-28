// src/modules/devices/devices.repository.js
/**
 * Devices Repository
 * Database operations for user device management
 */

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Register or update a device for a user
 * @param {Object} deviceData - Device registration data
 * @returns {Promise<Object>} Registered device
 */
const registerDevice = async (deviceData) => {
  // Upsert device - update if exists, insert if not
  const result = await query(
    `INSERT INTO user_devices (
      user_id, device_fingerprint, device_id, device_name, 
      browser, platform, last_used_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (user_id, device_fingerprint) 
    DO UPDATE SET
      device_id = COALESCE(EXCLUDED.device_id, user_devices.device_id),
      device_name = COALESCE(EXCLUDED.device_name, user_devices.device_name),
      browser = COALESCE(EXCLUDED.browser, user_devices.browser),
      platform = COALESCE(EXCLUDED.platform, user_devices.platform),
      last_used_at = NOW(),
      updated_at = NOW()
    RETURNING *`,
    [
      deviceData.user_id,
      deviceData.device_fingerprint,
      deviceData.device_id || null,
      deviceData.device_name || null,
      deviceData.browser || null,
      deviceData.platform || null
    ]
  );
  
  logger.debug('Device registered/updated', {
    userId: deviceData.user_id,
    deviceId: result.rows[0].id
  });
  
  return result.rows[0];
};

/**
 * Find device by user and fingerprint
 * @param {string} userId - User ID
 * @param {string} fingerprint - Device fingerprint
 * @returns {Promise<Object|null>} Device or null
 */
const findDeviceByFingerprint = async (userId, fingerprint) => {
  const result = await query(
    `SELECT * FROM user_devices
     WHERE user_id = $1 AND device_fingerprint = $2`,
    [userId, fingerprint]
  );
  
  return result.rows[0] || null;
};

/**
 * Find all devices for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} User devices
 */
const findDevicesByUserId = async (userId) => {
  const result = await query(
    `SELECT id, device_fingerprint, device_id, device_name, 
            browser, platform, is_active, approved_at, 
            last_used_at, created_at
     FROM user_devices
     WHERE user_id = $1
     ORDER BY last_used_at DESC`,
    [userId]
  );
  
  return result.rows;
};

/**
 * Approve a device
 * @param {string} deviceId - Device ID
 * @param {string} approvedBy - Admin user ID who approved
 * @returns {Promise<Object|null>} Updated device or null
 */
const approveDevice = async (deviceId, approvedBy) => {
  const result = await query(
    `UPDATE user_devices 
     SET is_active = TRUE,
         approved_by = $2,
         approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [deviceId, approvedBy]
  );
  
  if (result.rows[0]) {
    logger.info('Device approved', {
      deviceId,
      approvedBy
    });
  }
  
  return result.rows[0] || null;
};

/**
 * Revoke a device
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} Whether device was revoked
 */
const revokeDevice = async (deviceId) => {
  const result = await query(
    `UPDATE user_devices 
     SET is_active = FALSE,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [deviceId]
  );
  
  if (result.rows.length > 0) {
    logger.info('Device revoked', { deviceId });
    return true;
  }
  
  return false;
};

/**
 * Update last used timestamp for a device
 * @param {string} deviceId - Device ID
 * @returns {Promise<void>}
 */
const updateLastUsed = async (deviceId) => {
  await query(
    `UPDATE user_devices 
     SET last_used_at = NOW()
     WHERE id = $1`,
    [deviceId]
  );
};

/**
 * Count devices for a user
 * @param {string} userId - User ID
 * @param {boolean} onlyActive - Count only active devices
 * @returns {Promise<number>} Device count
 */
const countDevices = async (userId, onlyActive = false) => {
  let queryText = `
    SELECT COUNT(*) as count
    FROM user_devices
    WHERE user_id = $1
  `;
  
  if (onlyActive) {
    queryText += ' AND is_active = TRUE';
  }
  
  const result = await query(queryText, [userId]);
  return parseInt(result.rows[0].count);
};

/**
 * Delete a device
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} Whether device was deleted
 */
const deleteDevice = async (deviceId) => {
  const result = await query(
    'DELETE FROM user_devices WHERE id = $1 RETURNING id',
    [deviceId]
  );
  
  return result.rows.length > 0;
};

module.exports = {
  registerDevice,
  findDeviceByFingerprint,
  findDevicesByUserId,
  approveDevice,
  revokeDevice,
  updateLastUsed,
  countDevices,
  deleteDevice
};
