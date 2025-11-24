// src/middleware/validation.middleware.js
/**
 * Request Validation Middleware
 * Validates incoming request data
 */

const {
  isValidEmail,
  isValidPhone,
  validatePassword,
  isValidUUID,
  isValidCoordinates,
  isValidRole,
  sanitizeString
} = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Validate user registration data
 */
const validateRegistration = (req, res, next) => {
  const errors = [];
  const { email, phone, password, first_name, last_name, role, facility_id } = req.body;
  
  // Required fields
  if (!email) errors.push('Email is required');
  else if (!isValidEmail(email)) errors.push('Invalid email format');
  
  if (!password) errors.push('Password is required');
  else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }
  
  if (!first_name) errors.push('First name is required');
  if (!last_name) errors.push('Last name is required');
  
  if (!role) errors.push('Role is required');
  else if (!isValidRole(role)) errors.push('Invalid role');
  
  // Optional fields validation
  if (phone && !isValidPhone(phone)) {
    errors.push('Invalid phone number format');
  }
  
  if (facility_id && !isValidUUID(facility_id)) {
    errors.push('Invalid facility ID');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid registration data',
      errors
    });
  }
  
  // Sanitize string inputs
  req.body.first_name = sanitizeString(first_name);
  req.body.last_name = sanitizeString(last_name);
  req.body.email = email.toLowerCase().trim();
  
  next();
};

/**
 * Validate login data
 */
const validateLogin = (req, res, next) => {
  const errors = [];
  const { email, password } = req.body;
  
  if (!email) errors.push('Email is required');
  else if (!isValidEmail(email)) errors.push('Invalid email format');
  
  if (!password) errors.push('Password is required');
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid login data',
      errors
    });
  }
  
  req.body.email = email.toLowerCase().trim();
  
  next();
};

/**
 * Validate user update data
 */
const validateUserUpdate = (req, res, next) => {
  const errors = [];
  const { email, phone, first_name, last_name, role, facility_id, supervisor_id } = req.body;
  
  // Validate only provided fields
  if (email !== undefined) {
    if (!isValidEmail(email)) errors.push('Invalid email format');
  }
  
  if (phone !== undefined && phone !== null) {
    if (!isValidPhone(phone)) errors.push('Invalid phone number format');
  }
  
  if (role !== undefined) {
    if (!isValidRole(role)) errors.push('Invalid role');
  }
  
  if (facility_id !== undefined && facility_id !== null) {
    if (!isValidUUID(facility_id)) errors.push('Invalid facility ID');
  }
  
  if (supervisor_id !== undefined && supervisor_id !== null) {
    if (!isValidUUID(supervisor_id)) errors.push('Invalid supervisor ID');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid update data',
      errors
    });
  }
  
  // Sanitize string inputs
  if (first_name) req.body.first_name = sanitizeString(first_name);
  if (last_name) req.body.last_name = sanitizeString(last_name);
  if (email) req.body.email = email.toLowerCase().trim();
  
  next();
};

/**
 * Validate facility data
 */
const validateFacility = (req, res, next) => {
  const errors = [];
  const { name, council_id, facility_type, latitude, longitude } = req.body;
  
  if (!name) errors.push('Facility name is required');
  if (!council_id) errors.push('Council ID is required');
  else if (!isValidUUID(council_id)) errors.push('Invalid council ID');
  
  if (facility_type && !['hospital', 'health_center', 'clinic', 'dispensary', 'other'].includes(facility_type)) {
    errors.push('Invalid facility type');
  }
  
  // Validate coordinates if provided
  if ((latitude !== undefined && latitude !== null) || (longitude !== undefined && longitude !== null)) {
    if (latitude === undefined || longitude === undefined) {
      errors.push('Both latitude and longitude must be provided');
    } else if (!isValidCoordinates(parseFloat(latitude), parseFloat(longitude))) {
      errors.push('Invalid coordinates');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid facility data',
      errors
    });
  }
  
  if (name) req.body.name = sanitizeString(name);
  
  next();
};

