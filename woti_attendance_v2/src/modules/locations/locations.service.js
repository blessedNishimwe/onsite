// src/modules/locations/locations.service.js
/**
 * Locations Service
 * Business logic for geographic data operations
 */

const locationsRepository = require('./locations.repository');
const logger = require('../../utils/logger');

/**
 * Get all active regions
 * @returns {Promise<Array>} List of regions
 */
const getRegions = async () => {
  try {
    const regions = await locationsRepository.getAllRegions();
    logger.debug('Fetched regions', { count: regions.length });
    return regions;
  } catch (error) {
    logger.error('Error fetching regions:', error);
    throw error;
  }
};

/**
 * Get councils filtered by region
 * @param {string} regionId - Region ID
 * @returns {Promise<Array>} List of councils
 */
const getCouncilsByRegion = async (regionId) => {
  try {
    const councils = await locationsRepository.getCouncilsByRegion(regionId);
    logger.debug('Fetched councils', { regionId, count: councils.length });
    return councils;
  } catch (error) {
    logger.error('Error fetching councils:', error);
    throw error;
  }
};

/**
 * Get facilities filtered by council
 * @param {string} councilId - Council ID
 * @returns {Promise<Array>} List of facilities
 */
const getFacilitiesByCouncil = async (councilId) => {
  try {
    const facilities = await locationsRepository.getFacilitiesByCouncil(councilId);
    logger.debug('Fetched facilities', { councilId, count: facilities.length });
    return facilities;
  } catch (error) {
    logger.error('Error fetching facilities:', error);
    throw error;
  }
};

/**
 * Verify facility exists and is active
 * @param {string} facilityId - Facility ID
 * @returns {Promise<Object|null>} Facility or null
 */
const verifyFacility = async (facilityId) => {
  return await locationsRepository.verifyFacility(facilityId);
};

module.exports = {
  getRegions,
  getCouncilsByRegion,
  getFacilitiesByCouncil,
  verifyFacility
};
