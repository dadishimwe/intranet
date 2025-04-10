const User = require('../models/User');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { config } = require('../config/config');

/**
 * Get all users with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      departmentId, 
      search,
      role,
      isActive
    } = req.query;
    
    // Convert query params to appropriate types
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      departmentId: departmentId || undefined,
      searchTerm: search || undefined,
      role: role || undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined
    };
    
    const result = await User.list(options);
    
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users'
    });
  }
};

/**
 * Get user by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove sensitive data
    delete user.password_hash;
    
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error getting user ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user'
    });
  }
};

/**
 * Create new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createUser = async (req, res) => {
  try {
    const userData = {
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      role: req.body.role,
      jobTitle: req.body.jobTitle,
      phone: req.body.phone,
      departmentId: req.body.departmentId,
      managerId: req.body.managerId
    };
    
    const user = await User.create(userData);
    
    return res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    
    if (error.message === 'Email already exists') {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating user'
    });
  }
};

/**
 * Update user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const existingUser = await User.findById(id);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prepare update data (only allowed fields)
    const updateData = {};
    
    if (req.body.firstName) updateData.firstName = req.body.firstName;
    if (req.body.lastName) updateData.lastName = req.body.lastName;
    if (req.body.jobTitle) updateData.jobTitle = req.body.jobTitle;
    if (req.body.phone) updateData.phone = req.body.phone;
    if (req.body.departmentId) updateData.departmentId = req.body.departmentId;
    if (req.body.managerId) updateData.managerId = req.body.managerId;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    
    // Only admins can update role
    if (req.body.role && req.auth.role === 'admin') {
      updateData.role = req.body.role;
    }
    
    // Update user
    const updatedUser = await User.update(id, updateData);
    
    return res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error updating user ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating user'
    });
  }
};

/**
 * Delete user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is trying to delete themselves
    if (id === req.auth.userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    // Check if user exists
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete profile image if exists
    if (user.profile_image) {
      const imagePath = path.join(config.uploads.path, 'profiles', path.basename(user.profile_image));
      
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete user
    await User.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting user ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting user'
    });
  }
};

/**
 * Upload user profile image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.uploadProfileImage = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    const userId = req.params.id || req.auth.userId;
    
    // Check if user exists
    const user = await User.findById(userId);
    
    if (!user) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete old profile image if exists
    if (user.profile_image) {
      const oldImagePath = path.join(config.uploads.path, 'profiles', path.basename(user.profile_image));
      
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Update user profile image
    const imagePath = `/uploads/profiles/${req.file.filename}`;
    const updatedUser = await User.updateProfileImage(userId, imagePath);
    
    return res.status(200).json({
      success: true,
      data: {
        id: updatedUser.id,
        profileImage: updatedUser.profile_image
      }
    });
  } catch (error) {
    logger.error(`Error uploading profile image:`, error);
    
    // Delete uploaded file if exists
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while uploading profile image'
    });
  }
};

/**
 * Get user's direct reports
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDirectReports = async (req, res) => {
  try {
    const managerId = req.params.id || req.auth.userId;
    
    // Check if user exists
    const user = await User.findById(managerId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get direct reports
    const directReports = await User.getDirectReports(managerId);
    
    return res.status(200).json({
      success: true,
      data: directReports
    });
  } catch (error) {
    logger.error(`Error getting direct reports:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching direct reports'
    });
  }
};

/**
 * Get organization chart data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getOrgChart = async (req, res) => {
  try {
    const orgData = await User.getOrgChartData();
    
    return res.status(200).json({
      success: true,
      data: orgData
    });
  } catch (error) {
    logger.error('Error getting org chart data:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching organization chart'
    });
  }
};