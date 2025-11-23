// src/modules/facilities/facilities.controller.js
/**
 * Facilities Controller
 * Handles HTTP requests for facility endpoints
 */

const multer = require('multer');
const path = require('path');
const facilitiesService = require('./facilities.service');
const { asyncHandler } = require('../../middleware/errorHandler.middleware');
const { validatePagination, validateUploadedFile } = require('../../utils/validators');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const validation = validateUploadedFile(file);
    if (!validation.isValid) {
      cb(new Error(validation.errors.join(', ')), false);
    } else {
      cb(null, true);
    }
  }
});

/**
 * Import facilities from CSV/Excel
 * POST /api/facilities/import
 */
const importFacilities = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No file uploaded'
    });
  }
  
  const result = await facilitiesService.importFacilities(req.file, req.user);
  
  res.status(200).json({
    success: true,
    message: `Successfully imported ${result.summary.inserted} facilities`,
    data: result
  });
});

/**
 * Get all facilities
 * GET /api/facilities
 */
const getAllFacilities = asyncHandler(async (req, res) => {
  const { page, limit } = validatePagination(req.query.page, req.query.limit);
  
  const filters = {
    council_id: req.query.council_id,
    region_id: req.query.region_id,
    facility_type: req.query.facility_type,
    is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
    search: req.query.search,
    page,
    limit,
    sortBy: req.query.sort || 'created_at',
    sortOrder: req.query.order || 'DESC'
  };
  
  const result = await facilitiesService.getAllFacilities(filters);
  
  res.status(200).json({
    success: true,
    data: {
      facilities: result.facilities,
      pagination: result.pagination
    }
  });
});

/**
 * Get facility by ID
 * GET /api/facilities/:id
 */
const getFacilityById = asyncHandler(async (req, res) => {
  const facility = await facilitiesService.getFacilityById(req.params.id);
  
  res.status(200).json({
    success: true,
    data: { facility }
  });
});

/**
 * Create facility
 * POST /api/facilities
 */
const createFacility = asyncHandler(async (req, res) => {
  const facility = await facilitiesService.createFacility(req.body, req.user);
  
  res.status(201).json({
    success: true,
    message: 'Facility created successfully',
    data: { facility }
  });
});

/**
 * Update facility
 * PUT /api/facilities/:id
 */
const updateFacility = asyncHandler(async (req, res) => {
  const facility = await facilitiesService.updateFacility(req.params.id, req.body, req.user);
  
  res.status(200).json({
    success: true,
    message: 'Facility updated successfully',
    data: { facility }
  });
});

/**
 * Delete facility
 * DELETE /api/facilities/:id
 */
const deleteFacility = asyncHandler(async (req, res) => {
  await facilitiesService.deleteFacility(req.params.id, req.user);
  
  res.status(200).json({
    success: true,
    message: 'Facility deactivated successfully'
  });
});

module.exports = {
  upload,
  importFacilities,
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility
};
