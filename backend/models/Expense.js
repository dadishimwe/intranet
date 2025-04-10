const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class Expense {
  /**
   * Create a new expense
   * @param {Object} expenseData - Expense details
   * @returns {Promise<Object>} Created expense
   */
  static async create(expenseData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Generate UUID if not provided
      const expenseId = expenseData.id || uuidv4();
      
      // Insert expense record
      const query = `
        INSERT INTO expenses (
          id, user_id, amount, currency, date, description,
          category, receipt_path, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, user_id, amount, currency, date, description,
          category, receipt_path, status, created_at
      `;
      
      const values = [
        expenseId,
        expenseData.userId,
        expenseData.amount,
        expenseData.currency,
        expenseData.date,
        expenseData.description,
        expenseData.category,
        expenseData.receiptPath || null,
        expenseData.status || 'draft'
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating expense:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Find expense by ID
   * @param {string} id - Expense ID
   * @returns {Promise<Object>} Expense object
   */
  static async findById(id) {
    try {
      const query = `
        SELECT e.id, e.user_id, e.amount, e.currency, e.date, e.description,
          e.category, e.receipt_path, e.status, e.submitted_at, e.approved_by,
          e.approved_at, e.paid_at, e.created_at, e.updated_at,
          CONCAT(u.first_name, ' ', u.last_name) AS user_name,
          u.email AS user_email,
          u.manager_id AS user_manager_id,
          CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
          CONCAT(a.first_name, ' ', a.last_name) AS approver_name
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN users m ON u.manager_id = m.id
        LEFT JOIN users a ON e.approved_by = a.id
        WHERE e.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error finding expense by ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Update expense
   * @param {string} id - Expense ID
   * @param {Object} expenseData - Updated expense data
   * @returns {Promise<Object>} Updated expense
   */
  static async update(id, expenseData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Build update query dynamically based on provided fields
      const allowedFields = [
        'amount', 'currency', 'date', 'description', 'category', 'receipt_path'
      ];
      
      const setClause = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(expenseData)) {
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(dbField)) {
          setClause.push(`${dbField} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      
      // If no fields to update
      if (setClause.length === 0) {
        return await Expense.findById(id);
      }
      
      // Add expense ID as the last parameter
      values.push(id);
      
      const query = `
        UPDATE expenses
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, user_id, amount, currency, date, description,
          category, receipt_path, status, submitted_at, approved_by,
          approved_at, paid_at, created_at, updated_at
      `;
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Expense not found');
      }
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating expense ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete expense
   * @param {string} id - Expense ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // First delete approvals
      await client.query(
        'DELETE FROM expense_approvals WHERE expense_id = $1',
        [id]
      );
      
      // Then delete the expense
      const result = await client.query(
        'DELETE FROM expenses WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting expense ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * List expenses with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Expenses list and count
   */
  static async list({ 
    page = 1, 
    limit = 20, 
    userId,
    userIdList,
    status,
    startDate,
    endDate,
    category,
    minAmount,
    maxAmount,
    sort = 'dateDesc'
  }) {
    try {
      // Build query conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      // User filter
      if (userId) {
        conditions.push(`e.user_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
      } else if (userIdList && userIdList.length > 0) {
        // Filter by list of users (e.g., manager viewing direct reports)
        conditions.push(`e.user_id = ANY($${paramIndex})`);
        params.push(userIdList);
        paramIndex++;
      }
      
      // Status filter
      if (status) {
        conditions.push(`e.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
      
      // Date range filter
      if (startDate) {
        conditions.push(`e.date >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }
      
      if (endDate) {
        conditions.push(`e.date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }
      
      // Category filter
      if (category) {
        conditions.push(`e.category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }
      
      // Amount range filter
      if (minAmount !== undefined) {
        conditions.push(`e.amount >= $${paramIndex}`);
        params.push(minAmount);
        paramIndex++;
      }
      
      if (maxAmount !== undefined) {
        conditions.push(`e.amount <= $${paramIndex}`);
        params.push(maxAmount);
        paramIndex++;
      }
      
      // Build WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Build ORDER BY clause based on sort parameter
      let orderBy;
      switch (sort) {
        case 'dateAsc':
          orderBy = 'e.date ASC, e.created_at ASC';
          break;
        case 'amountDesc':
          orderBy = 'e.amount DESC, e.date DESC';
          break;
        case 'amountAsc':
          orderBy = 'e.amount ASC, e.date DESC';
          break;
        case 'statusAsc':
          orderBy = `CASE 
              WHEN e.status = \'draft\' THEN 1
              WHEN e.status = \'submitted\' THEN 2
              WHEN e.status = \'approved\' THEN 3
              WHEN e.status = \'rejected\' THEN 4
              WHEN e.status = \'paid\' THEN 5
            END ASC, e.date DESC`;
          break;
        case 'statusDesc':
          orderBy = `CASE 
              WHEN e.status = \'draft\' THEN 1
              WHEN e.status = \'submitted\' THEN 2
              WHEN e.status = \'approved\' THEN 3
              WHEN e.status = \'rejected\' THEN 4
              WHEN e.status = \'paid\' THEN 5
            END DESC, e.date DESC`;
          break;
        case 'dateDesc':
        default:
          orderBy = 'e.date DESC, e.created_at DESC';
      }
      
      // Count total matching expenses
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM expenses e
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
        SELECT e.id, e.user_id, e.amount, e.currency, e.date, e.description,
          e.category, e.status, e.submitted_at, e.approved_at, e.paid_at,
          e.receipt_path, e.created_at,
          CONCAT(u.first_name, ' ', u.last_name) AS user_name,
          u.email AS user_email,
          CONCAT(a.first_name, ' ', a.last_name) AS approver_name
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN users a ON e.approved_by = a.id
        ${whereClause}
        ORDER BY ${orderBy}
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
      logger.error('Error listing expenses:', error);
      throw error;
    }
  }
  
  /**
   * Submit expense for approval
   * @param {string} id - Expense ID
   * @returns {Promise<Object>} Updated expense
   */
  static async submit(id) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update expense status and submitted timestamp
      const query = `
        UPDATE expenses
        SET status = 'submitted', submitted_at = NOW()
        WHERE id = $1 AND status = 'draft'
        RETURNING *
      `;
      
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Expense not found or not in draft status');
      }
      
      const expense = result.rows[0];
      
      // Get user's manager to create approval entry
      const userQuery = `
        SELECT manager_id
        FROM users
        WHERE id = $1 AND manager_id IS NOT NULL
      `;
      
      const userResult = await client.query(userQuery, [expense.user_id]);
      
      // Create approval entry if user has a manager
      if (userResult.rows.length > 0) {
        const managerId = userResult.rows[0].manager_id;
        
        const approvalQuery = `
          INSERT INTO expense_approvals (
            id, expense_id, approver_id, level, status
          ) VALUES ($1, $2, $3, $4, $5)
        `;
        
        await client.query(approvalQuery, [
          uuidv4(),
          id,
          managerId,
          1, // First level approval
          'pending'
        ]);
      }
      
      await client.query('COMMIT');
      
      return await Expense.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error submitting expense ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Approve expense
   * @param {string} id - Expense ID
   * @param {string} approverId - Approver user ID
   * @param {string} comments - Approval comments
   * @returns {Promise<Object>} Updated expense
   */
  static async approve(id, approverId, comments) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Check if expense exists and is in submitted status
      const expenseQuery = `
        SELECT *
        FROM expenses
        WHERE id = $1 AND status = 'submitted'
      `;
      
      const expenseResult = await client.query(expenseQuery, [id]);
      
      if (expenseResult.rows.length === 0) {
        throw new Error('Expense not found or not in submitted status');
      }
      
      const expense = expenseResult.rows[0];
      
      // Update approval record
      const approvalQuery = `
        UPDATE expense_approvals
        SET status = 'approved', comments = $1, updated_at = NOW()
        WHERE expense_id = $2 AND approver_id = $3
        RETURNING *
      `;
      
      const approvalResult = await client.query(approvalQuery, [
        comments || null,
        id,
        approverId
      ]);
      
      // Update expense status
      const updateQuery = `
        UPDATE expenses
        SET status = 'approved', approved_by = $1, approved_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      await client.query(updateQuery, [approverId, id]);
      
      await client.query('COMMIT');
      
      return await Expense.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error approving expense ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Reject expense
   * @param {string} id - Expense ID
   * @param {string} approverId - Approver user ID
   * @param {string} comments - Rejection comments
   * @returns {Promise<Object>} Updated expense
   */
  static async reject(id, approverId, comments) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Check if expense exists and is in submitted status
      const expenseQuery = `
        SELECT *
        FROM expenses
        WHERE id = $1 AND status = 'submitted'
      `;
      
      const expenseResult = await client.query(expenseQuery, [id]);
      
      if (expenseResult.rows.length === 0) {
        throw new Error('Expense not found or not in submitted status');
      }
      
      // Update approval record
      const approvalQuery = `
        UPDATE expense_approvals
        SET status = 'rejected', comments = $1, updated_at = NOW()
        WHERE expense_id = $2 AND approver_id = $3
        RETURNING *
      `;
      
      const approvalResult = await client.query(approvalQuery, [
        comments || null,
        id,
        approverId
      ]);
      
      // Update expense status
      const updateQuery = `
        UPDATE expenses
        SET status = 'rejected'
        WHERE id = $1
        RETURNING *
      `;
      
      await client.query(updateQuery, [id]);
      
      await client.query('COMMIT');
      
      return await Expense.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error rejecting expense ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Mark expense as paid
   * @param {string} id - Expense ID
   * @param {string} paymentDetails - Payment details
   * @returns {Promise<Object>} Updated expense
   */
  static async markAsPaid(id, paymentDetails) {
    try {
      const query = `
        UPDATE expenses
        SET status = 'paid', paid_at = NOW()
        WHERE id = $1 AND status = 'approved'
        RETURNING *
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Expense not found or not in approved status');
      }
      
      // If payment details provided, store in a separate table/field if needed
      // This is a simplified implementation
      
      return await Expense.findById(id);
    } catch (error) {
      logger.error(`Error marking expense ${id} as paid:`, error);
      throw error;
    }
  }
  
  /**
   * Get expense approvals
   * @param {string} expenseId - Expense ID
   * @returns {Promise<Array>} Approvals list
   */
  static async getApprovals(expenseId) {
    try {
      const query = `
        SELECT ea.id, ea.expense_id, ea.approver_id, ea.level, ea.status, 
          ea.comments, ea.created_at, ea.updated_at,
          CONCAT(u.first_name, ' ', u.last_name) AS approver_name,
          u.email AS approver_email
        FROM expense_approvals ea
        JOIN users u ON ea.approver_id = u.id
        WHERE ea.expense_id = $1
        ORDER BY ea.level ASC
      `;
      
      const result = await db.query(query, [expenseId]);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting approvals for expense ${expenseId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get expense statistics
   * @param {string} period - Time period ('week', 'month', 'quarter', 'year')
   * @param {string} userId - Optional user ID for filtering
   * @returns {Promise<Object>} Statistics data
   */
  static async getStatistics(period, userId) {
    try {
      // Define date range based on period
      let dateInterval;
      switch (period) {
        case 'week':
          dateInterval = 'INTERVAL \'7 days\'';
          break;
        case 'month':
          dateInterval = 'INTERVAL \'30 days\'';
          break;
        case 'quarter':
          dateInterval = 'INTERVAL \'90 days\'';
          break;
        case 'year':
        default:
          dateInterval = 'INTERVAL \'365 days\'';
      }
      
      // Build query conditions for userId
      const userFilter = userId ? 'AND e.user_id = $1' : '';
      const params = userId ? [userId] : [];
      
      // Total expenses by status
      const statusQuery = `
        SELECT 
          e.status,
          COUNT(*) AS count,
          SUM(e.amount) AS total_amount
        FROM expenses e
        WHERE e.date >= NOW() - ${dateInterval}
        ${userFilter}
        GROUP BY e.status
        ORDER BY CASE 
          WHEN e.status = 'draft' THEN 1
          WHEN e.status = 'submitted' THEN 2
          WHEN e.status = 'approved' THEN 3
          WHEN e.status = 'rejected' THEN 4
          WHEN e.status = 'paid' THEN 5
        END
      `;
      
      const statusResult = await db.query(statusQuery, params);
      
      // Expenses by category
      const categoryQuery = `
        SELECT 
          e.category,
          COUNT(*) AS count,
          SUM(e.amount) AS total_amount
        FROM expenses e
        WHERE e.date >= NOW() - ${dateInterval}
        ${userFilter}
        GROUP BY e.category
        ORDER BY SUM(e.amount) DESC
      `;
      
      const categoryResult = await db.query(categoryQuery, params);
      
      // Expenses by month (for trends)
      const trendsQuery = `
        SELECT 
          TO_CHAR(e.date, 'YYYY-MM') AS month,
          COUNT(*) AS count,
          SUM(e.amount) AS total_amount
        FROM expenses e
        WHERE e.date >= NOW() - ${dateInterval}
        ${userFilter}
        GROUP BY TO_CHAR(e.date, 'YYYY-MM')
        ORDER BY month
      `;
      
      const trendsResult = await db.query(trendsQuery, params);
      
      // Get overall totals
      const totalsQuery = `
        SELECT 
          COUNT(*) AS total_count,
          SUM(e.amount) AS total_amount,
          AVG(e.amount) AS average_amount,
          MIN(e.amount) AS min_amount,
          MAX(e.amount) AS max_amount
        FROM expenses e
        WHERE e.date >= NOW() - ${dateInterval}
        ${userFilter}
      `;
      
      const totalsResult = await db.query(totalsQuery, params);
      
      return {
        byStatus: statusResult.rows,
        byCategory: categoryResult.rows,
        trends: trendsResult.rows,
        totals: totalsResult.rows[0]
      };
    } catch (error) {
      logger.error('Error getting expense statistics:', error);
      throw error;
    }
  }
}

module.exports = Expense;