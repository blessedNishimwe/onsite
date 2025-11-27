// src/modules/timesheet/timesheet.controller.js
/**
 * Timesheet Controller
 * Handles HTTP requests for timesheet endpoints
 */

const timesheetService = require('./timesheet.service');
const pdfGenerator = require('./pdfGenerator');
const htmlGenerator = require('./htmlGenerator');
const { asyncHandler } = require('../../middleware/errorHandler.middleware');

/**
 * Get all active activities
 * GET /api/timesheet/activities
 */
const getActivities = asyncHandler(async (req, res) => {
  const activities = await timesheetService.getActivities();

  res.status(200).json({
    success: true,
    data: { activities }
  });
});

/**
 * Get monthly timesheet data
 * GET /api/timesheet/monthly?month=&year=&user_id=
 */
const getMonthlyTimesheet = asyncHandler(async (req, res) => {
  const { month, year, user_id } = req.query;

  // Validate required parameters
  if (!month || !year) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Month and year are required'
    });
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Month must be a number between 1 and 12'
    });
  }

  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Year must be a valid year'
    });
  }

  // Determine which user's timesheet to fetch
  let targetUserId = req.user.id;

  if (user_id) {
    // Only admins and supervisors can view other users' timesheets
    const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor' || req.user.role === 'backstopper';
    
    if (!isAdmin && user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own timesheet'
      });
    }
    targetUserId = user_id;
  }

  const timesheetData = await timesheetService.getMonthlyTimesheet(targetUserId, monthNum, yearNum);

  res.status(200).json({
    success: true,
    data: timesheetData
  });
});

/**
 * Generate timesheet PDF or HTML
 * POST /api/timesheet/generate
 */
const generateTimesheet = asyncHandler(async (req, res) => {
  const { month, year, user_id, format = 'pdf' } = req.body;

  // Validate required parameters
  if (!month || !year) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Month and year are required'
    });
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Month must be a number between 1 and 12'
    });
  }

  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Year must be a valid year'
    });
  }

  // Determine which user's timesheet to generate
  let targetUserId = req.user.id;

  if (user_id) {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor' || req.user.role === 'backstopper';
    
    if (!isAdmin && user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only generate your own timesheet'
      });
    }
    targetUserId = user_id;
  }

  // Get timesheet data
  const timesheetData = await timesheetService.getMonthlyTimesheet(targetUserId, monthNum, yearNum);

  // Generate the document
  if (format === 'html') {
    const html = htmlGenerator.generateTimesheetHTML(timesheetData);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } else {
    // Default to PDF
    const pdfBuffer = await pdfGenerator.generateTimesheetPDF(timesheetData);
    
    const filename = `timesheet_${timesheetData.user.lastName}_${timesheetData.period.monthName}_${yearNum}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(pdfBuffer);
  }
});

/**
 * Update attendance activity
 * PUT /api/attendance/:id/activity
 */
const updateAttendanceActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { activity_id, activity_description } = req.body;

  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Attendance ID is required'
    });
  }

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid attendance ID format'
    });
  }

  if (activity_id && !uuidRegex.test(activity_id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid activity ID format'
    });
  }

  const updated = await timesheetService.updateAttendanceActivity(
    id,
    activity_id,
    activity_description,
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Activity updated successfully',
    data: { attendance: updated }
  });
});

/**
 * Validate timesheet before generation
 * GET /api/timesheet/validate?month=&year=&user_id=
 */
const validateTimesheet = asyncHandler(async (req, res) => {
  const { month, year, user_id } = req.query;

  if (!month || !year) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Month and year are required'
    });
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  let targetUserId = req.user.id;

  if (user_id) {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor' || req.user.role === 'backstopper';
    
    if (!isAdmin && user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only validate your own timesheet'
      });
    }
    targetUserId = user_id;
  }

  const validation = await timesheetService.validateTimesheet(targetUserId, monthNum, yearNum);

  res.status(200).json({
    success: true,
    data: validation
  });
});

module.exports = {
  getActivities,
  getMonthlyTimesheet,
  generateTimesheet,
  updateAttendanceActivity,
  validateTimesheet
};
