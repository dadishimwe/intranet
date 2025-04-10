<template>
    <div>
      <!-- Mobile overlay -->
      <div 
        v-if="visible && isMobile" 
        class="sidebar-overlay"
        @click="onClose"
      ></div>
      
      <!-- Sidebar -->
      <aside 
        class="sidebar" 
        :class="{ 'sidebar-visible': visible, 'sidebar-hidden': !visible }"
      >
        <!-- Company logo and name -->
        <div class="sidebar-header">
          <div class="logo">
            <i class="pi pi-building"></i>
            <span>{{ appTitle }}</span>
          </div>
          <Button 
            v-if="isMobile" 
            icon="pi pi-times" 
            class="p-button-text p-button-rounded sidebar-close" 
            @click="onClose" 
          />
        </div>
        
        <!-- User info -->
        <div class="user-info">
          <Avatar 
            :image="userImage || undefined" 
            :label="userInitials" 
            shape="circle" 
            size="large" 
          />
          <div class="user-details">
            <div class="user-name">{{ userName }}</div>
            <div class="user-role">{{ userRole }}</div>
          </div>
        </div>
        
        <!-- Navigation menu -->
        <nav class="sidebar-menu">
          <ul>
            <li v-for="item in menuItems" :key="item.path">
              <router-link :to="item.path" class="menu-item" v-slot="{ isActive }">
                <div :class="['menu-link', { 'active': isActive }]">
                  <i :class="['menu-icon', item.icon]"></i>
                  <span class="menu-text">{{ item.label }}</span>
                </div>
              </router-link>
            </li>
          </ul>
        </nav>
        
        <!-- Footer actions -->
        <div class="sidebar-footer">
          <Button 
            label="Logout" 
            icon="pi pi-sign-out" 
            class="p-button-text p-button-secondary logout-button" 
            @click="handleLogout" 
          />
        </div>
      </aside>
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
  import { useStore } from 'vuex';
  import { useRouter } from 'vue-router';
  import Button from 'primevue/button';
  import Avatar from 'primevue/avatar';
  
  export default {
    name: 'Sidebar',
    components: {
      Button,
      Avatar
    },
    props: {
      visible: {
        type: Boolean,
        default: false
      }
    },
    emits: ['close'],
    setup(props, { emit }) {
      const store = useStore();
      const router = useRouter();
      const windowWidth = ref(window.innerWidth);
      
      // Computed properties
      const isMobile = computed(() => windowWidth.value < 768);
      const appTitle = computed(() => store.state.appTitle);
      
      const userName = computed(() => {
        const user = store.state.user;
        return user.firstName 
          ? `${user.firstName} ${user.lastName}`
          : user.email;
      });
      
      const userRole = computed(() => {
        const role = store.state.user.role;
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
      });
      
      const userInitials = computed(() => {
        const user = store.state.user;
        if (user.firstName && user.lastName) {
          return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
        }
        return user.email ? user.email.charAt(0).toUpperCase() : '?';
      });
      
      const userImage = computed(() => {
        return store.state.user.profileImage || null;
      });
      
      // Menu items based on user role
      const menuItems = computed(() => {
        const items = [
          { path: '/', label: 'Dashboard', icon: 'pi pi-home' },
          { path: '/organization', label: 'Organization', icon: 'pi pi-sitemap' },
          { path: '/calendar', label: 'Calendar', icon: 'pi pi-calendar' },
          { path: '/documents', label: 'Documents', icon: 'pi pi-file' },
          { path: '/wiki', label: 'Wiki', icon: 'pi pi-book' },
          { path: '/expenses', label: 'Expenses', icon: 'pi pi-money-bill' }
        ];
        
        // Add admin/manager specific items
        if (store.getters.hasRole(['admin', 'manager'])) {
          items.push({ path: '/users', label: 'Users', icon: 'pi pi-users' });
          items.push({ path: '/departments', label: 'Departments', icon: 'pi pi-briefcase' });
        }
        
        return items;
      });
      
      // Methods
      const onClose = () => {
        emit('close');
      };
      
      const handleLogout = async () => {
        await store.dispatch('logout');
        router.push('/login');
      };
      
      const onResize = () => {
        windowWidth.value = window.innerWidth;
      };
      
      // Lifecycle hooks
      onMounted(() => {
        window.addEventListener('resize', onResize);
      });
      
      onBeforeUnmount(() => {
        window.removeEventListener('resize', onResize);
      });
      
      return {
        isMobile,
        appTitle,
        userName,
        userRole,
        userInitials,
        userImage,
        menuItems,
        onClose,
        handleLogout
      };
    }
  };
  </script>
  
  <style scoped>
  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    background-color: var(--surface-overlay);
    color: var(--text-color);
    border-right: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 999;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s;
  }
  
  .sidebar-header {
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--surface-border);
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-color);
  }
  
  .logo i {
    font-size: 1.5rem;
  }
  
  .sidebar-close {
    display: none;
  }
  
  .user-info {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-bottom: 1px solid var(--surface-border);
  }
  
  .user-details {
    overflow: hidden;
  }
  
  .user-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .user-role {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
  }
  
  .sidebar-menu {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 0;
  }
  
  .sidebar-menu ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .menu-item {
    text-decoration: none;
    color: inherit;
  }
  
  .menu-link {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: background-color 0.2s;
  }
  
  .menu-link:hover {
    background-color: var(--surface-ground);
  }
  
  .menu-link.active {
    background-color: var(--primary-color);
    color: white;
  }
  
  .menu-icon {
    font-size: 1.25rem;
    color: var(--text-color-secondary);
  }
  
  .menu-link.active .menu-icon {
    color: white;
  }
  
  .menu-text {
    font-weight: 500;
  }
  
  .sidebar-footer {
    padding: 1rem;
    border-top: 1px solid var(--surface-border);
    display: flex;
    justify-content: center;
  }
  
  .logout-button {
    width: 100%;
  }
  
  /* Mobile styles */
  @media screen and (max-width: 767px) {
    .sidebar-hidden {
      transform: translateX(-100%);
    }
    
    .sidebar-visible {
      transform: translateX(0);
    }
    
    .sidebar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 998;
    }
    
    .sidebar-close {
      display: block;
    }
  }
  
  /* Desktop styles */
  @media screen and (min-width: 768px) {
    .sidebar {
      transform: translateX(0) !important;
    }
  }
  </style>