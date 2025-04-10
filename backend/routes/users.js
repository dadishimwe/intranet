const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
const { uploadProfileImage } = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Routes for all authenticated users
router.get('/profile', userController.getProfile);
router.post('/profile/image', uploadProfileImage, userController.uploadProfileImage);
router.get('/org-chart', userController.getOrgChart);

// Routes for specific user (with ownership check for non-admins)
const checkUserOwnership = checkOwnership((req) => req.params.id);

router.get('/:id', 
  (req, res, next) => {
    // Allow admins and managers to access any user
    if (req.auth.role === 'admin' || req.auth.role === 'manager') {
      return next();
    }
    // For regular users, check ownership
    return checkUserOwnership(req, res, next);
  },
  userController.getUserById
);

router.put('/:id',
  (req, res, next) => {
    // Allow admins to update any user
    if (req.auth.role === 'admin') {
      return next();
    }
    // For non-admins, check ownership and limit fields
    checkUserOwnership(req, res, next);
    
    // Non-admins can only update certain fields
    const allowedFields = ['firstName', 'lastName', 'phone', 'jobTitle'];
    const requestedFields = Object.keys(req.body);
    
    const hasDisallowedFields = requestedFields.some(field => 
      !allowedFields.includes(field)
    );
    
    if (hasDisallowedFields) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile information'
      });
    }
  },
  userController.updateUser
);

router.post('/:id/image',
  (req, res, next) => {
    // Allow admins to update any user's image
    if (req.auth.role === 'admin') {
      return next();
    }
    // For non-admins, check ownership
    return checkUserOwnership(req, res, next);
  },
  uploadProfileImage,
  userController.uploadProfileImage
);

router.get('/:id/direct-reports',
  (req, res, next) => {
    // Allow admins and managers to access any user's direct reports
    if (req.auth.role === 'admin' || req.auth.role === 'manager') {
      return next();
    }
    // For regular users, check ownership
    return checkUserOwnership(req, res, next);
  },
  userController.getDirectReports
);

// Admin-only routes
router.get('/', authorize('admin', 'manager'), userController.getUsers);
router.post('/', authorize('admin'), userController.createUser);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;