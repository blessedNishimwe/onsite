// src/middleware/roleAuth.middleware.js
/**
 * Role-Based Access Control Middleware
 * Restricts access based on user roles
 */

const logger = require('../utils/logger');

/**
 * Role hierarchy for access control
 */
const ROLE_HIERARCHY = {
  admin: 7,
  backstopper: 6,
  supervisor: 5,
  ddo: 4,
  focal: 3,
  data_clerk: 2,
  tester: 1
};

/**
 * Check if user has required role
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn('Role authorization failed', {
        userId: req.user.id,
        userRole,
        allowedRoles
      });
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

/**
 * Check if user has minimum role level
 * @param {string} minimumRole - Minimum required role
 * @returns {Function} Middleware function
 */
const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const minimumRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;
    
    if (userRoleLevel < minimumRoleLevel) {
      logger.warn('Role level authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        minimumRole
      });
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

/**
 * Admin only access
 */
const requireAdmin = requireRole(['admin']);

/**
 * Supervisor or above access
 */
const requireSupervisor = requireMinimumRole('supervisor');

/**
 * Check if user can access resource
 * Users can access their own resources or if they're admin/supervisor
 * @param {string} userIdParam - Request parameter name containing user ID
 * @returns {Function} Middleware function
 */
const requireOwnerOrAdmin = (userIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const requestedUserId = req.params[userIdParam];
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    
    // Admin and supervisors can access any resource
    if (userRole === 'admin' || userRole === 'supervisor' || userRole === 'backstopper') {
      return next();
    }
    
    // Users can access their own resources
    if (requestedUserId === currentUserId) {
      return next();
    }
    
    logger.warn('Owner/Admin authorization failed', {
      currentUserId,
      requestedUserId,
      userRole
    });
    
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own resources'
    });
  };
};

/**
 * Check if user can access facility resources
 * Users can only access resources from their assigned facility (unless admin)
 * @param {string} facilityIdParam - Request parameter name containing facility ID
 * @returns {Function} Middleware function
 */
const requireSameFacility = (facilityIdParam = 'facilityId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userRole = req.user.role;
    
    // Admin and backstoppers can access all facilities
    if (userRole === 'admin' || userRole === 'backstopper') {
      return next();
    }
    
    const requestedFacilityId = req.params[facilityIdParam] || req.body.facility_id;
    const userFacilityId = req.user.facility_id;
    
    if (!userFacilityId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No facility assigned to your account'
      });
    }
    
    if (requestedFacilityId !== userFacilityId) {
      logger.warn('Facility authorization failed', {
        userId: req.user.id,
        userFacilityId,
        requestedFacilityId
      });
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access resources from your assigned facility'
      });
    }
    
    next();
  };
};

module.exports = {
  requireRole,
  requireMinimumRole,
  requireAdmin,
  requireSupervisor,
  requireOwnerOrAdmin,
  requireSameFacility,
  ROLE_HIERARCHY
};