/**
 * Validate clock in/out data
 */
const validateAttendance = (req, res, next) => {
  const errors = [];
  const { facility_id, clock_in_latitude, clock_in_longitude, device_id } = req.body;
  
  if (!facility_id) errors.push('Facility ID is required');
  else if (!isValidUUID(facility_id)) errors.push('Invalid facility ID');
  
  if (!device_id) errors.push('Device ID is required');
  
  // Validate coordinates if provided
  if ((clock_in_latitude !== undefined && clock_in_latitude !== null) || 
      (clock_in_longitude !== undefined && clock_in_longitude !== null)) {
    if (!isValidCoordinates(parseFloat(clock_in_latitude), parseFloat(clock_in_longitude))) {
      errors.push('Invalid clock-in coordinates');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid attendance data',
      errors
    });
  }
  
  next();
};

/**
 * Validate UUID parameter
 * @param {string} paramName - Name of the parameter
 */
const validateUUIDParam = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    
    if (!value) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `${paramName} is required`
      });
    }
    
    if (!isValidUUID(value)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid ${paramName} format`
      });
    }
    
    next();
  };
};

/**
 * Validate query parameters
 */
const validateQueryParams = (req, res, next) => {
  const { page, limit, sort, order } = req.query;
  
  if (page && (isNaN(page) || parseInt(page) < 1)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid page number'
    });
  }
  
  if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid limit (must be between 1 and 100)'
    });
  }
  
  if (order && !['asc', 'desc'].includes(order.toLowerCase())) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid order (must be asc or desc)'
    });
  }
  
  next();
};

/**
 * Validate self-registration (signup) data
 */
const validateSignup = (req, res, next) => {
  const errors = [];
  const { email, phone, password, first_name, last_name, role, facility_id } = req.body;
  
  // Required fields
  if (!email) errors.push('Email is required');
  else if (!isValidEmail(email)) errors.push('Invalid email format');
  
  if (!phone) errors.push('Phone number is required');
  else if (!isValidPhone(phone)) errors.push('Invalid phone number format');
  
  if (!password) errors.push('Password is required');
  else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }
  
  if (!first_name) errors.push('First name is required');
  if (!last_name) errors.push('Last name is required');
  
  if (!role) errors.push('Role is required');
  else {
    // Restrict roles for self-registration (no admin or supervisor roles)
    const allowedRoles = ['tester', 'data_clerk', 'focal'];
    if (!allowedRoles.includes(role)) {
      errors.push('Invalid role. Allowed roles for self-registration: tester, data_clerk, focal');
    }
  }
  
  // Optional facility_id validation
  if (facility_id && !isValidUUID(facility_id)) {
    errors.push('Invalid facility ID');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid signup data',
      errors
    });
  }
  
  // Sanitize string inputs
  req.body.first_name = sanitizeString(first_name);
  req.body.last_name = sanitizeString(last_name);
  req.body.email = email.toLowerCase().trim();
  
  next();
};

/**
 * Validate email verification token
 */
const validateVerificationToken = (req, res, next) => {
  const errors = [];
  const { token } = req.body;
  
  if (!token) {
    errors.push('Verification token is required');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid verification data',
      errors
    });
  }
  
  next();
};

/**
 * Validate resend verification email request
 */
const validateResendVerification = (req, res, next) => {
  const errors = [];
  const { email } = req.body;
  
  if (!email) errors.push('Email is required');
  else if (!isValidEmail(email)) errors.push('Invalid email format');
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid email data',
      errors
    });
  }
  
  req.body.email = email.toLowerCase().trim();
  
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateUserUpdate,
  validateFacility,
  validateAttendance,
  validateUUIDParam,
  validateQueryParams,
  validateSignup,
  validateVerificationToken,
  validateResendVerification
};
