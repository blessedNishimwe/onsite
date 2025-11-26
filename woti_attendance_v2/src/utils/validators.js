// src/utils/validators.js
/**
 * Common Validation Functions
 * Provides reusable validation logic across the application
 */

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} Whether email is valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Rwanda format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone is valid
 */
const isValidPhone = (phone) => {
  // Rwanda phone format: +250xxxxxxxxx or 07xxxxxxxx or 08xxxxxxxx
  const phoneRegex = /^(\+250|0)[78]\d{8}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with errors
 */
const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} Whether UUID is valid
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate coordinates (latitude and longitude)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} Whether coordinates are valid
 */
const isValidCoordinates = (lat, lon) => {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};

// Role constants
const ALL_ROLES = ['tester', 'data_clerk', 'focal', 'ddo', 'supervisor', 'backstopper', 'admin'];
const SELF_REGISTRATION_ALLOWED_ROLES = ['tester', 'data_clerk', 'focal', 'ddo', 'supervisor'];
// Field worker roles that require facility assignment
const FIELD_WORKER_ROLES = ['tester', 'data_clerk', 'focal', 'ddo'];

/**
 * Validate user role
 * @param {string} role - Role to validate
 * @returns {boolean} Whether role is valid
 */
const isValidRole = (role) => {
  return ALL_ROLES.includes(role);
};

/**
 * Validate role for self-registration
 * @param {string} role - Role to validate
 * @returns {boolean} Whether role is allowed for self-registration
 */
const isValidSelfRegistrationRole = (role) => {
  return SELF_REGISTRATION_ALLOWED_ROLES.includes(role);
};

/**
 * Validate facility type
 * @param {string} type - Facility type to validate
 * @returns {boolean} Whether facility type is valid
 */
const isValidFacilityType = (type) => {
  const validTypes = ['hospital', 'health_center', 'clinic', 'dispensary', 'other'];
  return validTypes.includes(type);
};

/**
 * Sanitize string input (remove dangerous characters)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (!str) return '';
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Validate date string
 * @param {string} dateString - Date string to validate
 * @returns {boolean} Whether date is valid
 */
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} Validated pagination params
 */
const validatePagination = (page, limit) => {
  const validPage = Math.max(1, parseInt(page) || 1);
  const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const offset = (validPage - 1) * validLimit;
  
  return {
    page: validPage,
    limit: validLimit,
    offset
  };
};

/**
 * Validate CSV/Excel file
 * @param {Object} file - Uploaded file object
 * @returns {Object} Validation result
 */
const validateUploadedFile = (file) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file uploaded');
    return { isValid: false, errors };
  }
  
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push('File size exceeds 10MB limit');
  }
  
  // Check file type
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const allowedExtensions = ['.csv', '.xls', '.xlsx'];
  const fileExtension = file.originalname ? file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.')) : '';
  
  if (!allowedMimeTypes.includes(file.mimetype) && !allowedExtensions.includes(fileExtension)) {
    errors.push('Invalid file type. Only CSV and Excel files are allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  isValidEmail,
  isValidPhone,
  validatePassword,
  isValidUUID,
  isValidCoordinates,
  isValidRole,
  isValidSelfRegistrationRole,
  isValidFacilityType,
  sanitizeString,
  isValidDate,
  validatePagination,
  validateUploadedFile,
  ALL_ROLES,
  SELF_REGISTRATION_ALLOWED_ROLES,
  FIELD_WORKER_ROLES
};
