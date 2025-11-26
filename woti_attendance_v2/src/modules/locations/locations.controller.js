// src/modules/locations/locations.controller.js
/**
 * Locations Controller
 * Handles HTTP requests for location endpoints (regions, councils, facilities)
 */

const locationsService = require('./locations.service');
const { asyncHandler } = require('../../middleware/errorHandler.middleware');

/**
 * Get all active regions
 * GET /api/locations/regions
 */
const getRegions = asyncHandler(async (req, res) => {
  const regions = await locationsService.getRegions();
  
  res.status(200).json({
    success: true,
    data: { regions }
  });
});

/**
 * Get councils filtered by region
 * GET /api/locations/councils?region_id=
 */
const getCouncils = asyncHandler(async (req, res) => {
  const { region_id } = req.query;
  
  if (!region_id) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'region_id query parameter is required'
    });
  }
  
  const councils = await locationsService.getCouncilsByRegion(region_id);
  
  res.status(200).json({
    success: true,
    data: { councils }
  });
});

/**
 * Get facilities filtered by council
 * GET /api/locations/facilities?council_id=
 */
const getFacilities = asyncHandler(async (req, res) => {
  const { council_id } = req.query;
  
  if (!council_id) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'council_id query parameter is required'
    });
  }
  
  const facilities = await locationsService.getFacilitiesByCouncil(council_id);
  
  res.status(200).json({
    success: true,
    data: { facilities }
  });
});

module.exports = {
  getRegions,
  getCouncils,
  getFacilities
};
