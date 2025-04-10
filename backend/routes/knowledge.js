const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
const { uploadDocument } = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Routes accessible to all authenticated users
router.get('/', documentController.listDocuments);
router.get('/search', documentController.searchDocuments);
router.get('/recent', documentController.getRecentDocuments);
router.get('/stats/file-types', documentController.getFileTypeStats);
router.get('/:id', documentController.getDocumentById);

// Upload new document
router.post('/', 
  uploadDocument,
  documentController.uploadDocument
);

// Document ownership check for updates and deletes
const checkDocumentOwnership = checkOwnership(async (req) => {
  const document = await Document.findById(req.params.id);
  return document ? document.uploaded_by : null;
});

// Update document - allow owner or admin
router.put('/:id',
  (req, res, next) => {
    // Admins can update any document
    if (req.auth.role === 'admin') {
      return next();
    }
    // For non-admins, check ownership
    return checkDocumentOwnership(req, res, next);
  },
  uploadDocument,
  documentController.updateDocument
);

// Delete document - allow owner or admin
router.delete('/:id',
  (req, res, next) => {
    // Admins can delete any document
    if (req.auth.role === 'admin') {
      return next();
    }
    // For non-admins, check ownership
    return checkDocumentOwnership(req, res, next);
  },
  documentController.deleteDocument
);

module.exports = router;