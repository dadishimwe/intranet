const WikiPage = require('../models/WikiPage');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Get wiki pages with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getWikiPages = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      departmentId,
      parentId,
      search,
      createdBy
    } = req.query;
    
    // Build filter options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      departmentId: departmentId || undefined,
      parentId: parentId || undefined,
      searchTerm: search || undefined,
      createdBy: createdBy || undefined
    };
    
    // Handle access control for non-admin users
    if (req.auth.role !== 'admin') {
      // Get user's department
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      // Users can see public pages or pages from their own department
      options.visibilityFilter = {
        isPublic: true,
        userDepartmentId
      };
    }
    
    const result = await WikiPage.list(options);
    
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error getting wiki pages:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching wiki pages'
    });
  }
};

/**
 * Get wiki page by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getWikiPageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const wikiPage = await WikiPage.findById(id);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Check if user has permission to view this page
    if (req.auth.role !== 'admin') {
      // Get user's department
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      // Users can only view public pages or pages from their own department
      const canAccess = wikiPage.is_public || wikiPage.department_id === userDepartmentId;
      
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this page'
        });
      }
    }
    
    // Get revision history
    const revisions = await WikiPage.getRevisions(id);
    
    return res.status(200).json({
      success: true,
      data: {
        ...wikiPage,
        revisions
      }
    });
  } catch (error) {
    logger.error(`Error getting wiki page ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching wiki page'
    });
  }
};

/**
 * Create new wiki page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createWikiPage = async (req, res) => {
  try {
    const { 
      title, 
      content, 
      departmentId,
      isPublic,
      parentId
    } = req.body;
    
    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }
    
    // Check department access if specified
    if (departmentId && req.auth.role !== 'admin') {
      // Get user's department
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      if (departmentId !== userDepartmentId) {
        return res.status(403).json({
          success: false,
          message: 'You can only create pages for your own department'
        });
      }
    }
    
    // Check parent page access if specified
    if (parentId) {
      const parentPage = await WikiPage.findById(parentId);
      
      if (!parentPage) {
        return res.status(400).json({
          success: false,
          message: 'Parent page not found'
        });
      }
      
      // Check if user has access to parent page
      if (req.auth.role !== 'admin') {
        // Get user's department
        const userResult = await db.query(
          'SELECT department_id FROM users WHERE id = $1',
          [req.auth.userId]
        );
        
        const userDepartmentId = userResult.rows[0]?.department_id;
        
        const canAccess = parentPage.is_public || parentPage.department_id === userDepartmentId;
        
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to create a child page for this parent'
          });
        }
      }
    }
    
    // Create wiki page
    const wikiPageData = {
      title,
      content,
      departmentId: departmentId || null,
      isPublic: isPublic === true,
      parentId: parentId || null,
      createdBy: req.auth.userId,
      lastEditedBy: req.auth.userId
    };
    
    const wikiPage = await WikiPage.create(wikiPageData);
    
    return res.status(201).json({
      success: true,
      data: wikiPage
    });
  } catch (error) {
    logger.error('Error creating wiki page:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'A wiki page with this title already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating wiki page'
    });
  }
};

/**
 * Update wiki page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateWikiPage = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      content, 
      departmentId,
      isPublic,
      parentId
    } = req.body;
    
    // Check if page exists
    const wikiPage = await WikiPage.findById(id);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Check if user has permission to edit this page
    if (req.auth.role !== 'admin') {
      // Get user's department
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      // Users can only edit pages from their own department
      if (wikiPage.department_id !== userDepartmentId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to edit this page'
        });
      }
    }
    
    // Check parent page access if specified and changed
    if (parentId && parentId !== wikiPage.parent_id) {
      const parentPage = await WikiPage.findById(parentId);
      
      if (!parentPage) {
        return res.status(400).json({
          success: false,
          message: 'Parent page not found'
        });
      }
      
      // Check if user has access to parent page
      if (req.auth.role !== 'admin') {
        // Get user's department
        const userResult = await db.query(
          'SELECT department_id FROM users WHERE id = $1',
          [req.auth.userId]
        );
        
        const userDepartmentId = userResult.rows[0]?.department_id;
        
        const canAccess = parentPage.is_public || parentPage.department_id === userDepartmentId;
        
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to use this parent page'
          });
        }
      }
      
      // Prevent circular references
      let currentParent = parentId;
      const visited = new Set();
      
      while (currentParent) {
        // Detect cycle
        if (currentParent === id) {
          return res.status(400).json({
            success: false,
            message: 'Circular reference detected in page hierarchy'
          });
        }
        
        // Detect infinite loop
        if (visited.has(currentParent)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid page hierarchy'
          });
        }
        
        visited.add(currentParent);
        
        // Get parent's parent
        const parent = await WikiPage.findById(currentParent);
        currentParent = parent ? parent.parent_id : null;
      }
    }
    
    // Prepare update data
    const updateData = {
      lastEditedBy: req.auth.userId
    };
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (parentId !== undefined) updateData.parentId = parentId;
    
    // Add revision entry
    const revisionData = {
      pageId: id,
      content: wikiPage.content,
      editedBy: wikiPage.last_edited_by,
      editedAt: wikiPage.updated_at
    };
    
    // Update wiki page with revision
    const updatedPage = await WikiPage.update(id, updateData, revisionData);
    
    return res.status(200).json({
      success: true,
      data: updatedPage
    });
  } catch (error) {
    logger.error(`Error updating wiki page ${req.params.id}:`, error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'A wiki page with this title already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating wiki page'
    });
  }
};

/**
 * Delete wiki page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteWikiPage = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if page exists
    const wikiPage = await WikiPage.findById(id);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Check if user has permission to delete this page
    if (req.auth.role !== 'admin') {
      // Get user's department
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      // Users can only delete pages from their own department
      if (wikiPage.department_id !== userDepartmentId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this page'
        });
      }
    }
    
    // Check if page has children
    const childrenCount = await WikiPage.countChildren(id);
    
    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete page with child pages'
      });
    }
    
    // Delete wiki page
    await WikiPage.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Wiki page deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting wiki page ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting wiki page'
    });
  }
};

/**
 * Search wiki pages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchWikiPages = async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }
    
    // Get user's department for access control
    let userDepartmentId = null;
    
    if (req.auth.role !== 'admin') {
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      userDepartmentId = userResult.rows[0]?.department_id;
    }
    
    // Search wiki pages
    const results = await WikiPage.search(
      query,
      parseInt(limit, 10),
      req.auth.role === 'admin' ? null : userDepartmentId
    );
    
    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Error searching wiki pages:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while searching wiki pages'
    });
  }
};

/**
 * Get wiki page tree structure
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getWikiTree = async (req, res) => {
  try {
    const { departmentId } = req.query;
    
    // Get user's department for access control
    let userDepartmentId = null;
    let isAdmin = req.auth.role === 'admin';
    
    if (!isAdmin) {
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      userDepartmentId = userResult.rows[0]?.department_id;
    }
    
    // If department is specified and user is not admin, check access
    if (departmentId && !isAdmin && departmentId !== userDepartmentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view wiki tree for your own department'
      });
    }
    
    // Get wiki tree
    const tree = await WikiPage.getTree(
      departmentId || null,
      isAdmin ? null : userDepartmentId
    );
    
    return res.status(200).json({
      success: true,
      data: tree
    });
  } catch (error) {
    logger.error('Error getting wiki tree:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching wiki tree'
    });
  }
};

/**
 * Get wiki page revision
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getRevision = async (req, res) => {
  try {
    const { id, revisionId } = req.params;
    
    // Check if page exists
    const wikiPage = await WikiPage.findById(id);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Check if user has permission to view this page
    if (req.auth.role !== 'admin') {
      // Get user's department
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      // Users can only view public pages or pages from their own department
      const canAccess = wikiPage.is_public || wikiPage.department_id === userDepartmentId;
      
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this page'
        });
      }
    }
    
    // Get revision
    const revision = await WikiPage.getRevision(id, revisionId);
    
    if (!revision) {
      return res.status(404).json({
        success: false,
        message: 'Revision not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: revision
    });
  } catch (error) {
    logger.error(`Error getting wiki page revision:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching revision'
    });
  }
};