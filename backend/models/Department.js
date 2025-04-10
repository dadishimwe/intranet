const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

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
          id, title, description, file_path, file_size, file_type,
          department_id, uploaded_by, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, title, description, file_path, file_size, file_type,
          department_id, uploaded_by, created_at, is_public
      `;
      
      const values = [
        documentId,
        documentData.title,
        documentData.description || null,
        documentData.filePath,
        documentData.fileSize,
        documentData.fileType,
        documentData.departmentId || null,
        documentData.uploadedBy,
        documentData.isPublic || false
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
        SELECT d.id, d.title, d.description, d.file_path, d.file_size, d.file_type,
          d.department_id, d.uploaded_by, d.version, d.created_at, d.updated_at, d.is_public,
          dep.name AS department_name,
          CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
        FROM documents d
        LEFT JOIN departments dep ON d.department_id = dep.id
        LEFT JOIN users u ON d.uploaded_by = u.id
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
        'title', 'description', 'department_id', 'is_public'
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
      
      // If new file is provided
      if (documentData.filePath) {
        setClause.push(`file_path = $${paramIndex}`);
        values.push(documentData.filePath);
        paramIndex++;
        
        setClause.push(`file_size = $${paramIndex}`);
        values.push(documentData.fileSize);
        paramIndex++;
        
        setClause.push(`file_type = $${paramIndex}`);
        values.push(documentData.fileType);
        paramIndex++;
        
        // Increment version
        setClause.push(`version = version + 1`);
      }
      
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
        RETURNING id, title, description, file_path, file_size, file_type,
          department_id, uploaded_by, version, created_at, updated_at, is_public
      `;
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }
      
      await client.query('COMMIT');
      
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
    try {
      const query = `
        DELETE FROM documents WHERE id = $1
      `;
      
      const result = await db.query(query, [id]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting document ${id}:`, error);
      throw error;
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
    searchTerm,
    fileType,
    uploadedBy,
    isPublic
  }) {
    try {
      // Build query conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (departmentId) {
        if (departmentId === 'null') {
          conditions.push(`d.department_id IS NULL`);
        } else {
          conditions.push(`d.department_id = $${paramIndex}`);
          params.push(departmentId);
          paramIndex++;
        }
      }
      
      if (fileType) {
        conditions.push(`d.file_type = $${paramIndex}`);
        params.push(fileType);
        paramIndex++;
      }
      
      if (uploadedBy) {
        conditions.push(`d.uploaded_by = $${paramIndex}`);
        params.push(uploadedBy);
        paramIndex++;
      }
      
      if (isPublic !== undefined) {
        conditions.push(`d.is_public = $${paramIndex}`);
        params.push(isPublic);
        paramIndex++;
      }
      
      if (searchTerm) {
        conditions.push(`(
          d.title ILIKE $${paramIndex} OR 
          d.description ILIKE $${paramIndex}
        )`);
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern);
        paramIndex++;
      }
      
      // Build WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
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
        SELECT d.id, d.title, d.description, d.file_path, d.file_size, 
          d.file_type, d.version, d.department_id, d.uploaded_by, 
          d.created_at, d.is_public,
          dep.name AS department_name,
          CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
        FROM documents d
        LEFT JOIN departments dep ON d.department_id = dep.id
        LEFT JOIN users u ON d.uploaded_by = u.id
        ${whereClause}
        ORDER BY d.created_at DESC
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
   * Search documents by keyword
   * @param {string} keyword - Search keyword
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Documents matching the search
   */
  static async search(keyword, { departmentId, limit = 20 } = {}) {
    try {
      const conditions = [`(d.title ILIKE $1 OR d.description ILIKE $1)`];
      const params = [`%${keyword}%`];
      let paramIndex = 2;
      
      if (departmentId) {
        conditions.push(`(d.department_id = $${paramIndex} OR d.is_public = true)`);
        params.push(departmentId);
        paramIndex++;
      } else {
        conditions.push(`d.is_public = true`);
      }
      
      const query = `
        SELECT d.id, d.title, d.description, d.file_path, d.file_size, 
          d.file_type, d.version, d.department_id, d.created_at,
          dep.name AS department_name,
          CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
        FROM documents d
        LEFT JOIN departments dep ON d.department_id = dep.id
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY 
          ts_rank(
            to_tsvector('english', d.title || ' ' || COALESCE(d.description, '')),
            to_tsquery('english', $${paramIndex})
          ) DESC,
          d.created_at DESC
        LIMIT $${paramIndex + 1}
      `;
      
      // Convert keyword to tsquery format
      const tsQuery = keyword
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word + ':*')
        .join(' & ');
      
      params.push(tsQuery || keyword);  // Fallback to keyword if tsquery is empty
      params.push(limit);
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error searching documents for "${keyword}":`, error);
      throw error;
    }
  }
  
  /**
   * Get the file types statistics
   * @returns {Promise<Array>} File type statistics
   */
  static async getFileTypeStats() {
    try {
      const query = `
        SELECT file_type, COUNT(*) as count
        FROM documents
        GROUP BY file_type
        ORDER BY count DESC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting file type statistics:', error);
      throw error;
    }
  }
  
  /**
   * Get recently added documents
   * @param {number} limit - Number of documents to return
   * @param {string} userId - User ID for access control
   * @returns {Promise<Array>} Recent documents
   */
  static async getRecentDocuments(limit = 5, userId) {
    try {
      // Get user's department for access control
      const userResult = await db.query(
        'SELECT department_id, role FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const { department_id: userDepartmentId, role } = userResult.rows[0];
      
      let query;
      let params;
      
      if (role === 'admin') {
        // Admins can see all documents
        query = `
          SELECT d.id, d.title, d.file_type, d.created_at, d.file_size,
            dep.name AS department_name,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
          FROM documents d
          LEFT JOIN departments dep ON d.department_id = dep.id
          LEFT JOIN users u ON d.uploaded_by = u.id
          ORDER BY d.created_at DESC
          LIMIT $1
        `;
        params = [limit];
      } else {
        // Regular users can see public documents and their department's documents
        query = `
          SELECT d.id, d.title, d.file_type, d.created_at, d.file_size,
            dep.name AS department_name,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
          FROM documents d
          LEFT JOIN departments dep ON d.department_id = dep.id
          LEFT JOIN users u ON d.uploaded_by = u.id
          WHERE d.is_public = true OR d.department_id = $2
          ORDER BY d.created_at DESC
          LIMIT $1
        `;
        params = [limit, userDepartmentId];
      }
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting recent documents:', error);
      throw error;
    }
  }
}

module.exports = Document;