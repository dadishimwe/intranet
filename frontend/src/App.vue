<template>
    <div class="app-container">
      <!-- Loading overlay -->
      <div v-if="loading" class="loading-overlay">
        <ProgressSpinner />
      </div>
      
      <!-- Authenticated layout with sidebar and header -->
      <template v-if="isAuthenticated && !isLoginPage">
        <div class="layout-wrapper">
          <!-- Sidebar -->
          <Sidebar :visible="sidebarVisible" @close="sidebarVisible = false" />
          
          <!-- Main content -->
          <div class="layout-main">
            <!-- Header -->
            <Header @toggle-sidebar="sidebarVisible = !sidebarVisible" />
            
            <!-- Page content -->
            <div class="layout-content">
              <router-view />
            </div>
            
            <!-- Footer -->
            <Footer />
          </div>
        </div>
      </template>
      
      <!-- Unauthenticated layout (login page) -->
      <template v-else>
        <router-view />
      </template>
      
      <!-- Toast notifications -->
      <Toast position="top-right" />
      
      <!-- Confirmation dialog -->
      <ConfirmDialog />
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
  import { useStore } from 'vuex';
  import { useRoute } from 'vue-router';
  import Toast from 'primevue/toast';
  import ConfirmDialog from 'primevue/confirmdialog';
  import ProgressSpinner from 'primevue/progressspinner';
  
  // Import layout components
  import Header from './components/layout/Header.vue';
  import Sidebar from './components/layout/Sidebar.vue';
  import Footer from './components/layout/Footer.vue';
  
  export default {
    name: 'App',
    components: {
      Header,
      Sidebar,
      Footer,
      Toast,
      ConfirmDialog,
      ProgressSpinner
    },
    setup() {
      const store = useStore();
      const route = useRoute();
      const sidebarVisible = ref(false);
      
      // Computed properties
      const isAuthenticated = computed(() => store.state.isAuthenticated);
      const loading = computed(() => store.state.loading);
      const isLoginPage = computed(() => route.name === 'Login');
      
      // Token refresh interval
      let refreshTokenInterval = null;
      
      // Setup token refresh interval
      const setupTokenRefresh = () => {
        // Clear existing interval if any
        if (refreshTokenInterval) {
          clearInterval(refreshTokenInterval);
        }
        
        // Set up new interval (every 10 minutes)
        refreshTokenInterval = setInterval(async () => {
          if (isAuthenticated.value) {
            await store.dispatch('refreshToken');
          }
        }, 10 * 60 * 1000); // 10 minutes
      };
      
      // Lifecycle hooks
      onMounted(async () => {
        // If authenticated, refresh user data
        if (isAuthenticated.value) {
          try {
            await store.dispatch('getUserProfile');
            setupTokenRefresh();
          } catch (error) {
            console.error('Failed to load user profile:', error);
          }
        }
        
        // Add window resize handler
        window.addEventListener('resize', onResize);
      });
      
      onBeforeUnmount(() => {
        // Clear interval on component destroy
        if (refreshTokenInterval) {
          clearInterval(refreshTokenInterval);
        }
        
        // Remove resize handler
        window.removeEventListener('resize', onResize);
      });
      
      // Window resize handler
      const onResize = () => {
        // Close sidebar on small screens when resizing
        if (window.innerWidth < 768) {
          sidebarVisible.value = false;
        }
      };
      
      return {
        sidebarVisible,
        isAuthenticated,
        loading,
        isLoginPage
      };
    }
  };
  </script>
  
  <style>
  /* Global styles */
  :root {
    --primary-color: #3B82F6;
    --secondary-color: #64748B;
    --success-color: #22C55E;
    --info-color: #3B82F6;
    --warning-color: #F59E0B;
    --danger-color: #EF4444;
    --surface-ground: #F8FAFC;
    --surface-section: #FFFFFF;
    --surface-card: #FFFFFF;
    --surface-overlay: #FFFFFF;
    --surface-border: #E2E8F0;
    --text-color: #334155;
    --text-color-secondary: #64748B;
    --sidebar-width: 240px;
    --topbar-height: 60px;
  }
  
  /* Reset and base styles */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                 Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
    color: var(--text-color);
    background-color: var(--surface-ground);
    margin: 0;
    padding: 0;
    min-height: 100vh;
    font-size: 14px;
    line-height: 1.5;
  }
  
  /* Layout styles */
  .layout-wrapper {
    display: flex;
    min-height: 100vh;
  }
  
  .layout-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    transition: margin-left 0.3s;
  }
  
  .layout-content {
    flex: 1;
    padding: 1.5rem;
    background-color: var(--surface-ground);
  }
  
  /* Responsive sidebar adjustments */
  @media screen and (min-width: 768px) {
    .layout-main {
      margin-left: var(--sidebar-width);
    }
  }
  
  /* Loading overlay */
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }
  
  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background-color: transparent;
  }
  
  ::-webkit-scrollbar-thumb {
    background-color: var(--secondary-color);
    border-radius: 4px;
  }
  
  /* Card styles */
  .card {
    background: var(--surface-card);
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.1),
                0 1px 1px 0 rgba(0, 0, 0, 0.07),
                0 1px 3px 0 rgba(0, 0, 0, 0.06);
    margin-bottom: 1.5rem;
  }
  
  /* Page title styles */
  .page-title {
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--text-color);
    margin-bottom: 1.5rem;
  }
  
  /* Utility classes */
  .text-center {
    text-align: center;
  }
  
  .mt-2 {
    margin-top: 0.5rem;
  }
  
  .mt-4 {
    margin-top: 1rem;
  }
  
  .mb-2 {
    margin-bottom: 0.5rem;
  }
  
  .mb-4 {
    margin-bottom: 1rem;
  }
  </style>