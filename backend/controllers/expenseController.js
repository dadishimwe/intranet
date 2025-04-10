const Expense = require('../models/Expense');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { config } = require('../config/config');
const db = require('../config/database');

/**
 * Get expenses with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getExpenses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId,
      status,
      startDate,
      endDate,
      category,
      minAmount,
      maxAmount,
      sort = 'dateDesc'
    } = req.query;
    
    // Build filter options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      userId: userId || undefined,
      status: status || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      category: category || undefined,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      sort
    };
    
    // Handle access control for non-admin users
    if (req.auth.role !== 'admin') {
      // Regular users can only see their own expenses
      if (req.auth.role === 'employee') {
        options.userId = req.auth.userId;
      }
      // Managers can see their own and their direct reports' expenses
      else if (req.auth.role === 'manager') {
        // Get manager's direct reports
        const reportsResult = await db.query(
          'SELECT id FROM users WHERE manager_id = $1',
          [req.auth.userId]
        );
        
        const reportIds = reportsResult.rows.map(row => row.id);
        
        // If a specific user was requested, check if it's valid
        if (options.userId && options.userId !== req.auth.userId && 
            !reportIds.includes(options.userId)) {
          return res.status(403).json({
            success: false,
            message: 'You can only view expenses for yourself and your direct reports'
          });
        }
        
        // If no specific user was requested, limit to self and direct reports
        if (!options.userId) {
          options.userIdList = [req.auth.userId, ...reportIds];
        }
      }
    }
    
    const result = await Expense.list(options);
    
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error getting expenses:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching expenses'
    });
  }
};

/**
 * Get expense by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await Expense.findById(id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    // Check if user has permission to view this expense
    const isOwner = expense.user_id === req.auth.userId;
    const isAdmin = req.auth.role === 'admin';
    const isManager = req.auth.role === 'manager';
    
    if (!isOwner && !isAdmin && (!isManager || expense.user_manager_id !== req.auth.userId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this expense'
      });
    }
    
    // Get approval history
    const approvals = await Expense.getApprovals(id);
    
    return res.status(200).json({
      success: true,
      data: {
        ...expense,
        approvals
      }
    });
  } catch (error) {
    logger.error(`Error getting expense ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching expense'
    });
  }
};

/**
 * Create new expense
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createExpense = async (req, res) => {
  try {
    const { 
      amount, 
      currency, 
      date, 
      description,
      category
    } = req.body;
    
    // Validate required fields
    if (!amount || !date || !description || !category) {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Amount, date, description, and category are required'
      });
    }
    
    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }
    
    // Validate date
    const expenseDate = new Date(date);
    if (isNaN(expenseDate.getTime())) {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    // Get system settings for categories
    const settingsResult = await db.query(
      "SELECT value FROM system_settings WHERE key = 'expense_categories'"
    );
    
    // Get valid categories
    const validCategories = settingsResult.rows.length > 0
      ? settingsResult.rows[0].value.split(',')
      : ['Travel', 'Meals', 'Office Supplies', 'Training', 'Other'];
    
    // Validate category
    if (!validCategories.includes(category)) {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }
    
    // Create expense data
    const expenseData = {
      userId: req.auth.userId,
      amount: parsedAmount,
      currency: currency || 'USD',
      date: expenseDate,
      description,
      category,
      status: 'draft', // Initial status
      receiptPath: req.file 
        ? `/uploads/receipts/${req.file.filename}` 
        : null
    };
    
    // Create expense
    const expense = await Expense.create(expenseData);
    
    return res.status(201).json({
      success: true,
      data: expense
    });
  } catch (error) {
    logger.error('Error creating expense:', error);
    
    // Delete uploaded file if exists
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating expense'
    });
  }
};

/**
 * Update expense
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      amount, 
      currency, 
      date, 
      description,
      category
    } = req.body;
    
    // Check if expense exists
    const expense = await Expense.findById(id);
    
    if (!expense) {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    // Check if user has permission to update this expense
    if (expense.user_id !== req.auth.userId) {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this expense'
      });
    }
    
    // Check if expense is in draft status
    if (expense.status !== 'draft') {
      // Delete uploaded file if exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Only draft expenses can be updated'
      });
    }
    
    // Prepare update data
    const updateData = {};
    
    // Validate and parse amount if provided
    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        // Delete uploaded file if exists
        if (req.file && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({
          success: false,
          message: 'Amount must be a positive number'
        });
      }
      updateData.amount = parsedAmount;
    }
    
    // Validate date if provided
    if (date) {
      const expenseDate = new Date(date);
      if (isNaN(expenseDate.getTime())) {
        // Delete uploaded file if exists
        if (req.file && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      updateData.date = expenseDate;
    }
    
    // Validate category if provided
    if (category) {
      // Get system settings for categories
      const settingsResult = await db.query(
        "SELECT value FROM system_settings WHERE key = 'expense_categories'"
      );
      
      // Get valid categories
      const validCategories = settingsResult.rows.length > 0
        ? settingsResult.rows[0].value.split(',')
        : ['Travel', 'Meals', 'Office Supplies', 'Training', 'Other'];
      
      if (!validCategories.includes(category)) {
        // Delete uploaded file if exists
        if (req.file && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        });
      }
      updateData.category = category;
    }
    
    // Add other fields to update data
    if (currency !== undefined) updateData.currency = currency;
    if (description !== undefined) updateData.description = description;
    
    // Handle receipt update
    if (req.file) {
      updateData.receiptPath = `/uploads/receipts/${req.file.filename}`;
      
      // Delete old receipt if exists
      if (expense.receipt_path) {
        const oldReceiptPath = path.join(
          config.uploads.path, 
          expense.receipt_path.replace('/uploads/', '')
        );
        
        if (fs.existsSync(oldReceiptPath)) {
          fs.unlinkSync(oldReceiptPath);
        }
      }
    }
    
    // Update expense
    const updatedExpense = await Expense.update(id, updateData);
    
    return res.status(200).json({
      success: true,
      data: updatedExpense
    });
  } catch (error) {
    logger.error(`Error updating expense ${req.params.id}:`, error);
    
    // Delete uploaded file if exists
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating expense'
    });
  }
};

/**
 * Delete expense
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if expense exists
    const expense = await Expense.findById(id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    // Check if user has permission to delete this expense
    if (expense.user_id !== req.auth.userId && req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this expense'
      });
    }
    
    // Check if expense can be deleted (only draft or rejected expenses)
    if (!['draft', 'rejected'].includes(expense.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected expenses can be deleted'
      });
    }
    
    // Delete receipt file if exists
    if (expense.receipt_path) {
      const receiptPath = path.join(
        config.uploads.path, 
        expense.receipt_path.replace('/uploads/', '')
      );
      
      if (fs.existsSync(receiptPath)) {
        fs.unlinkSync(receiptPath);
      }
    }
    
    // Delete expense
    await Expense.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting expense ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting expense'
    });
  }
};

/**
 * Submit expense for approval
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.submitExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if expense exists
    const expense = await Expense.findById(id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    // Check if user has permission to submit this expense
    if (expense.user_id !== req.auth.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to submit this expense'
      });
    }
    
    // Check if expense is in draft status
    if (expense.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft expenses can be submitted'
      });
    }
    
    // Submit expense
    const submittedExpense = await Expense.submit(id);
    
    return res.status(200).json({
      success: true,
      data: submittedExpense,
      message: 'Expense submitted for approval'
    });
  } catch (error) {
    logger.error(`Error submitting expense ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while submitting expense'
    });
  }
};

/**
 * Approve or reject expense
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.reviewExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    
    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }
    
    // Check if expense exists
    const expense = await Expense.findById(id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    // Check if expense is in submitted status
    if (expense.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted expenses can be reviewed'
      });
    }
    
    // Check if user has permission to approve/reject this expense
    const isAdmin = req.auth.role === 'admin';
    const isManager = req.auth.role === 'manager';
    
    if (!isAdmin && (!isManager || expense.user_manager_id !== req.auth.userId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to review this expense'
      });
    }
    
    // Process approval or rejection
    let reviewedExpense;
    
    if (action === 'approve') {
      reviewedExpense = await Expense.approve(id, req.auth.userId, comments);
    } else {
      reviewedExpense = await Expense.reject(id, req.auth.userId, comments);
    }
    
    return res.status(200).json({
      success: true,
      data: reviewedExpense,
      message: `Expense ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    logger.error(`Error reviewing expense ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while reviewing expense'
    });
  }
};

/**
 * Mark expense as paid
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDetails } = req.body;
    
    // Check if expense exists
    const expense = await Expense.findById(id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    // Check if expense is in approved status
    if (expense.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved expenses can be marked as paid'
      });
    }
    
    // Check if user has permission (admin only)
    if (req.auth.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can mark expenses as paid'
      });
    }
    
    // Mark expense as paid
    const paidExpense = await Expense.markAsPaid(id, paymentDetails);
    
    return res.status(200).json({
      success: true,
      data: paidExpense,
      message: 'Expense marked as paid successfully'
    });
  } catch (error) {
    logger.error(`Error marking expense ${req.params.id} as paid:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while marking expense as paid'
    });
  }
};

/**
 * Get expense statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getStatistics = async (req, res) => {
  try {
    const { period = 'month', userId } = req.query;
    
    // Validate period
    const validPeriods = ['week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`
      });
    }
    
    // Handle access control
    let targetUserId = userId;
    
    if (req.auth.role !== 'admin') {
      // For non-admins, enforce restrictions
      if (userId && userId !== req.auth.userId && req.auth.role !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'You can only view statistics for yourself'
        });
      }
      
      // Managers can view their direct reports
      if (req.auth.role === 'manager' && userId && userId !== req.auth.userId) {
        // Check if user is a direct report
        const reportsResult = await db.query(
          'SELECT 1 FROM users WHERE id = $1 AND manager_id = $2',
          [userId, req.auth.userId]
        );
        
        if (reportsResult.rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'You can only view statistics for your direct reports'
          });
        }
      }
      
      // Default to own statistics for non-admins
      if (!targetUserId) {
        targetUserId = req.auth.userId;
      }
    }
    
    // Get statistics
    const statistics = await Expense.getStatistics(period, targetUserId);
    
    return res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting expense statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching expense statistics'
    });
  }
};