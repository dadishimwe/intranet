const jwt = require('jsonwebtoken');
const { config } = require('../config/config');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to request
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.auth.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    // Check if session exists and is active
    const { sessionId, userId } = decoded;
    
    if (!sessionId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload'
      });
    }
    
    const sessionResult = await db.query(
      `SELECT * FROM sessions 
       WHERE id = $1 AND user_id = $2 AND is_active = true
       AND expires_at > NOW()`,
      [sessionId, userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid'
      });
    }
    
    // Add auth info to request
    req.auth = decoded;
    
    // Continue to next middleware or route handler
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 * @returns {function} Middleware function
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Must be authenticated first
    if (!req.auth || !req.auth.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user role is allowed
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    // Role is allowed, continue
    next();
  };
};

/**
 * Resource ownership middleware
 * Checks if the authenticated user is the owner of a resource
 * @param {function} getResourceOwnerId - Function to get owner ID from request
 * @returns {function} Middleware function
 */
exports.checkOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      // Must be authenticated first
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      // Admin can access any resource
      if (req.auth.role === 'admin') {
        return next();
      }
      
      // Get resource owner ID
      const ownerId = await getResourceOwnerId(req);
      
      // Check if user is the owner
      if (ownerId !== req.auth.userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // User is the owner, continue
      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while checking resource ownership'
      });
    }
  };
};

/**
 * Department access middleware
 * Checks if the authenticated user belongs to the specified department
 * @param {function} getResourceDepartmentId - Function to get department ID from request
 * @returns {function} Middleware function
 */
exports.checkDepartmentAccess = (getResourceDepartmentId) => {
  return async (req, res, next) => {
    try {
      // Must be authenticated first
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      // Admin and managers can access any department
      if (req.auth.role === 'admin' || req.auth.role === 'manager') {
        return next();
      }
      
      // Get resource department ID
      const departmentId = await getResourceDepartmentId(req);
      
      // Get user's department
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const userDepartmentId = userResult.rows[0].department_id;
      
      // Check if user belongs to the department
      if (departmentId !== userDepartmentId && departmentId !== null) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // User has access, continue
      next();
    } catch (error) {
      logger.error('Department access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while checking department access'
      });
    }
  };
};

/**
 * Request validation middleware
 * Validates request body, query, or params
 * @param {function} validator - Validation function
 * @param {string} source - Request property to validate ('body', 'query', or 'params')
 * @returns {function} Middleware function
 */
exports.validate = (validator, source = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = validator(req[source]);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }
      
      // Update request with validated values
      req[source] = value;
      
      next();
    } catch (error) {
      logger.error('Validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during validation'
      });
    }
  };
};

/**
 * Rate limiting middleware for sensitive operations
 * Simple implementation for Raspberry Pi with limited database queries
 * @param {string} operation - Operation name for rate limiting
 * @param {number} maxAttempts - Maximum number of attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {function} Middleware function
 */
exports.rateLimit = (operation, maxAttempts = 5, windowMs = 60000) => {
  const attempts = new Map();
  
  // Cleanup function to remove old entries
  const cleanup = () => {
    const now = Date.now();
    for (const [key, data] of attempts.entries()) {
      if (now - data.firstAttempt > windowMs) {
        attempts.delete(key);
      }
    }
  };
  
  // Run cleanup every minute
  setInterval(cleanup, 60000);
  
  return (req, res, next) => {
    const ip = req.ip;
    const key = `${operation}:${ip}`;
    
    // Get current attempts
    const currentData = attempts.get(key) || { 
      count: 0, 
      firstAttempt: Date.now() 
    };
    
    // Check if window has expired
    if (Date.now() - currentData.firstAttempt > windowMs) {
      // Reset counter
      currentData.count = 0;
      currentData.firstAttempt = Date.now();
    }
    
    // Increment attempt counter
    currentData.count += 1;
    attempts.set(key, currentData);
    
    // Check if rate limit exceeded
    if (currentData.count > maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }
    
    next();
  };
};