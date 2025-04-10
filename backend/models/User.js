const db = require('../config/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { config } = require('../config/config');

class User {
  /**
   * Create a new user
   * @param {Object} userData - User details
   * @returns {Promise<Object>} Created user
   */
  static async create(userData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Hash password
      const passwordHash = await bcrypt.hash(
        userData.password, 
        config.auth.saltRounds
      );
      
      // Generate UUID if not provided
      const userId = userData.id || uuidv4();
      
      // Insert user record
      const query = `
        INSERT INTO users (
          id, email, password_hash, first_name, last_name, 
          role, job_title, phone, department_id, manager_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, email, first_name, last_name, role, job_title, 
          phone, profile_image, department_id, manager_id, created_at
      `;
      
      const values = [
        userId,
        userData.email.toLowerCase(),
        passwordHash,
        userData.firstName,
        userData.lastName,
        userData.role || 'employee',
        userData.jobTitle || null,
        userData.phone || null,
        userData.departmentId || null,
        userData.managerId || null
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Handle duplicate email
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        throw new Error('Email already exists');
      }
      
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object
   */
  static async findById(id) {
    try {
      const query = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.role, 
          u.job_title, u.phone, u.profile_image, u.department_id, 
          u.manager_id, u.created_at, u.last_login, u.is_active,
          d.name AS department_name,
          CONCAT(m.first_name, ' ', m.last_name) AS manager_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE u.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error finding user by ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User object
   */
  static async findByEmail(email) {
    try {
      const query = `
        SELECT * FROM users WHERE email = $1
      `;
      
      const result = await db.query(query, [email.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error finding user by email ${email}:`, error);
      throw error;
    }
  }
  
  /**
   * Update user information
   * @param {string} id - User ID
   * @param {Object} userData - Updated user data
   * @returns {Promise<Object>} Updated user
   */
  static async update(id, userData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Build update query dynamically based on provided fields
      const allowedFields = [
        'first_name', 'last_name', 'job_title', 'phone', 
        'department_id', 'manager_id', 'is_active'
      ];
      
      const setClause = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(userData)) {
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(dbField)) {
          setClause.push(`${dbField} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      
      // Handle password update separately
      if (userData.password) {
        const passwordHash = await bcrypt.hash(
          userData.password, 
          config.auth.saltRounds
        );
        
        setClause.push(`password_hash = $${paramIndex}`);
        values.push(passwordHash);
        paramIndex++;
      }
      
      // If no fields to update
      if (setClause.length === 0) {
        return await User.findById(id);
      }
      
      // Add user ID as the last parameter
      values.push(id);
      
      const query = `
        UPDATE users
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, first_name, last_name, role, job_title, 
          phone, profile_image, department_id, manager_id, created_at, 
          updated_at, is_active
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating user ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    try {
      const query = `
        DELETE FROM users WHERE id = $1
      `;
      
      const result = await db.query(query, [id]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * List users with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users list and count
   */
  static async list({ 
    page = 1, 
    limit = 20, 
    departmentId,
    searchTerm,
    role,
    isActive 
  }) {
    try {
      // Build query conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (departmentId) {
        conditions.push(`u.department_id = $${paramIndex}`);
        params.push(departmentId);
        paramIndex++;
      }
      
      if (role) {
        conditions.push(`u.role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }
      
      if (isActive !== undefined) {
        conditions.push(`u.is_active = $${paramIndex}`);
        params.push(isActive);
        paramIndex++;
      }
      
      if (searchTerm) {
        conditions.push(`(
          u.first_name ILIKE $${paramIndex} OR 
          u.last_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR
          u.job_title ILIKE $${paramIndex}
        )`);
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern);
        paramIndex++;
      }
      
      // Build WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Count total matching users
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM users u
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
        SELECT u.id, u.email, u.first_name, u.last_name, 
          u.role, u.job_title, u.profile_image, 
          u.department_id, u.is_active,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ${whereClause}
        ORDER BY u.last_name, u.first_name
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
      logger.error('Error listing users:', error);
      throw error;
    }
  }
  
  /**
   * Verify user password
   * @param {string} email - User email
   * @param {string} password - Password to verify
   * @returns {Promise<Object|null>} User object if valid, null otherwise
   */
  static async verifyCredentials(email, password) {
    try {
      const user = await User.findByEmail(email);
      
      if (!user) {
        return null;
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return null;
      }
      
      // Update last login time
      await db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );
      
      // Don't return password hash
      delete user.password_hash;
      
      return user;
    } catch (error) {
      logger.error(`Error verifying credentials for ${email}:`, error);
      throw error;
    }
  }
  
  /**
   * Get direct reports for a manager
   * @param {string} managerId - Manager ID
   * @returns {Promise<Array>} List of direct reports
   */
  static async getDirectReports(managerId) {
    try {
      const query = `
        SELECT id, email, first_name, last_name, job_title, profile_image
        FROM users
        WHERE manager_id = $1
        ORDER BY last_name, first_name
      `;
      
      const result = await db.query(query, [managerId]);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting direct reports for ${managerId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update user profile image
   * @param {string} id - User ID
   * @param {string} imagePath - Path to profile image
   * @returns {Promise<Object>} Updated user
   */
  static async updateProfileImage(id, imagePath) {
    try {
      const query = `
        UPDATE users
        SET profile_image = $1
        WHERE id = $2
        RETURNING id, email, first_name, last_name, profile_image
      `;
      
      const result = await db.query(query, [imagePath, id]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error updating profile image for user ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Generate org chart data
   * @returns {Promise<Array>} Hierarchical org data
   */
  static async getOrgChartData() {
    try {
      const query = `
        WITH RECURSIVE org_tree AS (
          -- Base case: top-level employees (no manager)
          SELECT 
            u.id, 
            u.first_name, 
            u.last_name, 
            u.job_title, 
            u.department_id, 
            u.manager_id, 
            u.profile_image,
            d.name AS department_name,
            0 AS level
          FROM users u
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.manager_id IS NULL
          
          UNION ALL
          
          -- Recursive case: employees with managers
          SELECT 
            u.id, 
            u.first_name, 
            u.last_name, 
            u.job_title, 
            u.department_id, 
            u.manager_id, 
            u.profile_image,
            d.name AS department_name,
            ot.level + 1
          FROM users u
          JOIN org_tree ot ON u.manager_id = ot.id
          LEFT JOIN departments d ON u.department_id = d.id
        )
        SELECT * FROM org_tree
        ORDER BY level, last_name, first_name
      `;
      
      const result = await db.query(query);
      
      // Transform into hierarchical structure
      // (Simplified for raspberry pi - full transformation would be resource intensive)
      return result.rows;
    } catch (error) {
      logger.error('Error generating org chart data:', error);
      throw error;
    }
  }
}

module.exports = User;