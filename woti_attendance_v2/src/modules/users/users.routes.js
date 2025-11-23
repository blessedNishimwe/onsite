// src/modules/users/users.routes.js
/**
 * Users Routes
 * Defines routes for user endpoints
 */

const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin, requireOwnerOrAdmin } = require('../../middleware/roleAuth.middleware');
const { validateUserUpdate, validateUUIDParam, validateQueryParams } = require('../../middleware/validation.middleware');

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, usersController.getMe);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private/Admin
 */
router.get('/stats', authenticate, requireAdmin, usersController.getUserStatistics);

/**
 * @route   GET /api/users
 * @desc    Get all users with filters
 * @access  Private/Admin
 */
router.get('/', authenticate, requireAdmin, validateQueryParams, usersController.getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (own profile or admin)
 */
router.get('/:id', authenticate, validateUUIDParam('id'), requireOwnerOrAdmin('id'), usersController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (own profile or admin)
 */
router.put('/:id', authenticate, validateUUIDParam('id'), requireOwnerOrAdmin('id'), validateUserUpdate, usersController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete)
 * @access  Private/Admin
 */
router.delete('/:id', authenticate, validateUUIDParam('id'), requireAdmin, usersController.deleteUser);

module.exports = router;
