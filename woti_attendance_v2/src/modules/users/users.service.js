// src/modules/users/users.service.js
/**
 * Users Service
 * Business logic for user operations
 */

const usersRepository = require('./users.repository');
const { hashPassword } = require('../auth/password.service');
const logger = require('../../utils/logger');
const { query } = require('../../config/database');

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User details
 */
const getUserById = async (userId) => {
  const user = await usersRepository.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Remove sensitive data
  delete user.password_hash;
  
  return user;
};

/**
 * Get all users with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Users list with pagination
 */
const getAllUsers = async (filters) => {
  return await usersRepository.findAll(filters);
};

/**
 * Update user
 * @param {string} userId - User ID
 * @param {Object} updateData - Update data
 * @param {Object} currentUser - User making the update
 * @returns {Promise<Object>} Updated user
 */
const updateUser = async (userId, updateData, currentUser) => {
  const existingUser = await usersRepository.findById(userId);
  
  if (!existingUser) {
    throw new Error('User not found');
  }
  
  // If updating password, hash it
  if (updateData.password) {
    updateData.password_hash = await hashPassword(updateData.password);
    delete updateData.password;
  }
  
  // Check email uniqueness if updating email
  if (updateData.email && updateData.email !== existingUser.email) {
    const emailExists = await usersRepository.findByEmail(updateData.email);
    if (emailExists) {
      throw new Error('Email already in use');
    }
  }
  
  const updatedUser = await usersRepository.update(userId, updateData);
  
  // Log activity
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      currentUser.id,
      'update',
      'user',
      userId,
      `User ${existingUser.email} updated`,
      JSON.stringify({ updated_by: currentUser.email, fields: Object.keys(updateData) })
    ]
  );
  
  logger.info('User updated', { userId, updatedBy: currentUser.id });
  
  delete updatedUser.password_hash;
  return updatedUser;
};

/**
 * Delete user (soft delete)
 * @param {string} userId - User ID
 * @param {Object} currentUser - User performing the deletion
 * @returns {Promise<boolean>} Success status
 */
const deleteUser = async (userId, currentUser) => {
  const user = await usersRepository.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Prevent self-deletion
  if (userId === currentUser.id) {
    throw new Error('Cannot delete your own account');
  }
  
  const success = await usersRepository.remove(userId);
  
  // Log activity
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      currentUser.id,
      'delete',
      'user',
      userId,
      `User ${user.email} deactivated`,
      JSON.stringify({ deleted_by: currentUser.email })
    ]
  );
  
  logger.info('User deleted', { userId, deletedBy: currentUser.id });
  
  return success;
};

/**
 * Get user statistics
 * @returns {Promise<Object>} Statistics
 */
const getUserStatistics = async () => {
  return await usersRepository.getStatistics();
};

module.exports = {
  getUserById,
  getAllUsers,
  updateUser,
  deleteUser,
  getUserStatistics
};
