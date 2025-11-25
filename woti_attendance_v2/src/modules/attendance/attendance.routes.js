// src/modules/attendance/attendance.routes.js
/**
 * Attendance Routes
 * Defines routes for attendance endpoints
 */

const express = require('express');
const router = express.Router();
const attendanceController = require('./attendance.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/roleAuth.middleware');
const { validateAttendance, validateClockOut, validateQueryParams } = require('../../middleware/validation.middleware');
const { apiRateLimiter } = require('../../middleware/rateLimiter.middleware');

/**
 * @route   POST /api/attendance/clock-in
 * @desc    Clock in user
 * @access  Private
 */
router.post(
  '/clock-in',
  authenticate,
  apiRateLimiter,
  validateAttendance,
  attendanceController.clockIn
);

/**
 * @route   POST /api/attendance/clock-out
 * @desc    Clock out user
 * @access  Private
 */
router.post(
  '/clock-out',
  authenticate,
  apiRateLimiter,
  validateClockOut,
  attendanceController.clockOut
);

/**
 * @route   POST /api/attendance/sync
 * @desc    Sync offline attendance records
 * @access  Private
 */
router.post(
  '/sync',
  authenticate,
  attendanceController.syncOfflineRecords
);

/**
 * @route   GET /api/attendance/my-records
 * @desc    Get current user's attendance records
 * @access  Private
 */
router.get(
  '/my-records',
  authenticate,
  validateQueryParams,
  attendanceController.getMyRecords
);

/**
 * @route   GET /api/attendance/stats
 * @desc    Get attendance statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  attendanceController.getStatistics
);

/**
 * @route   GET /api/attendance
 * @desc    Get all attendance records (admin)
 * @access  Private/Admin
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  validateQueryParams,
  attendanceController.getAllRecords
);

module.exports = router;
