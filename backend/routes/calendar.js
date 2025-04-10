const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Get events with filtering
router.get('/', calendarController.getEvents);

// Get upcoming events for current user
router.get('/upcoming', calendarController.getUpcomingEvents);

// Get specific event
router.get('/:id', 
  validate(schemas.event.id, 'params'),
  calendarController.getEventById
);

// Create event
router.post('/',
  validate(schemas.event.create),
  calendarController.createEvent
);

// Update event
router.put('/:id',
  validate(schemas.event.id, 'params'),
  validate(schemas.event.update),
  calendarController.updateEvent
);

// Delete event
router.delete('/:id',
  validate(schemas.event.id, 'params'),
  calendarController.deleteEvent
);

// Update attendance status
router.post('/:id/attendance',
  validate(schemas.event.id, 'params'),
  validate(schemas.event.attendance),
  calendarController.updateAttendance
);

module.exports = router;