const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation schemas for API requests
 */
const schemas = {
  // User validation schemas
  user: {
    create: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      role: Joi.string().valid('admin', 'manager', 'employee').default('employee'),
      jobTitle: Joi.string().allow('', null),
      phone: Joi.string().allow('', null),
      departmentId: Joi.string().uuid().allow(null),
      managerId: Joi.string().uuid().allow(null)
    }),
    
    update: Joi.object({
      email: Joi.string().email(),
      password: Joi.string().min(8),
      firstName: Joi.string(),
      lastName: Joi.string(),
      role: Joi.string().valid('admin', 'manager', 'employee'),
      jobTitle: Joi.string().allow('', null),
      phone: Joi.string().allow('', null),
      departmentId: Joi.string().uuid().allow(null),
      managerId: Joi.string().uuid().allow(null),
      isActive: Joi.boolean()
    }),
    
    id: Joi.object({
      id: Joi.string().uuid().required()
    })
  },
  
  // Department validation schemas
  department: {
    create: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow('', null),
      parentId: Joi.string().uuid().allow(null),
      managerId: Joi.string().uuid().allow(null)
    }),
    
    update: Joi.object({
      name: Joi.string(),
      description: Joi.string().allow('', null),
      parentId: Joi.string().uuid().allow(null),
      managerId: Joi.string().uuid().allow(null)
    }),
    
    id: Joi.object({
      id: Joi.string().uuid().required()
    })
  },
  
  // Document validation schemas
  document: {
    create: Joi.object({
      title: Joi.string().required(),
      description: Joi.string().allow('', null),
      departmentId: Joi.string().uuid().allow(null),
      isPublic: Joi.boolean().default(false)
    }),
    
    update: Joi.object({
      title: Joi.string(),
      description: Joi.string().allow('', null),
      departmentId: Joi.string().uuid().allow(null),
      isPublic: Joi.boolean()
    }),
    
    id: Joi.object({
      id: Joi.string().uuid().required()
    })
  },
  
  // Wiki page validation schemas
  wikiPage: {
    create: Joi.object({
      title: Joi.string().required(),
      content: Joi.string().required(),
      departmentId: Joi.string().uuid().allow(null),
      isPublic: Joi.boolean().default(false),
      parentId: Joi.string().uuid().allow(null)
    }),
    
    update: Joi.object({
      title: Joi.string(),
      content: Joi.string(),
      departmentId: Joi.string().uuid().allow(null),
      isPublic: Joi.boolean(),
      parentId: Joi.string().uuid().allow(null)
    }),
    
    id: Joi.object({
      id: Joi.string().uuid().required()
    })
  },
  
  // Event validation schemas
  event: {
    create: Joi.object({
      title: Joi.string().required(),
      description: Joi.string().allow('', null),
      startTime: Joi.date().iso().required(),
      endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
      allDay: Joi.boolean().default(false),
      location: Joi.string().allow('', null),
      departmentId: Joi.string().uuid().allow(null),
      isCompanyWide: Joi.boolean().default(false),
      attendees: Joi.array().items(Joi.string().uuid())
    }),
    
    update: Joi.object({
      title: Joi.string(),
      description: Joi.string().allow('', null),
      startTime: Joi.date().iso(),
      endTime: Joi.date().iso().greater(Joi.ref('startTime')),
      allDay: Joi.boolean(),
      location: Joi.string().allow('', null),
      departmentId: Joi.string().uuid().allow(null),
      isCompanyWide: Joi.boolean(),
      attendees: Joi.array().items(Joi.string().uuid())
    }),
    
    attendance: Joi.object({
      status: Joi.string().valid('accepted', 'declined', 'tentative', 'pending').required()
    }),
    
    id: Joi.object({
      id: Joi.string().uuid().required()
    })
  },
  
  // Expense validation schemas
  expense: {
    create: Joi.object({
      amount: Joi.number().positive().required(),
      currency: Joi.string().length(3).default('USD'),
      date: Joi.date().iso().required(),
      description: Joi.string().required(),
      category: Joi.string().required()
    }),
    
    update: Joi.object({
      amount: Joi.number().positive(),
      currency: Joi.string().length(3),
      date: Joi.date().iso(),
      description: Joi.string(),
      category: Joi.string()
    }),
    
    review: Joi.object({
      action: Joi.string().valid('approve', 'reject').required(),
      comments: Joi.string().allow('', null)
    }),
    
    payment: Joi.object({
      paymentDetails: Joi.string().allow('', null)
    }),
    
    id: Joi.object({
      id: Joi.string().uuid().required()
    })
  },
  
  // Authentication validation schemas
  auth: {
    login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
      rememberMe: Joi.boolean()
    }),
    
    resetRequest: Joi.object({
      email: Joi.string().email().required()
    }),
    
    resetPassword: Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(8).required()
    }),
    
    updatePassword: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).required()
    })
  },
  
  // Pagination and filtering schemas
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),
  
  search: Joi.object({
    q: Joi.string().min(2).required(),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

/**
 * Validate request against schema
 * @param {Object} schema - Joi schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errorMessages
        });
      }
      
      // Replace request data with validated data
      req[source] = value;
      next();
    } catch (err) {
      logger.error('Validation error:', err);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during validation'
      });
    }
  };
};

module.exports = {
  schemas,
  validate
};