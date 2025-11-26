// src/modules/locations/locations.routes.js
/**
 * Locations Routes
 * Defines routes for location endpoints (regions, councils, facilities)
 * Public routes for signup cascading dropdowns
 */

const express = require('express');
const router = express.Router();
const locationsController = require('./locations.controller');
const { apiRateLimiter } = require('../../middleware/rateLimiter.middleware');

/**
 * @route   GET /api/locations/regions
 * @desc    Get all active regions
 * @access  Public
 */
router.get(
  '/regions',
  apiRateLimiter,
  locationsController.getRegions
);

/**
 * @route   GET /api/locations/councils
 * @desc    Get councils filtered by region
 * @access  Public
 */
router.get(
  '/councils',
  apiRateLimiter,
  locationsController.getCouncils
);

/**
 * @route   GET /api/locations/facilities
 * @desc    Get facilities filtered by council
 * @access  Public
 */
router.get(
  '/facilities',
  apiRateLimiter,
  locationsController.getFacilities
);

module.exports = router;
