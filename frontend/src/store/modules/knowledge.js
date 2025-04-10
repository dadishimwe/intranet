import api from '../../services/api';

const state = {
  wikiPages: [],
  currentPage: null,
  wikiTree: [],
  pageRevisions: [],
  currentRevision: null,
  pagination: {
    total: 0,
    per_page: 20,
    current_page: 1,
    last_page: 1
  },
  filters: {
    departmentId: null,
    parentId: null,
    searchTerm: '',
    createdBy: null
  },
  searchResults: [],
  isLoading: false,
  error: null
};

const mutations = {
  setWikiPages(state, { data, pagination }) {
    state.wikiPages = data;
    state.pagination = pagination;
  },
  
  setCurrentPage(state, page) {
    state.currentPage = page;
  },
  
  setWikiTree(state, tree) {
    state.wikiTree = tree;
  },
  
  setPageRevisions(state, revisions) {
    state.pageRevisions = revisions;
  },
  
  setCurrentRevision(state, revision) {
    state.currentRevision = revision;
  },
  
  setFilter(state, { key, value }) {
    state.filters[key] = value;
  },
  
  resetFilters(state) {
    state.filters = {
      departmentId: null,
      parentId: null,
      searchTerm: '',
      createdBy: null
    };
  },
  
  setSearchResults(state, results) {
    state.searchResults = results;
  },
  
  setLoading(state, isLoading) {
    state.isLoading = isLoading;
  },
  
  setError(state, error) {
    state.error = error;
  },
  
  addWikiPage(state, page) {
    state.wikiPages.unshift(page);
  },
  
  updateWikiPage(state, updatedPage) {
    const index = state.wikiPages.findIndex(page => page.id === updatedPage.id);
    
    if (index !== -1) {
      state.wikiPages.splice(index, 1, updatedPage);
    }
    
    if (state.currentPage && state.currentPage.id === updatedPage.id) {
      state.currentPage = updatedPage;
    }
  },
  
  removeWikiPage(state, pageId) {
    state.wikiPages = state.wikiPages.filter(page => page.id !== pageId);
    
    if (state.currentPage && state.currentPage.id === pageId) {
      state.currentPage = null;
    }
  }
};

