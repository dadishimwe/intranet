import api from '../../services/api';

const state = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  loginError: null,
  passwordResetSent: false,
  tokenRefreshTimer: null
};

const mutations = {
  setUser(state, user) {
    state.user = user;
    localStorage.setItem('user', JSON.stringify(user));
  },
  
  setToken(state, token) {
    state.token = token;
    localStorage.setItem('token', token);
    state.isAuthenticated = true;
    
    // Set the token for API requests
    api.setAuthHeader(token);
  },
  
  setLoginError(state, error) {
    state.loginError = error;
  },
  
  logout(state) {
    state.user = null;
    state.token = null;
    state.isAuthenticated = false;
    
    // Clear local storage
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Clear API auth header
    api.removeAuthHeader();
    
    // Clear token refresh timer
    if (state.tokenRefreshTimer) {
      clearTimeout(state.tokenRefreshTimer);
      state.tokenRefreshTimer = null;
    }
  },
  
  setPasswordResetSent(state, value) {
    state.passwordResetSent = value;
  },
  
  setTokenRefreshTimer(state, timer) {
    if (state.tokenRefreshTimer) {
      clearTimeout(state.tokenRefreshTimer);
    }
    
    state.tokenRefreshTimer = timer;
  }
};

const actions = {
  /**
   * Login user
   * @param {Object} context - Vuex context
   * @param {Object} credentials - Login credentials
   * @returns {Promise<Object>} Login result
   */
  async login({ commit, dispatch }, { email, password }) {
    try {
      commit('setLoginError', null);
      commit('setLoading', true, { root: true });
      
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data.data;
      
      commit('setToken', token);
      commit('setUser', user);
      
      // Set up token refresh
      dispatch('setupTokenRefresh');
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      commit('setLoginError', errorMessage);
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      commit('setLoading', false, { root: true });
    }
  },
  
  /**
   * Logout user
   * @param {Object} context - Vuex context
   * @returns {Promise<void>}
   */
  async logout({ commit, state }) {
    try {
      commit('setLoading', true, { root: true });
      
      // Only attempt server logout if we have a token
      if (state.token) {
        await api.post('/auth/logout').catch(() => {
          // Ignore errors during logout, proceed anyway
        });
      }
    } finally {
      commit('logout');
      commit('setLoading', false, { root: true });
    }
  },
  
  /**
   * Request password reset
   * @param {Object} context - Vuex context
   * @param {string} email - User email
   * @returns {Promise<Object>} Request result
   */
  async requestPasswordReset({ commit }, email) {
    try {
      commit('setLoading', true, { root: true });
      
      await api.post('/auth/request-password-reset', { email });
      commit('setPasswordResetSent', true);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to request password reset';
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      commit('setLoading', false, { root: true });
    }
  },
  
  /**
   * Reset password with token
   * @param {Object} context - Vuex context
   * @param {Object} data - Reset data
   * @returns {Promise<Object>} Reset result
   */
  async resetPassword({ commit }, { token, newPassword }) {
    try {
      commit('setLoading', true, { root: true });
      
      await api.post('/auth/reset-password', { token, newPassword });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to reset password';
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      commit('setLoading', false, { root: true });
    }
  },
  
  /**
   * Update user password
   * @param {Object} context - Vuex context
   * @param {Object} data - Password data
   * @returns {Promise<Object>} Update result
   */
  async updatePassword({ commit }, { currentPassword, newPassword }) {
    try {
      commit('setLoading', true, { root: true });
      
      await api.post('/auth/update-password', { currentPassword, newPassword });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to update password';
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      commit('setLoading', false, { root: true });
    }
  },
  
  /**
   * Get user profile
   * @param {Object} context - Vuex context
   * @returns {Promise<Object>} Profile data
   */
  async getProfile({ commit }) {
    try {
      commit('setLoading', true, { root: true });
      
      const response = await api.get('/auth/profile');
      commit('setUser', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    } finally {
      commit('setLoading', false, { root: true });
    }
  },
  
  /**
   * Refresh auth token
   * @param {Object} context - Vuex context
   * @returns {Promise<boolean>} Success status
   */
  async refreshToken({ commit, dispatch }) {
    try {
      const response = await api.post('/auth/refresh-token');
      const { token } = response.data.data;
      
      commit('setToken', token);
      
      // Setup the next refresh
      dispatch('setupTokenRefresh');
      
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      
      // If refresh fails, log the user out
      commit('logout');
      
      return false;
    }
  },
  
  /**
   * Setup automatic token refresh
   * @param {Object} context - Vuex context
   */
  setupTokenRefresh({ commit, dispatch, state }) {
    if (state.tokenRefreshTimer) {
      clearTimeout(state.tokenRefreshTimer);
    }
    
    // Refresh token 1 minute before expiry (assuming 1 hour token)
    const refreshTime = (config.auth.jwtExpiry - 60) * 1000;
    
    const timer = setTimeout(() => {
      if (state.isAuthenticated) {
        dispatch('refreshToken');
      }
    }, refreshTime);
    
    commit('setTokenRefreshTimer', timer);
  }
};

const getters = {
  /**
   * Check if user is authenticated
   * @param {Object} state - Module state
   * @returns {boolean} Authentication status
   */
  isAuthenticated: state => state.isAuthenticated,
  
  /**
   * Get current user
   * @param {Object} state - Module state
   * @returns {Object|null} User object
   */
  currentUser: state => state.user,
  
  /**
   * Get user's full name
   * @param {Object} state - Module state
   * @returns {string} User's full name
   */
  userFullName: state => {
    if (!state.user) return '';
    return `${state.user.firstName} ${state.user.lastName}`;
  },
  
  /**
   * Check if user has a specific role
   * @param {Object} state - Module state
   * @returns {Function} Role checker function
   */
  hasRole: state => role => {
    if (!state.user) return false;
    return state.user.role === role;
  },
  
  /**
   * Check if user is admin
   * @param {Object} state - Module state
   * @returns {boolean} Admin status
   */
  isAdmin: state => {
    if (!state.user) return false;
    return state.user.role === 'admin';
  },
  
  /**
   * Check if user is manager
   * @param {Object} state - Module state
   * @returns {boolean} Manager status
   */
  isManager: state => {
    if (!state.user) return false;
    return state.user.role === 'manager';
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};