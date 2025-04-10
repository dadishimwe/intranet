<template>
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-left">
          <span class="copyright">
            © {{ currentYear }} Corporate Intranet
          </span>
        </div>
        
        <div class="footer-center">
          <span class="version">
            Version 1.0.0
          </span>
        </div>
        
        <div class="footer-right">
          <span class="system-status" :class="systemStatusClass">
            <i class="pi" :class="systemStatusIcon"></i>
            System Status: {{ systemStatusText }}
          </span>
        </div>
      </div>
    </footer>
  </template>
  
  <script>
  import { computed, ref } from 'vue';
  import { useStore } from 'vuex';
  
  export default {
    name: 'AppFooter',
    setup() {
      const store = useStore();
      const currentYear = ref(new Date().getFullYear());
      
      // Get system status from store
      const systemStatus = computed(() => store.getters.systemStatus);
      
      // Map status to readable text
      const systemStatusText = computed(() => {
        switch (systemStatus.value) {
          case 'healthy':
            return 'Healthy';
          case 'warning':
            return 'Warning';
          case 'error':
            return 'Error';
          default:
            return 'Unknown';
        }
      });
      
      // Map status to icon
      const systemStatusIcon = computed(() => {
        switch (systemStatus.value) {
          case 'healthy':
            return 'pi-check-circle';
          case 'warning':
            return 'pi-exclamation-triangle';
          case 'error':
            return 'pi-times-circle';
          default:
            return 'pi-question-circle';
        }
      });
      
      // Map status to CSS class
      const systemStatusClass = computed(() => {
        return `status-${systemStatus.value}`;
      });
      
      return {
        currentYear,
        systemStatus,
        systemStatusText,
        systemStatusIcon,
        systemStatusClass
      };
    }
  };
  </script>
  
  <style scoped>
  .footer {
    background-color: var(--surface-section);
    border-top: 1px solid var(--surface-border);
    padding: 0.5rem 1.5rem;
    color: var(--text-color-secondary);
    font-size: 0.875rem;
  }
  
  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .copyright {
    font-weight: 500;
  }
  
  .version {
    font-size: 0.75rem;
  }
  
  .system-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .system-status i {
    font-size: 0.875rem;
  }
  
  /* Status colors */
  .status-healthy {
    color: var(--success-color);
  }
  
  .status-warning {
    color: var(--warning-color);
  }
  
  .status-error {
    color: var(--danger-color);
  }
  
  .status-unknown {
    color: var(--text-color-secondary);
  }
  
  /* Responsive adjustments */
  @media screen and (max-width: 640px) {
    .footer-content {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
    }
  }
  </style>