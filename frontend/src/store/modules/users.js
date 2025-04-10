import api from '../../services/api';

const state = {
  users: [],
  currentUser: null,
  directReports: [],
  orgChart: [],
  pagination: {
    total: 0,
    per_page: 20,
    current_page: 1,
    last_page: 1
  },
  filters: {
    searchTerm: '',
    departmentId: null,
    role: '',
    isActive: null
  },
  isLoading: false,
  error: null
};

const mutations = {
  setUsers(state, { data, pagination }) {
    state.users = data;
    state.pagination = pagination;
  },
  
  setCurrentUser(state, user) {
    state.currentUser = user;
  },
  
  setDirectReports(state, users) {
    state.directReports = users;
  },
  
  setOrgChart(state, orgData) {
    state.orgChart = orgData;
  },
  
  setFilter(state, { key, value }) {
    state.filters[key] = value;
  },
  
  resetFilters(state) {
    state.filters = {
      searchTerm: '',
      departmentId: null,
      role: '',
      isActive: null
    };
  },
  
  setLoading(state, isLoading) {
    state.isLoading = isLoading;
  },
  
  setError(state, error) {
    state.error = error;
  },
  
  addUser(state, user) {
    state.users.unshift(user);
  },
  
  updateUser(state, updatedUser) {
    const index = state.users.findIndex(user => user.id === updatedUser.id);
    
    if (index !== -1) {
      state.users.splice(index, 1, updatedUser);
    }
    
    if (state.currentUser && state.currentUser.id === updatedUser.id) {
      state.currentUser = updatedUser;
    }
  },
  
  removeUser(state, userId) {
    state.users = state.users.filter(user => user.id !== userId);
    
    if (state.currentUser && state.currentUser.id === userId) {
      state.currentUser = null;
    }
  }
};

const actions = {
  /**
   * Fetch users with pagination and filtering
   * @param {Object} context - Vuex context
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Users data with pagination
   */
  async fetchUsers({ commit, state }, { page = 1, limit = 20 } = {}) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      // Build query parameters
      const params = {
        page,
        limit,
        ...state.filters
      };
      
      const response = await api.get('/users', { params });
      
      commit('setUsers', {
        data: response.data.data,
        pagination: response.data.pagination
      });
      
      return {
        data: response.data.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      commit('setError', 'Failed to load users');
      return {
        data: [],
        pagination: state.pagination
      };
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch user by ID
   * @param {Object} context - Vuex context
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object
   */
  async fetchUser({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.get(`/users/${id}`);
      commit('setCurrentUser', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error);
      commit('setError', 'Failed to load user details');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch direct reports for a user
   * @param {Object} context - Vuex context
   * @param {string} managerId - Manager ID
   * @returns {Promise<Array>} Direct reports
   */
  async fetchDirectReports({ commit }, managerId) {
    try {
      commit('setLoading', true);
      
      const response = await api.get(`/users/${managerId}/direct-reports`);
      commit('setDirectReports', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching direct reports for ${managerId}:`, error);
      return [];
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch organization chart data
   * @param {Object} context - Vuex context
   * @returns {Promise<Array>} Org chart data
   */
  async fetchOrgChart({ commit }) {
    try {
      commit('setLoading', true);
      
      const response = await api.get('/users/org-chart');
      commit('setOrgChart', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching org chart:', error);
      return [];
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Create new user
   * @param {Object} context - Vuex context
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  async createUser({ commit }, userData) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.post('/users', userData);
      commit('addUser', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error creating user:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to create user';
      commit('setError', errorMessage);
      
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Update user
   * @param {Object} context - Vuex context
   * @param {Object} userData - User data with ID
   * @returns {Promise<Object>} Updated user
   */
  async updateUser({ commit }, { id, ...userData }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.put(`/users/${id}`, userData);
      commit('updateUser', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      
      const errorMessage = error.response?.data?.message || 'Failed to update user';
      commit('setError', errorMessage);
      
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Delete user
   * @param {Object} context - Vuex context
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      await api.delete(`/users/${id}`);
      commit('removeUser', id);
      
      return true;
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error);
      
      const errorMessage = error.response?.data?.message || 'Failed to delete user';
      commit('setError', errorMessage);
      
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Upload profile image
   * @param {Object} context - Vuex context
   * @param {Object} data - Upload data
   * @returns {Promise<Object>} Updated user
   */
  async uploadProfileImage({ commit }, { id, imageFile }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await api.post(`/users/${id}/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      commit('updateUser', response.data.data);
      
      // If this is the current user, also update in auth store
      const authUser = JSON.parse(localStorage.getItem('user') || 'null');
      if (authUser && authUser.id === id) {
        commit('auth/setUser', {
          ...authUser,
          profileImage: response.data.data.profileImage
        }, { root: true });
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`Error uploading profile image for user ${id}:`, error);
      
      const errorMessage = error.response?.data?.message || 'Failed to upload profile image';
      commit('setError', errorMessage);
      
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Set filter value
   * @param {Object} context - Vuex context
   * @param {Object} filter - Filter data
   */
  setFilter({ commit }, { key, value }) {
    commit('setFilter', { key, value });
  },
  
  /**
   * Reset all filters
   * @param {Object} context - Vuex context
   */
  resetFilters({ commit }) {
    commit('resetFilters');
  }
};

const getters = {
  /**
   * Get user by ID
   * @param {Object} state - Module state
   * @returns {Function} Getter function
   */
  getUserById: state => id => {
    return state.users.find(user => user.id === id);
  },
  
  /**
   * Get users grouped by department
   * @param {Object} state - Module state
   * @returns {Object} Grouped users
   */
  usersByDepartment: state => {
    const groups = {};
    
    state.users.forEach(user => {
      const deptId = user.department_id || 'unassigned';
      const deptName = user.department_name || 'Unassigned';
      
      if (!groups[deptId]) {
        groups[deptId] = {
          id: deptId,
          name: deptName,
          users: []
        };
      }
      
      groups[deptId].users.push(user);
    });
    
    return Object.values(groups);
  },
  
  /**
   * Get users grouped by role
   * @param {Object} state - Module state
   * @returns {Object} Grouped users
   */
  usersByRole: state => {
    const groups = {
      admin: {
        name: 'Administrators',
        users: []
      },
      manager: {
        name: 'Managers',
        users: []
      },
      employee: {
        name: 'Employees',
        users: []
      }
    };
    
    state.users.forEach(user => {
      if (groups[user.role]) {
        groups[user.role].users.push(user);
      }
    });
    
    return groups;
  },
  
  /**
   * Check if users are loading
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

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};