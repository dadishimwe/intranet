import { createStore } from 'vuex';
import { useToast } from 'primevue/usetoast';

// Import modules
import auth from './modules/auth';
import users from './modules/users';
import calendar from './modules/calendar';
import knowledge from './modules/knowledge';
import expenses from './modules/expenses';
import departments from './modules/departments';

// Create store
const store = createStore({
  state: {
    loading: false,
    systemInfo: {
      version: '1.0.0',
      serverTime: null,
      memoryUsage: null,
      diskSpace: null
    },
    sidebarVisible: false,
    toastMessages: [],
    darkMode: localStorage.getItem('darkMode') === 'true'
  },
  
  mutations: {
    setLoading(state, isLoading) {
      state.loading = isLoading;
    },
    
    setSystemInfo(state, info) {
      state.systemInfo = { ...state.systemInfo, ...info };
    },
    
    setSidebarVisible(state, isVisible) {
      state.sidebarVisible = isVisible;
    },
    
    addToastMessage(state, message) {
      state.toastMessages.push(message);
    },
    
    removeToastMessage(state, id) {
      state.toastMessages = state.toastMessages.filter(msg => msg.id !== id);
    },
    
    toggleDarkMode(state) {
      state.darkMode = !state.darkMode;
      localStorage.setItem('darkMode', state.darkMode);
      
      // Apply dark mode to document
      if (state.darkMode) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    }
  },
  
  actions: {
    /**
     * Show toast notification
     * @param {Object} context - Vuex context
     * @param {Object} options - Toast options
     */
    showToast({ commit }, { message, type = 'info', title = null, life = 3000 }) {
      // Generate a unique ID for this toast
      const id = Date.now().toString();
      
      // Create toast message
      const toast = {
        id,
        severity: type,
        summary: title || type.charAt(0).toUpperCase() + type.slice(1),
        detail: message,
        life
      };
      
      // Add to state (for potential custom handling)
      commit('addToastMessage', toast);
      
      // Show using PrimeVue toast service
      const toastService = useToast();
      toastService.add(toast);
      
      // Remove from state after expiry
      setTimeout(() => {
        commit('removeToastMessage', id);
      }, life + 500);
    },
    
    /**
     * Fetch system information
     * @param {Object} context - Vuex context
     * @returns {Promise<Object>} System info
     */
    async fetchSystemInfo({ commit }) {
      try {
        commit('setLoading', true);
        
        // This would be a real API call in production
        // Mocked for this implementation
        const info = {
          version: '1.0.0',
          serverTime: new Date().toISOString(),
          memoryUsage: {
            total: 1024,
            used: 512,
            free: 512
          },
          diskSpace: {
            total: 32768,
            used: 8192,
            free: 24576
          }
        };
        
        commit('setSystemInfo', info);
        return info;
      } catch (error) {
        console.error('Error fetching system info:', error);
        return null;
      } finally {
        commit('setLoading', false);
      }
    },
    
    /**
     * Toggle sidebar visibility
     * @param {Object} context - Vuex context
     * @param {boolean} isVisible - Visibility state
     */
    toggleSidebar({ commit }, isVisible) {
      commit('setSidebarVisible', isVisible);
    },
    
    /**
     * Toggle dark mode
     * @param {Object} context - Vuex context
     */
    toggleDarkMode({ commit }) {
      commit('toggleDarkMode');
    }
  },
  
  getters: {
    /**
     * Check if application is loading
     * @param {Object} state - Vuex state
     * @returns {boolean} Loading state
     */
    isLoading: state => state.loading,
    
    /**
     * Get system information
     * @param {Object} state - Vuex state
     * @returns {Object} System info
     */
    systemInfo: state => state.systemInfo,
    
    /**
     * Check if sidebar is visible
     * @param {Object} state - Vuex state
     * @returns {boolean} Sidebar visibility
     */
    isSidebarVisible: state => state.sidebarVisible,
    
    /**
     * Check if dark mode is enabled
     * @param {Object} state - Vuex state
     * @returns {boolean} Dark mode state
     */
    isDarkMode: state => state.darkMode
  },
  
  modules: {
    auth,
    users,
    calendar,
    knowledge,
    expenses,
    departments
  }
});

// Initialize dark mode on application start
if (store.state.darkMode) {
  document.documentElement.classList.add('dark-mode');
}

export default store;