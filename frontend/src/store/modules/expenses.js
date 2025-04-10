import api from '../../services/api';

const state = {
  expenses: [],
  currentExpense: null,
  pagination: {
    total: 0,
    per_page: 20,
    current_page: 1,
    last_page: 1
  },
  filters: {
    status: '',
    startDate: null,
    endDate: null,
    category: '',
    minAmount: null,
    maxAmount: null,
    userId: null
  },
  sort: 'dateDesc',
  statistics: null,
  categories: ['Travel', 'Meals', 'Office Supplies', 'Training', 'Other'],
  isLoading: false,
  error: null
};

const mutations = {
  setExpenses(state, { data, pagination }) {
    state.expenses = data;
    state.pagination = pagination;
  },
  
  setCurrentExpense(state, expense) {
    state.currentExpense = expense;
  },
  
  setFilter(state, { key, value }) {
    state.filters[key] = value;
  },
  
  resetFilters(state) {
    state.filters = {
      status: '',
      startDate: null,
      endDate: null,
      category: '',
      minAmount: null,
      maxAmount: null,
      userId: null
    };
  },
  
  setSort(state, sort) {
    state.sort = sort;
  },
  
  setStatistics(state, statistics) {
    state.statistics = statistics;
  },
  
  setCategories(state, categories) {
    state.categories = categories;
  },
  
  setLoading(state, isLoading) {
    state.isLoading = isLoading;
  },
  
  setError(state, error) {
    state.error = error;
  },
  
  addExpense(state, expense) {
    state.expenses.unshift(expense);
  },
  
  updateExpense(state, updatedExpense) {
    const index = state.expenses.findIndex(expense => expense.id === updatedExpense.id);
    
    if (index !== -1) {
      state.expenses.splice(index, 1, updatedExpense);
    }
    
    if (state.currentExpense && state.currentExpense.id === updatedExpense.id) {
      state.currentExpense = updatedExpense;
    }
  },
  
  removeExpense(state, expenseId) {
    state.expenses = state.expenses.filter(expense => expense.id !== expenseId);
    
    if (state.currentExpense && state.currentExpense.id === expenseId) {
      state.currentExpense = null;
    }
  }
};

