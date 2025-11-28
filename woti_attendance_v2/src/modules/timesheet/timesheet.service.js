// src/modules/timesheet/timesheet.service.js
/**
 * Timesheet Service
 * Business logic for timesheet operations
 */

const timesheetRepository = require('./timesheet.repository');
const logger = require('../../utils/logger');

/**
 * Get all active activities for dropdown
 * @returns {Promise<Array>} List of activities
 */
const getActivities = async () => {
  return await timesheetRepository.getActivities();
};

/**
 * Get monthly timesheet data for a user
 * @param {string} userId - User UUID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Object>} Timesheet data with user details and attendance
 */
const getMonthlyTimesheet = async (userId, month, year) => {
  // Validate month and year
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    throw new Error('Cannot generate timesheet for future months');
  }

  // Get user details
  const userDetails = await timesheetRepository.getUserDetails(userId);
  if (!userDetails) {
    throw new Error('User not found');
  }

  // Get attendance records for the month
  const attendanceRecords = await timesheetRepository.getMonthlyAttendance(userId, month, year);

  // Generate all days of the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthData = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const dayName = dayNames[dayOfWeek];
    const isSunday = dayOfWeek === 0;

    // Find attendance record for this day
    const attendance = attendanceRecords.find(record => {
      const recordDate = new Date(record.clock_in_time);
      return recordDate.getDate() === day;
    });

    monthData.push({
      day: dayName,
      date: formatDate(date),
      dateObj: date,
      isSunday,
      attendance: attendance ? {
        id: attendance.id,
        clockIn: attendance.clock_in_time ? formatTime(attendance.clock_in_time) : null,
        clockOut: attendance.clock_out_time ? formatTime(attendance.clock_out_time) : null,
        clockInTime: attendance.clock_in_time,
        clockOutTime: attendance.clock_out_time,
        hoursWorked: attendance.hours_worked ? parseFloat(attendance.hours_worked).toFixed(2) : null,
        activityId: attendance.activity_id,
        activityName: attendance.activity_name,
        activityDescription: attendance.activity_description,
        hasGps: !!(attendance.clock_in_latitude && attendance.clock_in_longitude),
        facilityName: attendance.facility_name,
        status: attendance.status,
        // Validation and GPS data
        validationStatus: attendance.validation_status || 'verified',
        clockInAccuracyMeters: attendance.clock_in_accuracy_meters,
        clockOutAccuracyMeters: attendance.clock_out_accuracy_meters,
        clockInDistanceMeters: attendance.clock_in_distance_meters,
        clockOutDistanceMeters: attendance.clock_out_distance_meters
      } : null
    });
  }

  // Calculate summary statistics
  const workingDays = monthData.filter(d => !d.isSunday).length;
  const daysAttended = monthData.filter(d => d.attendance && d.attendance.clockIn).length;
  const totalHours = monthData.reduce((sum, d) => {
    if (d.attendance && d.attendance.hoursWorked) {
      return sum + parseFloat(d.attendance.hoursWorked);
    }
    return sum;
  }, 0);
  const missingClockOut = monthData.filter(d => 
    d.attendance && d.attendance.clockIn && !d.attendance.clockOut
  ).length;
  const missingActivity = monthData.filter(d => 
    d.attendance && d.attendance.clockIn && !d.attendance.activityId
  ).length;
  const flaggedRecords = monthData.filter(d => 
    d.attendance && d.attendance.validationStatus === 'flagged'
  ).length;
  const unverifiedRecords = monthData.filter(d => 
    d.attendance && d.attendance.validationStatus === 'unverified'
  ).length;

  logger.info('Monthly timesheet retrieved', {
    userId,
    month,
    year,
    daysAttended,
    totalHours
  });

  return {
    user: {
      id: userDetails.id,
      firstName: userDetails.first_name,
      lastName: userDetails.last_name,
      email: userDetails.email,
      facilityName: userDetails.facility_name,
      councilName: userDetails.council_name,
      regionName: userDetails.region_name
    },
    period: {
      month,
      year,
      monthName: getMonthName(month)
    },
    days: monthData,
    summary: {
      workingDays,
      daysAttended,
      totalHours: totalHours.toFixed(2),
      missingClockOut,
      missingActivity,
      flaggedRecords,
      unverifiedRecords
    }
  };
};

/**
 * Update activity for an attendance record
 * @param {string} attendanceId - Attendance UUID
 * @param {string} activityId - Activity UUID
 * @param {string} description - Activity description
 * @param {string} userId - User requesting the update
 * @returns {Promise<Object>} Updated attendance record
 */
const updateAttendanceActivity = async (attendanceId, activityId, description, userId) => {
  // Get attendance record
  const attendance = await timesheetRepository.getAttendanceById(attendanceId);
  
  if (!attendance) {
    throw new Error('Attendance record not found');
  }

  // Verify ownership (only check if not admin - admin check is done in controller)
  if (attendance.user_id !== userId) {
    throw new Error('You can only update your own attendance records');
  }

  // Validate activity if provided
  if (activityId) {
    const activity = await timesheetRepository.getActivityById(activityId);
    if (!activity) {
      throw new Error('Invalid activity selected');
    }
    if (!activity.is_active) {
      throw new Error('Selected activity is no longer active');
    }
  }

  // Update the attendance record
  const updated = await timesheetRepository.updateAttendanceActivity(
    attendanceId,
    activityId || null,
    description || null
  );

  logger.info('Attendance activity updated', {
    attendanceId,
    activityId,
    userId
  });

  return updated;
};

/**
 * Validate timesheet completeness before generation
 * @param {string} userId - User UUID
 * @param {number} month - Month
 * @param {number} year - Year
 * @returns {Promise<Object>} Validation result
 */
const validateTimesheet = async (userId, month, year) => {
  return await timesheetRepository.validateTimesheetCompleteness(userId, month, year);
};

/**
 * Format date as DD/MM/YYYY
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format time as HH:MM
 * @param {string|Date} dateTime - DateTime string or object
 * @returns {string} Formatted time
 */
const formatTime = (dateTime) => {
  const date = new Date(dateTime);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Get month name from number
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name
 */
const getMonthName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
};

module.exports = {
  getActivities,
  getMonthlyTimesheet,
  updateAttendanceActivity,
  validateTimesheet,
  formatDate,
  formatTime,
  getMonthName
};
