const Event = require('../models/Event');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Get events with filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEvents = async (req, res) => {
  try {
    const { 
      start, 
      end, 
      departmentId,
      companyWide,
      userId
    } = req.query;
    
    // Validate date range if provided
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
      }
    }
    
    // Build filter options
    const options = {
      startDate: start ? new Date(start) : undefined,
      endDate: end ? new Date(end) : undefined,
      departmentId: departmentId || undefined,
      companyWide: companyWide === 'true',
      userId: userId || undefined
    };
    
    // Get user's department for access control
    if (req.auth.role !== 'admin') {
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      // Add user's department ID for filtering
      options.userDepartmentId = userResult.rows[0]?.department_id;
    }
    
    const events = await Event.findAll(options);
    
    return res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Error getting events:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching events'
    });
  }
};

/**
 * Get event by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if user has access to this event
    if (req.auth.role !== 'admin') {
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      const canAccess = event.is_company_wide || 
                        event.department_id === userDepartmentId ||
                        event.created_by === req.auth.userId;
      
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this event'
        });
      }
    }
    
    // Get event attendees
    const attendees = await Event.getAttendees(id);
    
    return res.status(200).json({
      success: true,
      data: {
        ...event,
        attendees
      }
    });
  } catch (error) {
    logger.error(`Error getting event ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching event'
    });
  }
};

/**
 * Create new event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createEvent = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      startTime, 
      endTime,
      allDay,
      location,
      departmentId,
      isCompanyWide,
      attendees
    } = req.body;
    
    // Validate required fields
    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Title, start time, and end time are required'
      });
    }
    
    // Validate dates
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start time must be before end time'
      });
    }
    
    // Only allow departmentId if user belongs to that department or is admin
    if (departmentId && req.auth.role !== 'admin') {
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [req.auth.userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      if (departmentId !== userDepartmentId) {
        return res.status(403).json({
          success: false,
          message: 'You can only create events for your own department'
        });
      }
    }
    
    // Only admins and managers can create company-wide events
    if (isCompanyWide && !['admin', 'manager'].includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and managers can create company-wide events'
      });
    }
    
    // Create event
    const eventData = {
      title,
      description,
      startTime: startDate,
      endTime: endDate,
      allDay: allDay === true,
      location,
      departmentId: departmentId || null,
      isCompanyWide: isCompanyWide === true,
      createdBy: req.auth.userId
    };
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create event
      const event = await Event.create(eventData, client);
      
      // Add attendees if provided
      if (attendees && Array.isArray(attendees) && attendees.length > 0) {
        await Event.addAttendees(event.id, attendees, client);
      }
      
      await client.query('COMMIT');
      
      // Get created event with attendees
      const createdEvent = await Event.findById(event.id);
      const eventAttendees = await Event.getAttendees(event.id);
      
      return res.status(201).json({
        success: true,
        data: {
          ...createdEvent,
          attendees: eventAttendees
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error creating event:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating event'
    });
  }
};

/**
 * Update event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      startTime, 
      endTime,
      allDay,
      location,
      departmentId,
      isCompanyWide,
      attendees
    } = req.body;
    
    // Check if event exists
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if user has permission to update this event
    const isOwner = event.created_by === req.auth.userId;
    const isAdmin = req.auth.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this event'
      });
    }
    
    // Validate dates if provided
    let startDate, endDate;
    
    if (startTime) {
      startDate = new Date(startTime);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid start time format'
        });
      }
    }
    
    if (endTime) {
      endDate = new Date(endTime);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end time format'
        });
      }
    }
    
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start time must be before end time'
      });
    }
    
    // Only allow departmentId change if user is admin
    if (departmentId && departmentId !== event.department_id && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change event department'
      });
    }
    
    // Only admins and managers can create company-wide events
    if (isCompanyWide && !event.is_company_wide && 
        !['admin', 'manager'].includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and managers can create company-wide events'
      });
    }
    
    // Update event
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startTime) updateData.startTime = startDate;
    if (endTime) updateData.endTime = endDate;
    if (allDay !== undefined) updateData.allDay = allDay;
    if (location !== undefined) updateData.location = location;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (isCompanyWide !== undefined) updateData.isCompanyWide = isCompanyWide;
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update event
      const updatedEvent = await Event.update(id, updateData, client);
      
      // Update attendees if provided
      if (attendees && Array.isArray(attendees)) {
        // Remove existing attendees
        await Event.removeAllAttendees(id, client);
        
        // Add new attendees
        if (attendees.length > 0) {
          await Event.addAttendees(id, attendees, client);
        }
      }
      
      await client.query('COMMIT');
      
      // Get updated event with attendees
      const resultEvent = await Event.findById(id);
      const eventAttendees = await Event.getAttendees(id);
      
      return res.status(200).json({
        success: true,
        data: {
          ...resultEvent,
          attendees: eventAttendees
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`Error updating event ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating event'
    });
  }
};

/**
 * Delete event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if event exists
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if user has permission to delete this event
    const isOwner = event.created_by === req.auth.userId;
    const isAdmin = req.auth.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this event'
      });
    }
    
    // Delete event
    await Event.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting event ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting event'
    });
  }
};

/**
 * Update event attendance status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['accepted', 'declined', 'tentative', 'pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: accepted, declined, tentative, pending'
      });
    }
    
    // Check if event exists
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if user is an attendee
    const attendees = await Event.getAttendees(id);
    const isAttendee = attendees.some(a => a.user_id === req.auth.userId);
    
    if (!isAttendee) {
      return res.status(403).json({
        success: false,
        message: 'You are not an attendee of this event'
      });
    }
    
    // Update attendance status
    await Event.updateAttendeeStatus(id, req.auth.userId, status);
    
    return res.status(200).json({
      success: true,
      message: 'Attendance status updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating attendance for event ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating attendance'
    });
  }
};

/**
 * Get user's upcoming events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const events = await Event.getUpcomingEvents(req.auth.userId, parseInt(limit, 10));
    
    return res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Error getting upcoming events:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching upcoming events'
    });
  }
};