const actions = {
  /**
   * Fetch expenses with pagination and filtering
   * @param {Object} context - Vuex context
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Expenses data with pagination
   */
  async fetchExpenses({ commit, state }, { page = 1, limit = 20 } = {}) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      // Build query parameters
      const params = {
        page,
        limit,
        sort: state.sort,
        ...state.filters
      };
      
      // Convert dates to ISO strings if they exist
      if (params.startDate instanceof Date) {
        params.startDate = params.startDate.toISOString().split('T')[0];
      }
      
      if (params.endDate instanceof Date) {
        params.endDate = params.endDate.toISOString().split('T')[0];
      }
      
      const response = await api.get('/expenses', { params });
      
      commit('setExpenses', {
        data: response.data.data,
        pagination: response.data.pagination
      });
      
      return {
        data: response.data.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      console.error('Error fetching expenses:', error);
      commit('setError', 'Failed to load expenses');
      return {
        data: [],
        pagination: state.pagination
      };
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch expense by ID
   * @param {Object} context - Vuex context
   * @param {string} id - Expense ID
   * @returns {Promise<Object>} Expense object
   */
  async fetchExpense({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.get(`/expenses/${id}`);
      commit('setCurrentExpense', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching expense ${id}:`, error);
      commit('setError', 'Failed to load expense details');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Create new expense
   * @param {Object} context - Vuex context
   * @param {Object} expenseData - Expense data
   * @returns {Promise<Object>} Created expense
   */
  async createExpense({ commit }, expenseData) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add expense data
      for (const [key, value] of Object.entries(expenseData)) {
        if (key === 'receipt') {
          if (value) {
            formData.append('receipt', value);
          }
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      }
      
      const response = await api.post('/expenses', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      commit('addExpense', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error creating expense:', error);
      commit('setError', 'Failed to create expense');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Update expense
   * @param {Object} context - Vuex context
   * @param {Object} expenseData - Expense data with ID
   * @returns {Promise<Object>} Updated expense
   */
  async updateExpense({ commit }, { id, ...expenseData }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add expense data
      for (const [key, value] of Object.entries(expenseData)) {
        if (key === 'receipt') {
          if (value && value instanceof File) {
            formData.append('receipt', value);
          }
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      }
      
      const response = await api.put(`/expenses/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      commit('updateExpense', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error updating expense ${id}:`, error);
      commit('setError', 'Failed to update expense');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Delete expense
   * @param {Object} context - Vuex context
   * @param {string} id - Expense ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteExpense({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      await api.delete(`/expenses/${id}`);
      commit('removeExpense', id);
      
      return true;
    } catch (error) {
      console.error(`Error deleting expense ${id}:`, error);
      commit('setError', 'Failed to delete expense');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Submit expense for approval
   * @param {Object} context - Vuex context
   * @param {string} id - Expense ID
   * @returns {Promise<Object>} Updated expense
   */
  async submitExpense({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.post(`/expenses/${id}/submit`);
      commit('updateExpense', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error submitting expense ${id}:`, error);
      commit('setError', 'Failed to submit expense');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Review expense (approve/reject)
   * @param {Object} context - Vuex context
   * @param {Object} reviewData - Review data
   * @returns {Promise<Object>} Updated expense
   */
  async reviewExpense({ commit }, { id, action, comments }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.post(`/expenses/${id}/review`, {
        action, // 'approve' or 'reject'
        comments
      });
      
      commit('updateExpense', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error reviewing expense ${id}:`, error);
      commit('setError', `Failed to ${action} expense`);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Mark expense as paid
   * @param {Object} context - Vuex context
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Updated expense
   */
  async markAsPaid({ commit }, { id, paymentDetails }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.post(`/expenses/${id}/paid`, {
        paymentDetails
      });
      
      commit('updateExpense', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error marking expense ${id} as paid:`, error);
      commit('setError', 'Failed to mark expense as paid');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch expense statistics
   * @param {Object} context - Vuex context
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Statistics data
   */
  async fetchStatistics({ commit }, { period = 'month', userId = null } = {}) {
    try {
      commit('setLoading', true);
      
      const params = { period };
      if (userId) params.userId = userId;
      
      const response = await api.get('/expenses/statistics', { params });
      commit('setStatistics', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching expense statistics:', error);
      return null;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch expense categories from system settings
   * @param {Object} context - Vuex context
   * @returns {Promise<Array>} Categories list
   */
  async fetchCategories({ commit }) {
    try {
      // This would normally fetch from an API endpoint
      // For this example, we'll use the default categories
      // In a real implementation, you would get this from system settings
      
      const categories = ['Travel', 'Meals', 'Office Supplies', 'Training', 'Other'];
      commit('setCategories', categories);
      
      return categories;
    } catch (error) {
      console.error('Error fetching expense categories:', error);
      return state.categories; // Return default categories as fallback
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
  },
  
  /**
   * Set sort order
   * @param {Object} context - Vuex context
   * @param {string} sort - Sort order
   */
  setSort({ commit }, sort) {
    commit('setSort', sort);
  }
};

const getters = {
  /**
   * Get expenses grouped by status
   * @param {Object} state - Module state
   * @returns {Object} Grouped expenses
   */
  expensesByStatus: state => {
    const groups = {
      draft: [],
      submitted: [],
      approved: [],
      rejected: [],
      paid: []
    };
    
    state.expenses.forEach(expense => {
      if (groups[expense.status]) {
        groups[expense.status].push(expense);
      }
    });
    
    return groups;
  },
  
  /**
   * Get expenses grouped by category
   * @param {Object} state - Module state
   * @returns {Object} Grouped expenses
   */
  expensesByCategory: state => {
    const groups = {};
    
    // Initialize groups for all categories
    state.categories.forEach(category => {
      groups[category] = [];
    });
    
    // Add expenses to groups
    state.expenses.forEach(expense => {
      if (groups[expense.category]) {
        groups[expense.category].push(expense);
      } else {
        // Handle expenses with categories not in the predefined list
        if (!groups['Other']) {
          groups['Other'] = [];
        }
        groups['Other'].push(expense);
      }
    });
    
    return groups;
  },
  
  /**
   * Get total amount of expenses in current list
   * @param {Object} state - Module state
   * @returns {number} Total amount
   */
  totalAmount: state => {
    return state.expenses.reduce((total, expense) => {
      return total + parseFloat(expense.amount);
    }, 0);
  },
  
  /**
   * Get statistics for dashboard charts
   * @param {Object} state - Module state
   * @returns {Object} Processed statistics data
   */
  dashboardStats: state => {
    if (!state.statistics) return null;
    
    // Process statistics for dashboard display
    return {
      totalCount: state.statistics.totals?.total_count || 0,
      totalAmount: state.statistics.totals?.total_amount || 0,
      averageAmount: state.statistics.totals?.average_amount || 0,
      
      // Status breakdown for pie chart
      statusData: state.statistics.byStatus?.map(item => ({
        name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        value: parseFloat(item.total_amount) || 0
      })) || [],
      
      // Category breakdown for bar chart
      categoryData: state.statistics.byCategory?.map(item => ({
        name: item.category,
        value: parseFloat(item.total_amount) || 0
      })) || [],
      
      // Monthly trend for line chart
      trendData: state.statistics.trends?.map(item => ({
        name: item.month,
        value: parseFloat(item.total_amount) || 0,
        count: parseInt(item.count, 10) || 0
      })) || []
    };
  },
  
  /**
   * Check if expenses are loading
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