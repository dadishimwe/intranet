import api from '../../services/api';

const state = {
  events: [],
  currentEvent: null,
  upcomingEvents: [],
  calendarView: localStorage.getItem('calendarView') || 'month',
  filterDepartmentId: null,
  filterCompanyWide: true,
  isLoading: false,
  error: null
};

const mutations = {
  setEvents(state, events) {
    state.events = events;
  },
  
  setCurrentEvent(state, event) {
    state.currentEvent = event;
  },
  
  setUpcomingEvents(state, events) {
    state.upcomingEvents = events;
  },
  
  setCalendarView(state, view) {
    state.calendarView = view;
    localStorage.setItem('calendarView', view);
  },
  
  setFilterDepartmentId(state, departmentId) {
    state.filterDepartmentId = departmentId;
  },
  
  setFilterCompanyWide(state, value) {
    state.filterCompanyWide = value;
  },
  
  setLoading(state, isLoading) {
    state.isLoading = isLoading;
  },
  
  setError(state, error) {
    state.error = error;
  },
  
  addEvent(state, event) {
    state.events.push(event);
  },
  
  updateEvent(state, updatedEvent) {
    const index = state.events.findIndex(event => event.id === updatedEvent.id);
    
    if (index !== -1) {
      state.events.splice(index, 1, updatedEvent);
    }
    
    if (state.currentEvent && state.currentEvent.id === updatedEvent.id) {
      state.currentEvent = updatedEvent;
    }
  },
  
  removeEvent(state, eventId) {
    state.events = state.events.filter(event => event.id !== eventId);
    
    if (state.currentEvent && state.currentEvent.id === eventId) {
      state.currentEvent = null;
    }
  },
  
  updateAttendanceStatus(state, { eventId, status }) {
    // Update attendance status in events list
    const event = state.events.find(e => e.id === eventId);
    if (event && event.attendance_status) {
      event.attendance_status = status;
    }
    
    // Update attendance status in current event
    if (state.currentEvent && state.currentEvent.id === eventId) {
      state.currentEvent.attendance_status = status;
      
      // Also update in attendees list if available
      if (state.currentEvent.attendees) {
        const currentUser = this.rootGetters['auth/currentUser'];
        if (currentUser) {
          const attendee = state.currentEvent.attendees.find(
            a => a.user_id === currentUser.id
          );
          
          if (attendee) {
            attendee.status = status;
          }
        }
      }
    }
  }
};

const actions = {
  /**
   * Fetch events for date range
   * @param {Object} context - Vuex context
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Events list
   */
  async fetchEvents({ commit, state }, { start, end } = {}) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const params = { start, end };
      
      if (state.filterDepartmentId) {
        params.departmentId = state.filterDepartmentId;
      }
      
      if (state.filterCompanyWide) {
        params.companyWide = true;
      }
      
      const response = await api.get('/calendar', { params });
      commit('setEvents', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching events:', error);
      commit('setError', 'Failed to load events');
      return [];
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch upcoming events
   * @param {Object} context - Vuex context
   * @param {number} limit - Number of events to fetch
   * @returns {Promise<Array>} Upcoming events
   */
  async fetchUpcomingEvents({ commit }, limit = 5) {
    try {
      commit('setLoading', true);
      
      const response = await api.get('/calendar/upcoming', {
        params: { limit }
      });
      
      commit('setUpcomingEvents', response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      return [];
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch event by ID
   * @param {Object} context - Vuex context
   * @param {string} id - Event ID
   * @returns {Promise<Object>} Event object
   */
  async fetchEvent({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.get(`/calendar/${id}`);
      commit('setCurrentEvent', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching event ${id}:`, error);
      commit('setError', 'Failed to load event details');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Create new event
   * @param {Object} context - Vuex context
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async createEvent({ commit }, eventData) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.post('/calendar', eventData);
      commit('addEvent', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error creating event:', error);
      commit('setError', 'Failed to create event');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Update event
   * @param {Object} context - Vuex context
   * @param {Object} eventData - Event data with ID
   * @returns {Promise<Object>} Updated event
   */
  async updateEvent({ commit }, { id, ...eventData }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.put(`/calendar/${id}`, eventData);
      commit('updateEvent', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error updating event ${id}:`, error);
      commit('setError', 'Failed to update event');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Delete event
   * @param {Object} context - Vuex context
   * @param {string} id - Event ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteEvent({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      await api.delete(`/calendar/${id}`);
      commit('removeEvent', id);
      
      return true;
    } catch (error) {
      console.error(`Error deleting event ${id}:`, error);
      commit('setError', 'Failed to delete event');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Update attendance status
   * @param {Object} context - Vuex context
   * @param {Object} params - Attendance parameters
   * @returns {Promise<boolean>} Success status
   */
  async updateAttendance({ commit }, { id, status }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      await api.post(`/calendar/${id}/attendance`, { status });
      commit('updateAttendanceStatus', { eventId: id, status });
      
      return true;
    } catch (error) {
      console.error(`Error updating attendance for event ${id}:`, error);
      commit('setError', 'Failed to update attendance');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Set calendar view
   * @param {Object} context - Vuex context
   * @param {string} view - Calendar view
   */
  setCalendarView({ commit }, view) {
    commit('setCalendarView', view);
  },
  
  /**
   * Set department filter
   * @param {Object} context - Vuex context
   * @param {string|null} departmentId - Department ID
   */
  setDepartmentFilter({ commit }, departmentId) {
    commit('setFilterDepartmentId', departmentId);
  },
  
  /**
   * Toggle company-wide events filter
   * @param {Object} context - Vuex context
   * @param {boolean} value - Filter value
   */
  setCompanyWideFilter({ commit }, value) {
    commit('setFilterCompanyWide', value);
  }
};

const getters = {
  /**
   * Get formatted events for calendar
   * @param {Object} state - Module state
   * @returns {Array} Formatted events
   */
  calendarEvents: state => {
    return state.events.map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      allDay: event.all_day,
      extendedProps: {
        description: event.description,
        location: event.location,
        departmentId: event.department_id,
        departmentName: event.department_name,
        isCompanyWide: event.is_company_wide,
        attendeeCount: event.attendee_count,
        attendanceStatus: event.attendance_status
      },
      backgroundColor: getEventColor(event),
      borderColor: getEventColor(event)
    }));
  },
  
  /**
   * Get event by ID
   * @param {Object} state - Module state
   * @returns {Function} Getter function
   */
  getEventById: state => id => {
    return state.events.find(event => event.id === id);
  },
  
  /**
   * Check if calendar is loading
   * @param {Object} state - Module state
   * @returns {boolean} Loading status
   */
  isLoading: state => state.isLoading,
  
  /**
   * Get current error
   * @param {Object} state - Module state
   * @returns {string|null} Error message
   */
  error: state => state.error
};

/**
 * Helper function to get event color based on type and status
 * @param {Object} event - Event object
 * @returns {string} Color HEX code
 */
function getEventColor(event) {
  // Company wide events are blue
  if (event.is_company_wide) {
    return '#3B82F6'; // blue
  }
  
  // Department events are green
  if (event.department_id) {
    return '#10B981'; // green
  }
  
  // Personal events based on attendance status
  switch (event.attendance_status) {
    case 'accepted':
      return '#22C55E'; // success green
    case 'tentative':
      return '#F59E0B'; // warning yellow
    case 'declined':
      return '#EF4444'; // error red
    default:
      return '#6B7280'; // neutral gray
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};