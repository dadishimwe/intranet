import { createApp } from 'vue';
import { createStore } from 'vuex';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';

// Import PrimeVue components and styles
import 'primevue/resources/themes/saga-blue/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';
import '/node_modules/primeflex/primeflex.css';

// Import main app component
import App from './App.vue';

// Import API service
import api from './services/api';

// Import route components
import Login from './views/Login.vue';
import Home from './views/Home.vue';
import NotFound from './views/NotFound.vue';
import Users from './views/Users.vue';
import UserDetails from './views/UserDetails.vue';
import OrgChart from './views/OrgChart.vue';
import Departments from './views/Departments.vue';
import Documents from './views/Documents.vue';
import Calendar from './views/Calendar.vue';
import Wiki from './views/Wiki.vue';
import Expenses from './views/Expenses.vue';
import Unauthorized from './views/Unauthorized.vue';

// Define routes
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'Users',
    component: Users,
    meta: { requiresAuth: true, requiredRoles: ['admin', 'manager'] }
  },
  {
    path: '/users/:id',
    name: 'UserDetails',
    component: UserDetails,
    meta: { requiresAuth: true }
  },
  {
    path: '/organization',
    name: 'OrgChart',
    component: OrgChart,
    meta: { requiresAuth: true }
  },
  {
    path: '/departments',
    name: 'Departments',
    component: Departments,
    meta: { requiresAuth: true }
  },
  {
    path: '/documents',
    name: 'Documents',
    component: Documents,
    meta: { requiresAuth: true }
  },
  {
    path: '/calendar',
    name: 'Calendar',
    component: Calendar,
    meta: { requiresAuth: true }
  },
  {
    path: '/wiki',
    name: 'Wiki',
    component: Wiki,
    meta: { requiresAuth: true }
  },
  {
    path: '/expenses',
    name: 'Expenses',
    component: Expenses,
    meta: { requiresAuth: true }
  },
  {
    path: '/unauthorized',
    name: 'Unauthorized',
    component: Unauthorized,
    meta: { requiresAuth: false }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
    meta: { requiresAuth: false }
  }
];

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes
});

// Router guard for authentication
router.beforeEach((to, from, next) => {
  const auth = localStorage.getItem('token');
  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiredRoles = to.meta.requiredRoles || [];
  
  // Handle authentication check
  if (requiresAuth && !auth) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }
  
  // Handle role-based access
  if (requiresAuth && requiredRoles.length > 0 && !requiredRoles.includes(userData.role)) {
    next({ name: 'Unauthorized' });
    return;
  }
  
  // Prevent authenticated users from accessing login page
  if (to.name === 'Login' && auth) {
    next({ name: 'Home' });
    return;
  }
  
  next();
});

// Create Vuex store
const store = createStore({
  state() {
    return {
      isAuthenticated: !!localStorage.getItem('token'),
      user: JSON.parse(localStorage.getItem('user') || '{}'),
      notifications: [],
      loading: false,
      appTitle: 'Corporate Intranet'
    };
  },
  mutations: {
    setAuthenticated(state, status) {
      state.isAuthenticated = status;
    },
    setUser(state, user) {
      state.user = user;
      localStorage.setItem('user', JSON.stringify(user));
    },
    setToken(state, token) {
      localStorage.setItem('token', token);
      state.isAuthenticated = true;
      api.setAuthHeader(token);
    },
    clearAuth(state) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      state.isAuthenticated = false;
      state.user = {};
      api.removeAuthHeader();
    },
    addNotification(state, notification) {
      state.notifications.push(notification);
    },
    clearNotifications(state) {
      state.notifications = [];
    },
    setLoading(state, status) {
      state.loading = status;
    }
  },
  actions: {
    async login({ commit }, credentials) {
      try {
        commit('setLoading', true);
        const response = await api.post('/auth/login', credentials);
        const { token, user } = response.data.data;
        
        commit('setToken', token);
        commit('setUser', user);
        
        return { success: true };
      } catch (error) {
        commit('clearAuth');
        return { 
          success: false, 
          message: error.response?.data?.message || 'Login failed'
        };
      } finally {
        commit('setLoading', false);
      }
    },
    async logout({ commit }) {
      try {
        commit('setLoading', true);
        await api.post('/auth/logout');
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        commit('clearAuth');
        commit('setLoading', false);
      }
    },
    async refreshToken({ commit, state }) {
      try {
        // Only refresh if authenticated
        if (!state.isAuthenticated) return false;
        
        const response = await api.post('/auth/refresh-token');
        const { token } = response.data.data;
        
        commit('setToken', token);
        return true;
      } catch (error) {
        console.error('Token refresh error:', error);
        commit('clearAuth');
        return false;
      }
    },
    async getUserProfile({ commit }) {
      try {
        commit('setLoading', true);
        const response = await api.get('/auth/profile');
        commit('setUser', response.data.data);
        return response.data.data;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      } finally {
        commit('setLoading', false);
      }
    }
  },
  getters: {
    isAdmin(state) {
      return state.user.role === 'admin';
    },
    isManager(state) {
      return state.user.role === 'manager';
    },
    hasRole: (state) => (roles) => {
      return roles.includes(state.user.role);
    },
    userName(state) {
      return state.user.firstName 
        ? `${state.user.firstName} ${state.user.lastName}`
        : state.user.email;
    }
  }
});

// Initialize API service with auth token
if (localStorage.getItem('token')) {
  api.setAuthHeader(localStorage.getItem('token'));
}

// Create and mount Vue app
const app = createApp(App);

// Use plugins
app.use(router);
app.use(store);
app.use(PrimeVue, { ripple: true });
app.use(ToastService);
app.use(ConfirmationService);

// Global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err);
  console.error('Info:', info);
  
  // Handle authentication errors
  if (err.response && err.response.status === 401) {
    store.commit('clearAuth');
    router.push('/login');
  }
};

// Mount the app
app.mount('#app');