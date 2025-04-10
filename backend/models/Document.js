const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { config } = require('../config/config');

class Document {
  /**
   * Create a new document
   * @param {Object} documentData - Document details
   * @returns {Promise<Object>} Created document
   */
  static async create(documentData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Generate UUID if not provided
      const documentId = documentData.id || uuidv4();
      
      // Insert document record
      const query = `
        INSERT INTO documents (
          id, title, description, file_path, file_type, file_size,
          category, tags, department_id, is_public, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, title, description, file_path, file_type, file_size,
          category, tags, department_id, is_public, created_by, created_at
      `;
      
      const values = [
        documentId,
        documentData.title,
        documentData.description || null,
        documentData.filePath,
        documentData.fileType,
        documentData.fileSize,
        documentData.category || null,
        documentData.tags || null,
        documentData.departmentId || null,
        documentData.isPublic || false,
        documentData.createdBy
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating document:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Find document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Document object
   */
  static async findById(id) {
    try {
      const query = `
        SELECT d.*, 
          u.first_name || ' ' || u.last_name AS created_by_name,
          dep.name AS department_name
        FROM documents d
        LEFT JOIN users u ON d.created_by = u.id
        LEFT JOIN departments dep ON d.department_id = dep.id
        WHERE d.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error finding document by ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Update document information
   * @param {string} id - Document ID
   * @param {Object} documentData - Updated document data
   * @returns {Promise<Object>} Updated document
   */
  static async update(id, documentData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Build update query dynamically based on provided fields
      const allowedFields = [
        'title', 'description', 'file_path', 'file_type', 'file_size',
        'category', 'tags', 'department_id', 'is_public'
      ];
      
      const setClause = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(documentData)) {
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(dbField)) {
          setClause.push(`${dbField} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      
      // Always update the updated_at timestamp
      setClause.push(`updated_at = NOW()`);
      
      // If no fields to update
      if (setClause.length === 0) {
        return await Document.findById(id);
      }
      
      // Add document ID as the last parameter
      values.push(id);
      
      const query = `
        UPDATE documents
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, title, description, file_path, file_type, file_size,
          category, tags, department_id, is_public, created_by, created_at, updated_at
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating document ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete document
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get document file path before deleting
      const document = await Document.findById(id);
      
      if (!document) {
        return false;
      }
      
      // Delete the document record
      const query = `DELETE FROM documents WHERE id = $1`;
      const result = await client.query(query, [id]);
      
      if (result.rowCount === 0) {
        return false;
      }
      
      // Delete the physical file if exists
      if (document.file_path) {
        const filePath = path.join(config.uploads.path, document.file_path.replace('/uploads/', ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting document ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * List documents with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Documents list and count
   */
  static async list({ 
    page = 1, 
    limit = 20, 
    departmentId,
    category,
    searchTerm,
    createdBy,
    visibilityFilter,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  }) {
    try {
      // Build query conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (departmentId) {
        conditions.push(`d.department_id = $${paramIndex}`);
        params.push(departmentId);
        paramIndex++;
      }
      
      if (category) {
        conditions.push(`d.category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }
      
      if (createdBy) {
        conditions.push(`d.created_by = $${paramIndex}`);
        params.push(createdBy);
        paramIndex++;
      }
      
      if (visibilityFilter) {
        // Handle visibility access control
        const visibilityConditions = [];
        
        if (visibilityFilter.isPublic) {
          visibilityConditions.push('d.is_public = true');
        }
        
        if (visibilityFilter.userDepartmentId) {
          visibilityConditions.push(`d.department_id = $${paramIndex}`);
          params.push(visibilityFilter.userDepartmentId);
          paramIndex++;
        }
        
        if (visibilityConditions.length > 0) {
          conditions.push(`(${visibilityConditions.join(' OR ')})`);
        }
      }
      
      if (searchTerm) {
        conditions.push(`(
          d.title ILIKE $${paramIndex} OR 
          d.description ILIKE $${paramIndex} OR
          d.tags ILIKE $${paramIndex}
        )`);
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern);
        paramIndex++;
      }
      
      // Build WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Validate sort parameters to prevent SQL injection
      const validSortColumns = ['title', 'created_at', 'file_size', 'category'];
      const validSortOrders = ['ASC', 'DESC'];
      
      const finalSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'DESC';
      
      // Count total matching documents
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM documents d
        ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total, 10);
      
      // Calculate pagination
      const offset = (page - 1) * limit;
      const lastPage = Math.ceil(total / limit);
      
      // Get paginated results
      const listParams = [...params, limit, offset];
      const listQuery = `
        SELECT d.id, d.title, d.description, d.file_path, d.file_type, 
          d.file_size, d.category, d.tags, d.is_public, 
          d.created_at, d.updated_at, d.department_id,
          u.first_name || ' ' || u.last_name AS created_by_name,
          dep.name AS department_name
        FROM documents d
        LEFT JOIN users u ON d.created_by = u.id
        LEFT JOIN departments dep ON d.department_id = dep.id
        ${whereClause}
        ORDER BY d.${finalSortBy} ${finalSortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const result = await db.query(listQuery, listParams);
      
      return {
        data: result.rows,
        pagination: {
          total,
          per_page: limit,
          current_page: page,
          last_page,
          from: offset + 1,
          to: Math.min(offset + limit, total)
        }
      };
    } catch (error) {
      logger.error('Error listing documents:', error);
      throw error;
    }
  }
  
  /**
   * Get document categories
   * @returns {Promise<Array>} List of categories with counts
   */
  static async getCategories() {
    try {
      const query = `
        SELECT 
          category,
          COUNT(*) AS document_count
        FROM documents
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY document_count DESC, category
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting document categories:', error);
      throw error;
    }
  }
  
  /**
   * Search documents by term
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results
   * @param {Object} visibilityFilter - Access control filter
   * @returns {Promise<Array>} Matching documents
   */
  static async search(searchTerm, limit = 20, visibilityFilter) {
    try {
      const conditions = [
        `(
          title ILIKE $1 OR 
          description ILIKE $1 OR
          tags ILIKE $1
        )`
      ];
      
      const params = [`%${searchTerm}%`];
      let paramIndex = 2;
      
      if (visibilityFilter) {
        // Handle visibility access control
        const visibilityConditions = [];
        
        if (visibilityFilter.isPublic) {
          visibilityConditions.push('is_public = true');
        }
        
        if (visibilityFilter.userDepartmentId) {
          visibilityConditions.push(`department_id = $${paramIndex}`);
          params.push(visibilityFilter.userDepartmentId);
          paramIndex++;
        }
        
        if (visibilityConditions.length > 0) {
          conditions.push(`(${visibilityConditions.join(' OR ')})`);
        }
      }
      
      // Build WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      const query = `
        SELECT id, title, description, file_type, category, created_at
        FROM documents
        ${whereClause}
        ORDER BY 
          CASE 
            WHEN title ILIKE $1 THEN 0
            WHEN description ILIKE $1 THEN 1
            ELSE 2
          END,
          created_at DESC
        LIMIT $${paramIndex}
      `;
      
      params.push(limit);
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error searching documents:', error);
      throw error;
    }
  }
  
  /**
   * Get recent documents
   * @param {number} limit - Maximum results
   * @param {Object} visibilityFilter - Access control filter
   * @returns {Promise<Array>} Recent documents
   */
  static async getRecent(limit = 5, visibilityFilter) {
    try {
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (visibilityFilter) {
        // Handle visibility access control
        const visibilityConditions = [];
        
        if (visibilityFilter.isPublic) {
          visibilityConditions.push('d.is_public = true');
        }
        
        if (visibilityFilter.userDepartmentId) {
          visibilityConditions.push(`d.department_id = $${paramIndex}`);
          params.push(visibilityFilter.userDepartmentId);
          paramIndex++;
        }
        
        if (visibilityConditions.length > 0) {
          conditions.push(`(${visibilityConditions.join(' OR ')})`);
        }
      }
      
      // Build WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      params.push(limit);
      
      const query = `
        SELECT d.id, d.title, d.file_type, d.created_at, 
          d.department_id, dep.name AS department_name
        FROM documents d
        LEFT JOIN departments dep ON d.department_id = dep.id
        ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT $${paramIndex}
      `;
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting recent documents:', error);
      throw error;
    }
  }
}

module.exports = Document;