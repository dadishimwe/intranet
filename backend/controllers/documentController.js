const Document = require('../models/Document');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { config } = require('../config/config');

/**
 * Upload document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.uploadDocument = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }
    
    const { title, description, departmentId, isPublic } = req.body;
    
    if (!title) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        success: false,
        message: 'Document title is required'
      });
    }
    
    const documentData = {
      title,
      description,
      filePath: `/uploads/documents/${req.file.filename}`,
      fileSize: req.file.size,
      fileType: path.extname(req.file.originalname).toLowerCase(),
      departmentId: departmentId || null,
      uploadedBy: req.auth.userId,
      isPublic: isPublic === 'true' || isPublic === true
    };
    
    const document = await Document.create(documentData);
    
    return res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error('Error uploading document:', error);
    
    // Delete uploaded file if exists
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while uploading document'
    });
  }
};

/**
 * Update document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, departmentId, isPublic } = req.body;
    
    // Check if document exists
    const document = await Document.findById(id);
    
    if (!document) {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check if user has permission to update this document
    if (document.uploaded_by !== req.auth.userId && req.auth.role !== 'admin') {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this document'
      });
    }
    
    // Build update data
    const updateData = {};
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (isPublic !== undefined) updateData.isPublic = isPublic === 'true' || isPublic === true;
    
    // Handle file update
    if (req.file) {
      updateData.filePath = `/uploads/documents/${req.file.filename}`;
      updateData.fileSize = req.file.size;
      updateData.fileType = path.extname(req.file.originalname).toLowerCase();
      
      // Delete old file
      const oldFilePath = path.join(config.uploads.path, document.file_path.replace('/uploads/', ''));
      
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    // Update document
    const updatedDocument = await Document.update(id, updateData);
    
    return res.status(200).json({
      success: true,
      data: updatedDocument
    });
  } catch (error) {
    logger.error(`Error updating document ${req.params.id}:`, error);
    
    // Delete uploaded file if exists
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating document'
    });
  }
};

/**
 * Delete document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if document exists
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check if user has permission to delete this document
    if (document.uploaded_by !== req.auth.userId && req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this document'
      });
    }
    
    // Delete file
    const filePath = path.join(config.uploads.path, document.file_path.replace('/uploads/', ''));
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete document from database
    await Document.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting document ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting document'
    });
  }
};

/**
 * Get document by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check if user has permission to view this document
    const isOwner = document.uploaded_by === req.auth.userId;
    const isPublic = document.is_public;
    const isAdmin = req.auth.role === 'admin';
    
    // Get user's department for access control
    const userDepartmentResult = await db.query(
      'SELECT department_id FROM users WHERE id = $1',
      [req.auth.userId]
    );
    
    const userDepartmentId = userDepartmentResult.rows[0]?.department_id;
    const isSameDepartment = document.department_id === userDepartmentId;
    
    if (!isPublic && !isOwner && !isAdmin && !isSameDepartment) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this document'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error(`Error getting document ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching document'
    });
  }
};

/**
 * List documents with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.listDocuments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      departmentId, 
      search,
      fileType,
      uploadedBy,
      isPublic
    } = req.query;
    
    // Convert query params to appropriate types
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      departmentId: departmentId || undefined,
      searchTerm: search || undefined,
      fileType: fileType || undefined,
      uploadedBy: uploadedBy || undefined,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined
    };
    
    // If not admin, enforce access control
    if (req.auth.role !== 'admin') {
      // Get user's department
      const userDepartmentResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userDepartmentResult.rows[0]?.department_id;
      
      // Users can see their own uploads, their department's documents, and public documents
      if (options.departmentId && options.departmentId !== userDepartmentId && options.isPublic !== true) {
        options.uploadedBy = req.auth.userId; // Limit to own uploads if trying to access another department
      }
      
      // If no department filter specified, limit to public + own department + own uploads
      if (!options.departmentId && !options.isPublic) {
        options.departmentId = userDepartmentId;
        // This is simplified - a more complex query would be needed for OR conditions
      }
    }
    
    const result = await Document.list(options);
    
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error listing documents:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching documents'
    });
  }
};

/**
 * Search documents
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchDocuments = async (req, res) => {
  try {
    const { keyword, departmentId, limit = 20 } = req.query;
    
    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: 'Search keyword is required'
      });
    }
    
    // For non-admin users, always filter by their department
    let searchDepartmentId = departmentId;
    
    if (req.auth.role !== 'admin') {
      // Get user's department
      const userDepartmentResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userDepartmentResult.rows[0]?.department_id;
      
      // If trying to search in another department, ignore that parameter
      if (departmentId && departmentId !== userDepartmentId) {
        searchDepartmentId = userDepartmentId;
      }
    }
    
    const documents = await Document.search(keyword, {
      departmentId: searchDepartmentId,
      limit: parseInt(limit, 10)
    });
    
    return res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error(`Error searching documents:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while searching documents'
    });
  }
};

/**
 * Get document file type statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFileTypeStats = async (req, res) => {
  try {
    const stats = await Document.getFileTypeStats();
    
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting file type statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching file type statistics'
    });
  }
};

/**
 * Get recently added documents
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getRecentDocuments = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const documents = await Document.getRecentDocuments(
      parseInt(limit, 10),
      req.auth.userId
    );
    
    return res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error('Error getting recent documents:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching recent documents'
    });
  }
};