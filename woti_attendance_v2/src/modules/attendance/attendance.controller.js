// src/modules/attendance/attendance.controller.js
/**
 * Attendance Controller
 * Handles HTTP requests for attendance endpoints
 */

const attendanceService = require('./attendance.service');
const { asyncHandler } = require('../../middleware/errorHandler.middleware');
const { validatePagination } = require('../../utils/validators');

/**
 * Clock in
 * POST /api/attendance/clock-in
 */
const clockIn = asyncHandler(async (req, res) => {
  const attendance = await attendanceService.clockIn(req.body, req.user);
  
  res.status(201).json({
    success: true,
    message: 'Clocked in successfully',
    data: { attendance }
  });
});

/**
 * Clock out
 * POST /api/attendance/clock-out
 */
const clockOut = asyncHandler(async (req, res) => {
  const attendance = await attendanceService.clockOut(req.body, req.user);
  
  res.status(200).json({
    success: true,
    message: 'Clocked out successfully',
    data: { attendance }
  });
});

/**
 * Get current attendance status
 * GET /api/attendance/status
 */
const getStatus = asyncHandler(async (req, res) => {
  const activeAttendance = await attendanceService.getCurrentStatus(req.user.id);
  
  res.status(200).json({
    success: true,
    data: {
      isClockedIn: !!activeAttendance,
      activeAttendance: activeAttendance || null
    }
  });
});

/**
 * Sync offline records
 * POST /api/attendance/sync
 */
const syncOfflineRecords = asyncHandler(async (req, res) => {
  const { records } = req.body;
  
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Records array is required and must not be empty'
    });
  }
  
  const result = await attendanceService.syncOfflineRecords(records, req.user);
  
  res.status(200).json({
    success: result.success,
    message: `Synced ${result.summary?.inserted + result.summary?.updated || 0} records`,
    data: result
  });
});

/**
 * Get current user's attendance records
 * GET /api/attendance/my-records
 */
const getMyRecords = asyncHandler(async (req, res) => {
  const { page, limit } = validatePagination(req.query.page, req.query.limit);
  
  const filters = {
    status: req.query.status,
    start_date: req.query.start_date,
    end_date: req.query.end_date,
    page,
    limit,
    sortBy: req.query.sort || 'clock_in_time',
    sortOrder: req.query.order || 'DESC'
  };
  
  const result = await attendanceService.getUserAttendance(req.user.id, filters);
  
  res.status(200).json({
    success: true,
    data: {
      records: result.records,
      pagination: result.pagination
    }
  });
});

/**
 * Get all attendance records (admin)
 * GET /api/attendance
 */
const getAllRecords = asyncHandler(async (req, res) => {
  const { page, limit } = validatePagination(req.query.page, req.query.limit);
  
  const filters = {
    user_id: req.query.user_id,
    facility_id: req.query.facility_id,
    status: req.query.status,
    start_date: req.query.start_date,
    end_date: req.query.end_date,
    synced: req.query.synced !== undefined ? req.query.synced === 'true' : undefined,
    device_id: req.query.device_id,
    page,
    limit,
    sortBy: req.query.sort || 'clock_in_time',
    sortOrder: req.query.order || 'DESC'
  };
  
  const result = await attendanceService.getAllAttendance(filters);
  
  res.status(200).json({
    success: true,
    data: {
      records: result.records,
      pagination: result.pagination
    }
  });
});

/**
 * Get attendance statistics
 * GET /api/attendance/stats
 */
const getStatistics = asyncHandler(async (req, res) => {
  const filters = {
    user_id: req.query.user_id,
    facility_id: req.query.facility_id,
    start_date: req.query.start_date,
    end_date: req.query.end_date
  };
  
  // If not admin, only show own stats
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    filters.user_id = req.user.id;
  }
  
  const stats = await attendanceService.getAttendanceStatistics(filters);
  
  res.status(200).json({
    success: true,
    data: { stats }
  });
});

module.exports = {
  clockIn,
  clockOut,
  getStatus,
  syncOfflineRecords,
  getMyRecords,
  getAllRecords,
  getStatistics
};
