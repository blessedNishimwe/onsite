// src/modules/timesheet/timesheet.routes.js
/**
 * Timesheet Routes
 * Defines routes for timesheet endpoints
 */

const express = require('express');
const router = express.Router();
const timesheetController = require('./timesheet.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { apiRateLimiter } = require('../../middleware/rateLimiter.middleware');

/**
 * @route   GET /api/timesheet/activities
 * @desc    Get all active activities for dropdown
 * @access  Public (needed for dropdown population)
 */
router.get(
  '/activities',
  apiRateLimiter,
  timesheetController.getActivities
);

/**
 * @route   GET /api/timesheet/monthly
 * @desc    Get monthly timesheet data
 * @access  Private
 * @query   month - Month number (1-12)
 * @query   year - Year (e.g., 2025)
 * @query   user_id - Optional user ID (admin/supervisor only)
 */
router.get(
  '/monthly',
  authenticate,
  apiRateLimiter,
  timesheetController.getMonthlyTimesheet
);

/**
 * @route   GET /api/timesheet/validate
 * @desc    Validate timesheet completeness
 * @access  Private
 * @query   month - Month number (1-12)
 * @query   year - Year
 * @query   user_id - Optional user ID (admin/supervisor only)
 */
router.get(
  '/validate',
  authenticate,
  apiRateLimiter,
  timesheetController.validateTimesheet
);

/**
 * @route   POST /api/timesheet/generate
 * @desc    Generate timesheet PDF or HTML
 * @access  Private
 * @body    month - Month number (1-12)
 * @body    year - Year
 * @body    user_id - Optional user ID (admin/supervisor only)
 * @body    format - 'pdf' or 'html' (default: 'pdf')
 */
router.post(
  '/generate',
  authenticate,
  apiRateLimiter,
  timesheetController.generateTimesheet
);

/**
 * @route   PUT /api/timesheet/attendance/:id/activity
 * @desc    Update activity for attendance record
 * @access  Private (owner or admin)
 * @param   id - Attendance UUID
 * @body    activity_id - Activity UUID
 * @body    activity_description - Optional description
 */
router.put(
  '/attendance/:id/activity',
  authenticate,
  apiRateLimiter,
  timesheetController.updateAttendanceActivity
);

module.exports = router;
