// src/modules/users/users.controller.js
/**
 * Users Controller
 * Handles HTTP requests for user endpoints
 */

const usersService = require('./users.service');
const { asyncHandler } = require('../../middleware/errorHandler.middleware');
const { validatePagination } = require('../../utils/validators');

/**
 * Get current user profile
 * GET /api/users/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.user.id);
  
  res.status(200).json({
    success: true,
    data: { user }
  });
});

/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.id);
  
  res.status(200).json({
    success: true,
    data: { user }
  });
});

/**
 * Get all users with filters
 * GET /api/users
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit } = validatePagination(req.query.page, req.query.limit);
  
  const filters = {
    role: req.query.role,
    facility_id: req.query.facility_id,
    supervisor_id: req.query.supervisor_id,
    is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
    search: req.query.search,
    page,
    limit,
    sortBy: req.query.sort || 'created_at',
    sortOrder: req.query.order || 'DESC'
  };
  
  const result = await usersService.getAllUsers(filters);
  
  res.status(200).json({
    success: true,
    data: {
      users: result.users,
      pagination: result.pagination
    }
  });
});

/**
 * Update user
 * PUT /api/users/:id
 */
const updateUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const updateData = req.body;
  
  const user = await usersService.updateUser(userId, updateData, req.user);
  
  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: { user }
  });
});

/**
 * Delete user (soft delete)
 * DELETE /api/users/:id
 */
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  
  await usersService.deleteUser(userId, req.user);
  
  res.status(200).json({
    success: true,
    message: 'User deactivated successfully'
  });
});

/**
 * Get user statistics
 * GET /api/users/stats
 */
const getUserStatistics = asyncHandler(async (req, res) => {
  const stats = await usersService.getUserStatistics();
  
  res.status(200).json({
    success: true,
    data: { stats }
  });
});

module.exports = {
  getMe,
  getUserById,
  getAllUsers,
  updateUser,
  deleteUser,
  getUserStatistics
};
