const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticate, authorize, checkDepartmentAccess } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Routes accessible to all authenticated users
router.get('/', departmentController.getAllDepartments);
router.get('/tree', departmentController.getDepartmentTree);
router.get('/:id', departmentController.getDepartmentById);

// Check department access for viewing members
const checkAccessOrPublic = checkDepartmentAccess((req) => req.params.id);

router.get('/:id/members', 
  (req, res, next) => {
    // Admins and managers can access any department
    if (req.auth.role === 'admin' || req.auth.role === 'manager') {
      return next();
    }
    // For regular users, check department access
    return checkAccessOrPublic(req, res, next);
  },
  departmentController.getDepartmentMembers
);

// Admin-only routes
router.post('/', authorize('admin'), departmentController.createDepartment);
router.put('/:id', authorize('admin'), departmentController.updateDepartment);
router.delete('/:id', authorize('admin'), departmentController.deleteDepartment);

module.exports = router;