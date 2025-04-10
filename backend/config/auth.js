const jwt = require('jsonwebtoken');
const { config } = require('./config');
const logger = require('../utils/logger');

/**
 * JWT authentication utilities
 */
const jwtUtils = {
  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @param {string} secret - JWT secret
   * @param {Object} options - Token options
   * @returns {string} JWT token
   */
  generateToken(payload, secret = config.auth.jwtSecret, options = {}) {
    const defaultOptions = {
      expiresIn: config.auth.jwtExpiry
    };
    
    const tokenOptions = {
      ...defaultOptions,
      ...options
    };
    
    return jwt.sign(payload, secret, tokenOptions);
  },
  
  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @param {string} secret - JWT secret
   * @returns {Object} Decoded token payload
   */
  verifyToken(token, secret = config.auth.jwtSecret) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      logger.error('Token verification error:', error);
      throw error;
    }
  },
  
  /**
   * Generate refresh token (longer expiry)
   * @param {Object} payload - Token payload
   * @returns {string} Refresh token
   */
  generateRefreshToken(payload) {
    // Refresh token lasts 30 days
    return this.generateToken(payload, config.auth.jwtSecret, {
      expiresIn: 30 * 24 * 60 * 60
    });
  },
  
  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  decodeToken(token) {
    return jwt.decode(token);
  }
};

/**
 * Password utilities
 */
const passwordUtils = {
  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validateStrength(password) {
    // Check minimum length
    if (password.length < config.auth.passwordMinLength) {
      return {
        isValid: false,
        message: `Password must be at least ${config.auth.passwordMinLength} characters long`
      };
    }
    
    // Check for complexity requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const complexity = [
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    ].filter(Boolean).length;
    
    // Require at least 3 of the 4 complexity elements
    if (complexity < 3) {
      return {
        isValid: false,
        message: 'Password must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, and special characters'
      };
    }
    
    return {
      isValid: true,
      message: 'Password meets strength requirements'
    };
  }
};

module.exports = {
  jwt: jwtUtils,
  password: passwordUtils
};