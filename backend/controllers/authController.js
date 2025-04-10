const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const logger = require('../utils/logger');
const { config } = require('../config/config');
const db = require('../config/database');

/**
 * User login controller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Verify credentials
    const user = await User.verifyCredentials(email, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }
    
    // Create session
    const sessionId = uuidv4();
    const sessionExpiry = new Date(Date.now() + config.auth.jwtExpiry * 1000);
    
    await db.query(
      `INSERT INTO sessions (
        id, user_id, ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        sessionId,
        user.id,
        req.ip,
        req.headers['user-agent'],
        sessionExpiry
      ]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId
      },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiry }
    );
    
    // Return user info and token
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          profileImage: user.profile_image
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
};

/**
 * User logout controller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.logout = async (req, res) => {
  try {
    const { sessionId } = req.auth;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'No active session'
      });
    }
    
    // Invalidate session
    await db.query(
      `UPDATE sessions 
       SET is_active = false 
       WHERE id = $1`,
      [sessionId]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during logout'
    });
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.auth;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Return user profile data
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        jobTitle: user.job_title,
        phone: user.phone,
        departmentId: user.department_id,
        departmentName: user.department_name,
        managerId: user.manager_id,
        managerName: user.manager_name,
        profileImage: user.profile_image,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching profile'
    });
  }
};

/**
 * Update user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updatePassword = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    // Verify current password
    const user = await User.findById(userId);
    const isValidPassword = await User.verifyCredentials(
      user.email, 
      currentPassword
    );
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Validate new password
    if (newPassword.length < config.auth.passwordMinLength) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${config.auth.passwordMinLength} characters`
      });
    }
    
    // Update password
    await User.update(userId, { password: newPassword });
    
    // Invalidate all other sessions
    await db.query(
      `UPDATE sessions
       SET is_active = false
       WHERE user_id = $1 AND id != $2`,
      [userId, req.auth.sessionId]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('Update password error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating password'
    });
  }
};

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Check if user exists
    const user = await User.findByEmail(email);
    
    if (!user) {
      // For security reasons, still return success
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });
    }
    
    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id },
      config.auth.jwtSecret,
      { expiresIn: 3600 }
    );
    
    // In a production environment, this would send an email
    // For Raspberry Pi simplicity, just log the token
    logger.info(`Password reset requested for ${email}. Token: ${resetToken}`);
    
    return res.status(200).json({
      success: true,
      message: 'If the email exists, a reset link has been sent',
      // Only in development - remove in production
      ...(config.isDev && { resetToken })
    });
  } catch (error) {
    logger.error('Request password reset error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while requesting password reset'
    });
  }
};

/**
 * Reset password with token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }
    
    // Validate password
    if (newPassword.length < config.auth.passwordMinLength) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${config.auth.passwordMinLength} characters`
      });
    }
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.auth.jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Update password
    await User.update(decoded.userId, { password: newPassword });
    
    // Invalidate all sessions
    await db.query(
      `UPDATE sessions
       SET is_active = false
       WHERE user_id = $1`,
      [decoded.userId]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while resetting password'
    });
  }
};

/**
 * Refresh JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.refreshToken = async (req, res) => {
  try {
    const { userId, sessionId } = req.auth;
    
    // Check if session is still valid
    const sessionResult = await db.query(
      `SELECT * FROM sessions 
       WHERE id = $1 AND user_id = $2 AND is_active = true
       AND expires_at > NOW()`,
      [sessionId, userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Session is invalid or expired'
      });
    }
    
    // Get user info
    const user = await User.findById(userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User is inactive or not found'
      });
    }
    
    // Update session expiry
    const sessionExpiry = new Date(Date.now() + config.auth.jwtExpiry * 1000);
    
    await db.query(
      `UPDATE sessions 
       SET expires_at = $1 
       WHERE id = $2`,
      [sessionExpiry, sessionId]
    );
    
    // Generate new JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId
      },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiry }
    );
    
    return res.status(200).json({
      success: true,
      data: { token }
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while refreshing token'
    });
  }
};