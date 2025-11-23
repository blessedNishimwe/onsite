// src/modules/facilities/facilities.routes.js
/**
 * Facilities Routes
 * Defines routes for facility endpoints
 */

const express = require('express');
const router = express.Router();
const facilitiesController = require('./facilities.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/roleAuth.middleware');
const { validateFacility, validateUUIDParam, validateQueryParams } = require('../../middleware/validation.middleware');
const { uploadRateLimiter, apiRateLimiter } = require('../../middleware/rateLimiter.middleware');

/**
 * @route   POST /api/facilities/import
 * @desc    Import facilities from CSV/Excel
 * @access  Private/Admin
 */
router.post(
  '/import',
  authenticate,
  requireAdmin,
  uploadRateLimiter,
  facilitiesController.upload.single('file'),
  facilitiesController.importFacilities
);

/**
 * @route   GET /api/facilities
 * @desc    Get all facilities
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  apiRateLimiter,
  validateQueryParams,
  facilitiesController.getAllFacilities
);

/**
 * @route   GET /api/facilities/:id
 * @desc    Get facility by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  validateUUIDParam('id'),
  facilitiesController.getFacilityById
);

/**
 * @route   POST /api/facilities
 * @desc    Create new facility
 * @access  Private/Admin
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  validateFacility,
  facilitiesController.createFacility
);

/**
 * @route   PUT /api/facilities/:id
 * @desc    Update facility
 * @access  Private/Admin
 */
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validateUUIDParam('id'),
  validateFacility,
  facilitiesController.updateFacility
);

/**
 * @route   DELETE /api/facilities/:id
 * @desc    Delete facility
 * @access  Private/Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  validateUUIDParam('id'),
  facilitiesController.deleteFacility
);

module.exports = router;
