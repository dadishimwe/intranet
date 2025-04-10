<template>
    <header class="header">
      <div class="header-left">
        <!-- Mobile menu toggle button -->
        <Button 
          v-if="isMobile" 
          icon="pi pi-bars" 
          class="p-button-text p-button-rounded menu-toggle" 
          @click="onToggleAppSidebar" 
        />
        
        <!-- Page title -->
        <h1 class="header-title">{{ currentPageTitle }}</h1>
      </div>
      
      <div class="header-right">
        <!-- Notifications dropdown -->
        <div class="header-item">
          <Button 
            icon="pi pi-bell" 
            badge="0" 
            class="p-button-text p-button-rounded" 
            @click="toggleNotifications" 
          />
          
          <Menu 
            ref="notificationMenu" 
            :model="notificationItems" 
            :popup="true" 
            class="notification-menu" 
          />
        </div>
        
        <!-- Profile dropdown -->
        <div class="header-item">
          <Avatar 
            :image="userImage || undefined" 
            :label="userInitials" 
            shape="circle" 
            class="header-avatar"
            @click="toggleUserMenu" 
          />
          
          <Menu 
            ref="userMenu" 
            :model="userMenuItems" 
            :popup="true" 
          />
        </div>
      </div>
    </header>
  </template>
  
  <script>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
  import { useStore } from 'vuex';
  import { useRouter, useRoute } from 'vue-router';
  import Button from 'primevue/button';
  import Avatar from 'primevue/avatar';
  import Menu from 'primevue/menu';
  
  export default {
    name: 'Header',
    components: {
      Button,
      Avatar,
      Menu
    },
    emits: ['toggle-sidebar'],
    setup(props, { emit }) {
      const store = useStore();
      const router = useRouter();
      const route = useRoute();
      const windowWidth = ref(window.innerWidth);
      const notificationMenu = ref(null);
      const userMenu = ref(null);
      
      // Computed properties
      const isMobile = computed(() => windowWidth.value < 768);
      
      const currentPageTitle = computed(() => {
        const routeMap = {
          'Home': 'Dashboard',
          'Users': 'Users',
          'UserDetails': 'User Profile',
          'OrgChart': 'Organization Chart',
          'Departments': 'Departments',
          'Documents': 'Documents',
          'Calendar': 'Calendar',
          'Wiki': 'Knowledge Base',
          'Expenses': 'Expenses'
        };
        
        return routeMap[route.name] || 'Dashboard';
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
      
      // Notification menu items
      const notificationItems = ref([
        {
          label: 'No new notifications',
          disabled: true
        },
        { separator: true },
        {
          label: 'View all notifications',
          icon: 'pi pi-list',
          command: () => {
            // Navigate to notifications page
          }
        }
      ]);
      
      // User menu items
      const userMenuItems = ref([
        {
          label: 'Profile',
          icon: 'pi pi-user',
          command: () => {
            router.push(`/users/${store.state.user.id}`);
          }
        },
        {
          label: 'Settings',
          icon: 'pi pi-cog',
          command: () => {
            // Navigate to settings page
          }
        },
        { separator: true },
        {
          label: 'Logout',
          icon: 'pi pi-sign-out',
          command: async () => {
            await store.dispatch('logout');
            router.push('/login');
          }
        }
      ]);
      
      // Methods
      const onToggleSidebar = () => {
        emit('toggle-sidebar');
      };
      
      const toggleNotifications = (event) => {
        notificationMenu.value.toggle(event);
      };
      
      const toggleUserMenu = (event) => {
        userMenu.value.toggle(event);
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
        currentPageTitle,
        userInitials,
        userImage,
        notificationItems,
        userMenuItems,
        notificationMenu,
        userMenu,
        onToggleSidebar,
        toggleNotifications,
        toggleUserMenu
      };
    }
  };
  </script>
  
  <style scoped>
  .header {
    height: var(--topbar-height);
    background-color: var(--surface-card);
    border-bottom: 1px solid var(--surface-border);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 997;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .menu-toggle {
    display: none;
  }
  
  .header-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-color);
    margin: 0;
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .header-item {
    position: relative;
  }
  
  .header-avatar {
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .header-avatar:hover {
    transform: scale(1.05);
  }
  
  /* Mobile styles */
  @media screen and (max-width: 767px) {
    .menu-toggle {
      display: block;
    }
    
    .header-title {
      font-size: 1rem;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  
  /* Custom styling for notification menu */
  :deep(.notification-menu) {
    width: 300px;
  }
  </style>