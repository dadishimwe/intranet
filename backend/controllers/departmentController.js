const Department = require('../models/Department');
const logger = require('../utils/logger');

/**
 * Get all departments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllDepartments = async (req, res) => {
  try {
    const { includeUsers, parentId } = req.query;
    
    const departments = await Department.list({
      includeUsers: includeUsers === 'true',
      parentId: parentId || null
    });
    
    return res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    logger.error('Error getting departments:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching departments'
    });
  }
};

/**
 * Get department tree (hierarchical structure)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDepartmentTree = async (req, res) => {
  try {
    const tree = await Department.getTree();
    
    return res.status(200).json({
      success: true,
      data: tree
    });
  } catch (error) {
    logger.error('Error getting department tree:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching department tree'
    });
  }
};

/**
 * Get department by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const department = await Department.findById(id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error(`Error getting department ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching department'
    });
  }
};

/**
 * Create new department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createDepartment = async (req, res) => {
  try {
    const { name, description, parentId, managerId } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required'
      });
    }
    
    const departmentData = {
      name,
      description,
      parentId,
      managerId
    };
    
    const department = await Department.create(departmentData);
    
    return res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error('Error creating department:', error);
    
    if (error.message === 'Department name already exists') {
      return res.status(409).json({
        success: false,
        message: 'Department name already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating department'
    });
  }
};

/**
 * Update department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentId, managerId } = req.body;
    
    // Check for circular reference in department hierarchy
    if (parentId) {
      let currentParent = parentId;
      const visited = new Set();
      
      while (currentParent) {
        // Detect cycle
        if (currentParent === id) {
          return res.status(400).json({
            success: false,
            message: 'Circular reference detected in department hierarchy'
          });
        }
        
        // Detect infinite loop
        if (visited.has(currentParent)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid department hierarchy'
          });
        }
        
        visited.add(currentParent);
        
        // Get parent's parent
        const parent = await Department.findById(currentParent);
        currentParent = parent ? parent.parent_id : null;
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parentId !== undefined) updateData.parent_id = parentId || null;
    if (managerId !== undefined) updateData.manager_id = managerId || null;
    
    const department = await Department.update(id, updateData);
    
    return res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error(`Error updating department ${req.params.id}:`, error);
    
    if (error.message === 'Department not found') {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    if (error.message === 'Department name already exists') {
      return res.status(409).json({
        success: false,
        message: 'Department name already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating department'
    });
  }
};

/**
 * Delete department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    
    await Department.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting department ${req.params.id}:`, error);
    
    if (error.message === 'Cannot delete department with assigned users') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with assigned users'
      });
    }
    
    if (error.message === 'Cannot delete department with child departments') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with child departments'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting department'
    });
  }
};

/**
 * Get department members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDepartmentMembers = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if department exists
    const department = await Department.findById(id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    const members = await Department.getMembers(id);
    
    return res.status(200).json({
      success: true,
      data: members
    });
  } catch (error) {
    logger.error(`Error getting members for department ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching department members'
    });
  }
};