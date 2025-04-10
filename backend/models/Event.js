const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class Event {
  /**
   * Create a new event
   * @param {Object} eventData - Event details
   * @param {Object} client - Optional DB client for transactions
   * @returns {Promise<Object>} Created event
   */
  static async create(eventData, client = db) {
    try {
      // Generate UUID if not provided
      const eventId = eventData.id || uuidv4();
      
      // Insert event record
      const query = `
        INSERT INTO events (
          id, title, description, start_time, end_time, all_day,
          location, created_by, department_id, is_company_wide
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, title, description, start_time, end_time, all_day,
          location, created_by, department_id, is_company_wide, created_at
      `;
      
      const values = [
        eventId,
        eventData.title,
        eventData.description || null,
        eventData.startTime,
        eventData.endTime,
        eventData.allDay || false,
        eventData.location || null,
        eventData.createdBy,
        eventData.departmentId || null,
        eventData.isCompanyWide || false
      ];
      
      const result = await client.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating event:', error);
      throw error;
    }
  }
  
  /**
   * Find event by ID
   * @param {string} id - Event ID
   * @returns {Promise<Object>} Event object
   */
  static async findById(id) {
    try {
      const query = `
        SELECT e.id, e.title, e.description, e.start_time, e.end_time, 
          e.all_day, e.location, e.created_by, e.department_id, 
          e.is_company_wide, e.created_at, e.updated_at,
          d.name AS department_name,
          CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
        FROM events e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error finding event by ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Update event
   * @param {string} id - Event ID
   * @param {Object} eventData - Updated event data
   * @param {Object} client - Optional DB client for transactions
   * @returns {Promise<Object>} Updated event
   */
  static async update(id, eventData, client = db) {
    try {
      // Build update query dynamically based on provided fields
      const allowedFields = [
        'title', 'description', 'start_time', 'end_time', 'all_day',
        'location', 'department_id', 'is_company_wide'
      ];
      
      const setClause = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(eventData)) {
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
        return await Event.findById(id);
      }
      
      // Add event ID as the last parameter
      values.push(id);
      
      const query = `
        UPDATE events
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, title, description, start_time, end_time, all_day,
          location, created_by, department_id, is_company_wide, created_at, updated_at
      `;
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Event not found');
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error updating event ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete event
   * @param {string} id - Event ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    try {
      // First delete all attendees
      await db.query(
        'DELETE FROM event_attendees WHERE event_id = $1',
        [id]
      );
      
      // Then delete the event
      const result = await db.query(
        'DELETE FROM events WHERE id = $1',
        [id]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting event ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Find events with filtering
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Events list
   */
  static async findAll({ 
    startDate, 
    endDate, 
    departmentId, 
    companyWide,
    userId,
    userDepartmentId
  } = {}) {
    try {
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      // Date range filter
      if (startDate) {
        conditions.push(`e.end_time >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }
      
      if (endDate) {
        conditions.push(`e.start_time <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }
      
      // Department filter
      if (departmentId) {
        conditions.push(`e.department_id = $${paramIndex}`);
        params.push(departmentId);
        paramIndex++;
      }
      
      // Company-wide filter
      if (companyWide) {
        conditions.push(`e.is_company_wide = true`);
      }
      
      // User-specific filter (events they created or are attending)
      if (userId) {
        conditions.push(`(
          e.created_by = $${paramIndex} OR 
          EXISTS (
            SELECT 1 FROM event_attendees ea 
            WHERE ea.event_id = e.id AND ea.user_id = $${paramIndex}
          )
        )`);
        params.push(userId);
        paramIndex++;
      }
      
      // Access control for non-admin users
      if (userDepartmentId) {
        conditions.push(`(
          e.is_company_wide = true OR 
          e.department_id IS NULL OR
          e.department_id = $${paramIndex}
        )`);
        params.push(userDepartmentId);
        paramIndex++;
      }
      
      // Build WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      const query = `
        SELECT e.id, e.title, e.description, e.start_time, e.end_time, 
          e.all_day, e.location, e.created_by, e.department_id, 
          e.is_company_wide, e.created_at,
          d.name AS department_name,
          CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
          (
            SELECT COUNT(*) FROM event_attendees ea 
            WHERE ea.event_id = e.id
          ) AS attendee_count
        FROM events e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN users u ON e.created_by = u.id
        ${whereClause}
        ORDER BY e.start_time ASC
      `;
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error finding events:', error);
      throw error;
    }
  }
  
  /**
   * Add attendees to an event
   * @param {string} eventId - Event ID
   * @param {Array} attendeeIds - Array of user IDs
   * @param {Object} client - Optional DB client for transactions
   * @returns {Promise<boolean>} Success status
   */
  static async addAttendees(eventId, attendeeIds, client = db) {
    try {
      // Convert array to values for bulk insert
      const values = attendeeIds.map(userId => 
        `('${eventId}', '${userId}', 'pending')`
      ).join(', ');
      
      if (!values) {
        return true; // No attendees to add
      }
      
      const query = `
        INSERT INTO event_attendees (event_id, user_id, status)
        VALUES ${values}
        ON CONFLICT (event_id, user_id) DO NOTHING
      `;
      
      await client.query(query);
      return true;
    } catch (error) {
      logger.error(`Error adding attendees to event ${eventId}:`, error);
      throw error;
    }
  }
  
  /**
   * Remove all attendees from an event
   * @param {string} eventId - Event ID
   * @param {Object} client - Optional DB client for transactions
   * @returns {Promise<boolean>} Success status
   */
  static async removeAllAttendees(eventId, client = db) {
    try {
      const query = `
        DELETE FROM event_attendees
        WHERE event_id = $1
      `;
      
      await client.query(query, [eventId]);
      return true;
    } catch (error) {
      logger.error(`Error removing attendees from event ${eventId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get attendees for an event
   * @param {string} eventId - Event ID
   * @returns {Promise<Array>} Attendees list
   */
  static async getAttendees(eventId) {
    try {
      const query = `
        SELECT ea.user_id, ea.status, 
          u.email, u.first_name, u.last_name, u.profile_image,
          u.job_title, u.department_id,
          d.name AS department_name
        FROM event_attendees ea
        JOIN users u ON ea.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE ea.event_id = $1
        ORDER BY u.last_name, u.first_name
      `;
      
      const result = await db.query(query, [eventId]);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting attendees for event ${eventId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update attendee status
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @param {string} status - Attendance status
   * @returns {Promise<boolean>} Success status
   */
  static async updateAttendeeStatus(eventId, userId, status) {
    try {
      const query = `
        UPDATE event_attendees
        SET status = $1
        WHERE event_id = $2 AND user_id = $3
        RETURNING *
      `;
      
      const result = await db.query(query, [status, eventId, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('Attendee not found');
      }
      
      return true;
    } catch (error) {
      logger.error(`Error updating attendee status for event ${eventId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get upcoming events for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of events to return
   * @returns {Promise<Array>} Upcoming events
   */
  static async getUpcomingEvents(userId, limit = 5) {
    try {
      // Get user's department for departmental events
      const userResult = await db.query(
        'SELECT department_id FROM users WHERE id = $1',
        [userId]
      );
      
      const userDepartmentId = userResult.rows[0]?.department_id;
      
      const query = `
        SELECT e.id, e.title, e.start_time, e.end_time, e.all_day, 
          e.location, e.is_company_wide,
          d.name AS department_name,
          (
            SELECT status FROM event_attendees ea 
            WHERE ea.event_id = e.id AND ea.user_id = $1
          ) AS attendance_status
        FROM events e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE 
          e.start_time >= NOW() AND
          (
            e.is_company_wide = true OR
            e.department_id = $2 OR
            e.created_by = $1 OR
            EXISTS (
              SELECT 1 FROM event_attendees ea 
              WHERE ea.event_id = e.id AND ea.user_id = $1
            )
          )
        ORDER BY e.start_time ASC
        LIMIT $3
      `;
      
      const result = await db.query(query, [userId, userDepartmentId, limit]);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting upcoming events for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = Event;