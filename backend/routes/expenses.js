const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { uploadReceipt } = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Get expenses with filtering
router.get('/', expenseController.getExpenses);

// Get expense statistics
router.get('/statistics', expenseController.getStatistics);

// Get specific expense
router.get('/:id', 
  validate(schemas.expense.id, 'params'),
  expenseController.getExpenseById
);

// Create expense
router.post('/',
  uploadReceipt,
  validate(schemas.expense.create),
  expenseController.createExpense
);

// Update expense (only owner can update)
const checkExpenseOwnership = checkOwnership(async (req) => {
  const expense = await require('../models/Expense').findById(req.params.id);
  return expense ? expense.user_id : null;
});

router.put('/:id',
  validate(schemas.expense.id, 'params'),
  validate(schemas.expense.update),
  checkExpenseOwnership,
  uploadReceipt,
  expenseController.updateExpense
);

// Delete expense (only owner or admin can delete)
router.delete('/:id',
  validate(schemas.expense.id, 'params'),
  expenseController.deleteExpense
);

// Submit expense for approval (only owner can submit)
router.post('/:id/submit',
  validate(schemas.expense.id, 'params'),
  checkExpenseOwnership,
  expenseController.submitExpense
);

// Approve or reject expense (only managers or admins)
router.post('/:id/review',
  validate(schemas.expense.id, 'params'),
  validate(schemas.expense.review),
  authorize('admin', 'manager'),
  expenseController.reviewExpense
);

// Mark expense as paid (only admin)
router.post('/:id/paid',
  validate(schemas.expense.id, 'params'),
  validate(schemas.expense.payment),
  authorize('admin'),
  expenseController.markAsPaid
);

module.exports = router;