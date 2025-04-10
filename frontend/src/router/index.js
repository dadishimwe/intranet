import { createRouter, createWebHistory } from 'vue-router';
import store from '../store';

// Load views
const Home = () => import('../views/Home.vue');
const Login = () => import('../views/Login.vue');
const Users = () => import('../views/Users.vue');
const OrgChart = () => import('../views/OrgChart.vue');
const Calendar = () => import('../views/Calendar.vue');
const Documents = () => import('../views/Documents.vue');
const Wiki = () => import('../views/Wiki.vue');
const Expenses = () => import('../views/Expenses.vue');

// Define routes
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { guest: true }
  },
  {
    path: '/users',
    name: 'Users',
    component: Users,
    meta: { requiresAuth: true }
  },
  {
    path: '/users/:id',
    name: 'UserProfile',
    component: () => import('../views/UserProfile.vue'),
    meta: { requiresAuth: true },
    props: true
  },
  {
    path: '/organization',
    name: 'OrgChart',
    component: OrgChart,
    meta: { requiresAuth: true }
  },
  {
    path: '/calendar',
    name: 'Calendar',
    component: Calendar,
    meta: { requiresAuth: true }
  },
  {
    path: '/documents',
    name: 'Documents',
    component: Documents,
    meta: { requiresAuth: true }
  },
  {
    path: '/documents/:id',
    name: 'DocumentDetail',
    component: () => import('../views/DocumentDetail.vue'),
    meta: { requiresAuth: true },
    props: true
  },
  {
    path: '/wiki',
    name: 'Wiki',
    component: Wiki,
    meta: { requiresAuth: true }
  },
  {
    path: '/wiki/:id',
    name: 'WikiPage',
    component: () => import('../views/WikiPage.vue'),
    meta: { requiresAuth: true },
    props: true
  },
  {
    path: '/expenses',
    name: 'Expenses',
    component: Expenses,
    meta: { requiresAuth: true }
  },
  {
    path: '/expenses/:id',
    name: 'ExpenseDetail',
    component: () => import('../views/ExpenseDetail.vue'),
    meta: { requiresAuth: true },
    props: true
  },
  {
    path: '/account',
    name: 'Account',
    component: () => import('../views/Account.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/departments',
    name: 'Departments',
    component: () => import('../views/Departments.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue')
  }
];

// Create router instance
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

// Navigation guards
router.beforeEach((to, from, next) => {
  // Check if route requires authentication
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!store.getters['auth/isAuthenticated']) {
      // Not authenticated, redirect to login
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
    } else {
      // Check if route requires admin role
      if (to.matched.some(record => record.meta.requiresAdmin) &&
          !store.getters['auth/isAdmin']) {
        // Not admin, redirect to home
        next({ path: '/' });
      } else {
        // Authenticated and authorized, proceed
        next();
      }
    }
  } else if (to.matched.some(record => record.meta.guest)) {
    // Route is for guests only, redirect to home if already authenticated
    if (store.getters['auth/isAuthenticated']) {
      next({ path: '/' });
    } else {
      next();
    }
  } else {
    // Public route, proceed
    next();
  }
});

export default router;