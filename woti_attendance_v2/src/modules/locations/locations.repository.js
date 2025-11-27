// src/modules/locations/locations.repository.js
/**
 * Locations Repository
 * Database queries for regions, councils, and facilities
 */

const { query } = require('../../config/database');

/**
 * Get all active regions
 * @returns {Promise<Array>} List of regions
 */
const getAllRegions = async () => {
  const result = await query(
    `SELECT id, name, code, description
     FROM regions
     WHERE is_active = TRUE
     ORDER BY name ASC`
  );
  
  return result.rows;
};

/**
 * Get councils filtered by region
 * @param {string} regionId - Region ID
 * @returns {Promise<Array>} List of councils
 */
const getCouncilsByRegion = async (regionId) => {
  const result = await query(
    `SELECT id, name, code, description, region_id
     FROM councils
     WHERE region_id = $1 AND is_active = TRUE
     ORDER BY name ASC`,
    [regionId]
  );
  
  return result.rows;
};

/**
 * Get facilities filtered by council
 * @param {string} councilId - Council ID
 * @returns {Promise<Array>} List of facilities
 */
const getFacilitiesByCouncil = async (councilId) => {
  const result = await query(
    `SELECT id, name, code, facility_type, latitude, longitude
     FROM facilities
     WHERE council_id = $1 AND is_active = TRUE
     ORDER BY name ASC`,
    [councilId]
  );
  
  return result.rows;
};

/**
 * Verify facility exists and is active
 * @param {string} facilityId - Facility ID
 * @returns {Promise<Object|null>} Facility or null
 */
const verifyFacility = async (facilityId) => {
  const result = await query(
    `SELECT id, name, code, council_id, is_active
     FROM facilities
     WHERE id = $1 AND is_active = TRUE`,
    [facilityId]
  );
  
  return result.rows[0] || null;
};

module.exports = {
  getAllRegions,
  getCouncilsByRegion,
  getFacilitiesByCouncil,
  verifyFacility
};