const actions = {
  /**
   * Fetch wiki pages with pagination and filtering
   * @param {Object} context - Vuex context
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Wiki pages data with pagination
   */
  async fetchWikiPages({ commit, state }, { page = 1, limit = 20 } = {}) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      // Build query parameters
      const params = {
        page,
        limit,
        ...state.filters
      };
      
      const response = await api.get('/knowledge', { params });
      
      commit('setWikiPages', {
        data: response.data.data,
        pagination: response.data.pagination
      });
      
      return {
        data: response.data.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      console.error('Error fetching wiki pages:', error);
      commit('setError', 'Failed to load wiki pages');
      return {
        data: [],
        pagination: state.pagination
      };
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch wiki page by ID
   * @param {Object} context - Vuex context
   * @param {string} id - Wiki page ID
   * @returns {Promise<Object>} Wiki page object
   */
  async fetchWikiPage({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.get(`/knowledge/${id}`);
      commit('setCurrentPage', response.data.data);
      
      // Also set revisions if they're included in the response
      if (response.data.data.revisions) {
        commit('setPageRevisions', response.data.data.revisions);
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching wiki page ${id}:`, error);
      commit('setError', 'Failed to load wiki page');
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch wiki page tree structure
   * @param {Object} context - Vuex context
   * @param {Object} options - Fetch options
   * @returns {Promise<Array>} Wiki page tree
   */
  async fetchWikiTree({ commit }, { departmentId } = {}) {
    try {
      commit('setLoading', true);
      
      const params = {};
      if (departmentId) params.departmentId = departmentId;
      
      const response = await api.get('/knowledge/tree', { params });
      commit('setWikiTree', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching wiki tree:', error);
      return [];
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Fetch wiki page revision
   * @param {Object} context - Vuex context
   * @param {Object} params - Revision parameters
   * @returns {Promise<Object>} Revision object
   */
  async fetchRevision({ commit }, { id, revisionId }) {
    try {
      commit('setLoading', true);
      
      const response = await api.get(`/knowledge/${id}/revisions/${revisionId}`);
      commit('setCurrentRevision', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching revision ${revisionId}:`, error);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Search wiki pages
   * @param {Object} context - Vuex context
   * @param {string} query - Search query
   * @returns {Promise<Array>} Search results
   */
  async searchWikiPages({ commit }, query) {
    try {
      commit('setLoading', true);
      
      if (!query || query.trim().length < 2) {
        commit('setSearchResults', []);
        return [];
      }
      
      const response = await api.get('/knowledge/search', {
        params: { q: query }
      });
      
      commit('setSearchResults', response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Error searching wiki pages:', error);
      commit('setSearchResults', []);
      return [];
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Create new wiki page
   * @param {Object} context - Vuex context
   * @param {Object} pageData - Wiki page data
   * @returns {Promise<Object>} Created wiki page
   */
  async createWikiPage({ commit }, pageData) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.post('/knowledge', pageData);
      commit('addWikiPage', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Error creating wiki page:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to create wiki page';
      commit('setError', errorMessage);
      
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Update wiki page
   * @param {Object} context - Vuex context
   * @param {Object} pageData - Wiki page data with ID
   * @returns {Promise<Object>} Updated wiki page
   */
  async updateWikiPage({ commit }, { id, ...pageData }) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      const response = await api.put(`/knowledge/${id}`, pageData);
      commit('updateWikiPage', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error(`Error updating wiki page ${id}:`, error);
      
      const errorMessage = error.response?.data?.message || 'Failed to update wiki page';
      commit('setError', errorMessage);
      
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  /**
   * Delete wiki page
   * @param {Object} context - Vuex context
   * @param {string} id - Wiki page ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteWikiPage({ commit }, id) {
    try {
      commit('setLoading', true);
      commit('setError', null);
      
      await api.delete(`/knowledge/${id}`);
      commit('removeWikiPage', id);
      
      return true;
    } catch (error) {
      console.error(`Error deleting wiki page ${id}:`, error);
      
      const errorMessage = error.response?.data?.message || 'Failed to delete wiki page';
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
   * Get wiki page by ID
   * @param {Object} state - Module state
   * @returns {Function} Getter function
   */
  getWikiPageById: state => id => {
    return state.wikiPages.find(page => page.id === id);
  },
  
  /**
   * Get wiki pages by parent ID
   * @param {Object} state - Module state
   * @returns {Function} Getter function
   */
  getChildPages: state => parentId => {
    return state.wikiPages.filter(page => page.parent_id === parentId);
  },
  
  /**
   * Flatten wiki tree to array for easier traversal
   * @param {Object} state - Module state
   * @returns {Array} Flattened pages
   */
  flattenedTree: state => {
    const result = [];
    
    function flatten(nodes, level = 0, path = []) {
      if (!nodes) return;
      
      nodes.forEach(node => {
        // Add current node with level info
        result.push({
          ...node,
          level,
          path: [...path, node.title]
        });
        
        // Process children if any
        if (node.children && node.children.length > 0) {
          flatten(node.children, level + 1, [...path, node.title]);
        }
      });
    }
    
    flatten(state.wikiTree);
    return result;
  },
  
  /**
   * Get breadcrumb path for current page
   * @param {Object} state - Module state
   * @returns {Array} Breadcrumb items
   */
  breadcrumbPath: state => {
    if (!state.currentPage) return [];
    
    const path = [];
    let currentId = state.currentPage.parent_id;
    
    // Add current page
    path.unshift({
      id: state.currentPage.id,
      title: state.currentPage.title,
      isActive: true
    });
    
    // Build the rest of the path from the tree
    const flatPages = state.flattenedTree;
    
    while (currentId) {
      const parentPage = flatPages.find(page => page.id === currentId);
      
      if (!parentPage) break;
      
      path.unshift({
        id: parentPage.id,
        title: parentPage.title,
        isActive: false
      });
      
      currentId = parentPage.parent_id;
    }
    
    // Add home link
    path.unshift({
      id: null,
      title: 'Wiki Home',
      isActive: false
    });
    
    return path;
  },
  
  /**
   * Check if wiki is loading
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