<template>
    <div class="dashboard-container">
      <h1 class="dashboard-title">Dashboard</h1>
      
      <!-- Welcome card -->
      <div class="card welcome-card">
        <div class="welcome-header">
          <div class="welcome-text">
            <h2>Welcome, {{ userFirstName }}!</h2>
            <p>{{ welcomeMessage }}</p>
          </div>
          <div class="welcome-actions">
            <Button 
              label="My Profile" 
              icon="pi pi-user" 
              class="p-button-outlined mr-2" 
              @click="goToProfile" 
            />
            <Button 
              v-if="hasDirectReports"
              label="My Team" 
              icon="pi pi-users" 
              class="p-button-outlined" 
              @click="goToMyTeam" 
            />
          </div>
        </div>
      </div>
      
      <!-- Quick stats -->
      <div class="grid">
        <div class="col-12 md:col-6 lg:col-3">
          <div class="card stat-card">
            <div class="stat-icon">
              <i class="pi pi-calendar"></i>
            </div>
            <div class="stat-content">
              <div class="stat-title">Upcoming Events</div>
              <div class="stat-value">{{ upcomingEventsCount }}</div>
              <div class="stat-link">
                <router-link to="/calendar">View Calendar</router-link>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-12 md:col-6 lg:col-3">
          <div class="card stat-card">
            <div class="stat-icon">
              <i class="pi pi-money-bill"></i>
            </div>
            <div class="stat-content">
              <div class="stat-title">My Expenses</div>
              <div class="stat-value" v-if="expenseStats">
                {{ expenseStats.pendingCount }}
                <span class="stat-subtitle">pending</span>
              </div>
              <div class="stat-value" v-else>--</div>
              <div class="stat-link">
                <router-link to="/expenses">View Expenses</router-link>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-12 md:col-6 lg:col-3">
          <div class="card stat-card">
            <div class="stat-icon">
              <i class="pi pi-book"></i>
            </div>
            <div class="stat-content">
              <div class="stat-title">Knowledge Base</div>
              <div class="stat-value">{{ recentDocsCount }}</div>
              <div class="stat-link">
                <router-link to="/wiki">Browse Wiki</router-link>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-12 md:col-6 lg:col-3">
          <div class="card stat-card">
            <div class="stat-icon">
              <i class="pi pi-sitemap"></i>
            </div>
            <div class="stat-content">
              <div class="stat-title">Organization</div>
              <div class="stat-value">{{ departmentName || 'Unassigned' }}</div>
              <div class="stat-link">
                <router-link to="/organization">View Org Chart</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Calendar and recent documents -->
      <div class="grid">
        <!-- Upcoming events -->
        <div class="col-12 lg:col-6">
          <div class="card">
            <div class="card-header">
              <h3>Upcoming Events</h3>
              <Button 
                icon="pi pi-plus" 
                class="p-button-rounded p-button-text" 
                @click="goToCalendar" 
              />
            </div>
            
            <div v-if="isLoadingEvents" class="empty-state">
              <ProgressSpinner style="width: 50px; height: 50px" />
            </div>
            
            <div v-else-if="upcomingEvents.length === 0" class="empty-state">
              <i class="pi pi-calendar-times empty-icon"></i>
              <p>No upcoming events</p>
            </div>
            
            <div v-else class="event-list">
              <div 
                v-for="event in upcomingEvents" 
                :key="event.id" 
                class="event-item"
              >
                <div class="event-date">
                  <span class="event-day">{{ formatDay(event.start_time) }}</span>
                  <span class="event-month">{{ formatMonth(event.start_time) }}</span>
                </div>
                
                <div class="event-details">
                  <div class="event-title">{{ event.title }}</div>
                  <div class="event-time">
                    {{ formatTime(event.start_time) }} - {{ formatTime(event.end_time) }}
                  </div>
                  <div class="event-location" v-if="event.location">
                    <i class="pi pi-map-marker"></i> {{ event.location }}
                  </div>
                </div>
                
                <div class="event-status" v-if="event.attendance_status">
                  <Tag 
                    :severity="getAttendanceTagType(event.attendance_status)" 
                    :value="capitalize(event.attendance_status)" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Recent documents -->
        <div class="col-12 lg:col-6">
          <div class="card">
            <div class="card-header">
              <h3>Recent Documents</h3>
              <Button 
                icon="pi pi-plus" 
                class="p-button-rounded p-button-text" 
                @click="goToDocuments" 
              />
            </div>
            
            <div v-if="isLoadingDocs" class="empty-state">
              <ProgressSpinner style="width: 50px; height: 50px" />
            </div>
            
            <div v-else-if="recentDocuments.length === 0" class="empty-state">
              <i class="pi pi-file-o empty-icon"></i>
              <p>No recent documents</p>
            </div>
            
            <div v-else class="document-list">
              <div 
                v-for="doc in recentDocuments" 
                :key="doc.id" 
                class="document-item"
                @click="viewDocument(doc.id)"
              >
                <div class="document-icon">
                  <i class="pi" :class="getDocumentIcon(doc.file_type)"></i>
                </div>
                
                <div class="document-details">
                  <div class="document-title">{{ doc.title }}</div>
                  <div class="document-meta">
                    <span class="document-department" v-if="doc.department_name">
                      {{ doc.department_name }}
                    </span>
                    <span class="document-date">
                      {{ formatDate(doc.created_at) }}
                    </span>
                  </div>
                </div>
                
                <Button 
                  icon="pi pi-download" 
                  class="p-button-rounded p-button-text" 
                  @click.stop="downloadDocument(doc)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- For managers: approval requests -->
      <div v-if="isManager || isAdmin" class="grid">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h3>Pending Approvals</h3>
            </div>
            
            <div v-if="isLoadingApprovals" class="empty-state">
              <ProgressSpinner style="width: 50px; height: 50px" />
            </div>
            
            <div v-else-if="pendingApprovals.length === 0" class="empty-state">
              <i class="pi pi-check-circle empty-icon"></i>
              <p>No pending approvals</p>
            </div>
            
            <div v-else class="approval-list">
              <DataTable :value="pendingApprovals" responsive-layout="scroll">
                <Column field="type" header="Type">
                  <template #body="slotProps">
                    <span class="approval-type">
                      <i class="pi" :class="getApprovalIcon(slotProps.data.type)"></i>
                      {{ capitalize(slotProps.data.type) }}
                    </span>
                  </template>
                </Column>
                
                <Column field="title" header="Title" />
                
                <Column field="submittedBy" header="Submitted By" />
                
                <Column field="date" header="Date">
                  <template #body="slotProps">
                    {{ formatDate(slotProps.data.date) }}
                  </template>
                </Column>
                
                <Column header="Actions">
                  <template #body="slotProps">
                    <Button 
                      icon="pi pi-eye" 
                      class="p-button-text p-button-rounded mr-2" 
                      @click="viewApproval(slotProps.data)" 
                    />
                    <Button 
                      icon="pi pi-check" 
                      class="p-button-success p-button-rounded mr-2" 
                      @click="approveItem(slotProps.data)" 
                    />
                    <Button 
                      icon="pi pi-times" 
                      class="p-button-danger p-button-rounded" 
                      @click="rejectItem(slotProps.data)" 
                    />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import { computed, onMounted, ref } from 'vue';
  import { useStore } from 'vuex';
  import { useRouter } from 'vue-router';
  import Button from 'primevue/button';
  import Tag from 'primevue/tag';
  import ProgressSpinner from 'primevue/progressspinner';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  
  export default {
    name: 'HomePage',
    components: {
      Button,
      Tag,
      ProgressSpinner,
      DataTable,
      Column
    },
    setup() {
      const store = useStore();
      const router = useRouter();
      
      // Loading states
      const isLoadingEvents = ref(false);
      const isLoadingDocs = ref(false);
      const isLoadingApprovals = ref(false);
      
      // Data
      const upcomingEvents = ref([]);
      const recentDocuments = ref([]);
      const pendingApprovals = ref([]);
      const expenseStats = ref(null);
      
      // Computed values
      const user = computed(() => store.getters['auth/currentUser']);
      const userFirstName = computed(() => user.value?.firstName || 'User');
      const isAdmin = computed(() => store.getters['auth/isAdmin']);
      const isManager = computed(() => store.getters['auth/isManager']);
      const hasDirectReports = computed(() => isManager.value || isAdmin.value);
      const departmentName = computed(() => user.value?.departmentName);
      
      const upcomingEventsCount = computed(() => upcomingEvents.value.length);
      const recentDocsCount = computed(() => recentDocuments.value.length);
      
      const welcomeMessage = computed(() => {
        const now = new Date();
        const hour = now.getHours();
        
        if (hour < 12) {
          return 'Good morning! Here\'s your daily overview.';
        } else if (hour < 18) {
          return 'Good afternoon! Here\'s your daily overview.';
        } else {
          return 'Good evening! Here\'s your daily overview.';
        }
      });
      
      // Methods - Navigation
      const goToProfile = () => {
        router.push(`/users/${user.value.id}`);
      };
      
      const goToMyTeam = () => {
        router.push('/users?filter=myteam');
      };
      
      const goToCalendar = () => {
        router.push('/calendar');
      };
      
      const goToDocuments = () => {
        router.push('/documents');
      };
      
      const viewDocument = (id) => {
        router.push(`/documents/${id}`);
      };
      
      const viewApproval = (approval) => {
        if (approval.type === 'expense') {
          router.push(`/expenses/${approval.id}`);
        } else if (approval.type === 'leave') {
          router.push(`/leaves/${approval.id}`);
        }
      };
      
      // Methods - Formatting
      const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }).format(date);
      };
      
      const formatDay = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.getDate();
      };
      
      const formatMonth = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
      };
      
      const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true
        }).format(date);
      };
      
      const capitalize = (str) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
      };
      
      // Methods - Icon helpers
      const getDocumentIcon = (fileType) => {
        if (!fileType) return 'pi-file-o';
        
        const type = fileType.toLowerCase();
        
        if (type.includes('pdf')) return 'pi-file-pdf';
        if (type.includes('doc') || type.includes('word')) return 'pi-file-word';
        if (type.includes('xls') || type.includes('spreadsheet')) return 'pi-file-excel';
        if (type.includes('ppt') || type.includes('presentation')) return 'pi-file-powerpoint';
        if (type.includes('zip') || type.includes('rar')) return 'pi-file-archive';
        if (type.includes('jpg') || type.includes('jpeg') || 
            type.includes('png') || type.includes('gif')) return 'pi-file-image';
        
        return 'pi-file-o';
      };
      
      const getApprovalIcon = (type) => {
        if (type === 'expense') return 'pi-money-bill';
        if (type === 'leave') return 'pi-calendar';
        return 'pi-file-o';
      };
      
      const getAttendanceTagType = (status) => {
        switch (status) {
          case 'accepted': return 'success';
          case 'declined': return 'danger';
          case 'tentative': return 'warning';
          default: return 'info';
        }
      };
      
      // Methods - Actions
      const downloadDocument = (doc) => {
        // In a real app, this would trigger a download
        // For this implementation, we just redirect to the document
        window.open(doc.file_path, '_blank');
      };
      
      const approveItem = async (item) => {
        try {
          if (item.type === 'expense') {
            await store.dispatch('expenses/reviewExpense', { 
              id: item.id, 
              action: 'approve'
            });
            
            // Remove from pending list
            pendingApprovals.value = pendingApprovals.value.filter(
              approval => !(approval.id === item.id && approval.type === 'expense')
            );
            
            // Show success message
            store.dispatch('showToast', { 
              message: 'Expense approved successfully', 
              type: 'success' 
            }, { root: true });
          }
          // Handle other approval types as needed
        } catch (error) {
          console.error('Error approving item:', error);
          store.dispatch('showToast', { 
            message: 'Failed to approve item', 
            type: 'error' 
          }, { root: true });
        }
      };
      
      const rejectItem = async (item) => {
        try {
          if (item.type === 'expense') {
            await store.dispatch('expenses/reviewExpense', { 
              id: item.id, 
              action: 'reject'
            });
            
            // Remove from pending list
            pendingApprovals.value = pendingApprovals.value.filter(
              approval => !(approval.id === item.id && approval.type === 'expense')
            );
            
            // Show success message
            store.dispatch('showToast', { 
              message: 'Expense rejected', 
              type: 'info' 
            }, { root: true });
          }
          // Handle other approval types as needed
        } catch (error) {
          console.error('Error rejecting item:', error);
          store.dispatch('showToast', { 
            message: 'Failed to reject item', 
            type: 'error' 
          }, { root: true });
        }
      };
      
      // Fetch data on component mount
      onMounted(async () => {
        // Fetch upcoming events
        isLoadingEvents.value = true;
        try {
          const events = await store.dispatch('calendar/fetchUpcomingEvents');
          upcomingEvents.value = events;
        } catch (error) {
          console.error('Error fetching events:', error);
        } finally {
          isLoadingEvents.value = false;
        }
        
        // Fetch recent documents
        isLoadingDocs.value = true;
        try {
          // This would be a real API call in a complete implementation
          // For now, we'll simulate some documents
          recentDocuments.value = [
            {
              id: '1',
              title: 'Company Handbook',
              file_type: 'pdf',
              department_name: 'Human Resources',
              created_at: new Date().toISOString(),
              file_path: '#'
            },
            {
              id: '2',
              title: 'Q2 Financial Report',
              file_type: 'xlsx',
              department_name: 'Finance',
              created_at: new Date().toISOString(),
              file_path: '#'
            }
          ];
        } catch (error) {
          console.error('Error fetching documents:', error);
        } finally {
          isLoadingDocs.value = false;
        }
        
        // Fetch expense stats
        try {
          // This would be a real API call in a complete implementation
          expenseStats.value = {
            pendingCount: 2,
            totalAmount: 1250.75
          };
        } catch (error) {
          console.error('Error fetching expense stats:', error);
        }
        
        // Fetch pending approvals for managers
        if (isManager.value || isAdmin.value) {
          isLoadingApprovals.value = true;
          try {
            // This would be a real API call in a complete implementation
            pendingApprovals.value = [
              {
                id: '1',
                type: 'expense',
                title: 'Travel Expenses',
                submittedBy: 'John Doe',
                date: new Date().toISOString(),
                amount: 350.50
              },
              {
                id: '2',
                type: 'expense',
                title: 'Office Supplies',
                submittedBy: 'Jane Smith',
                date: new Date().toISOString(),
                amount: 75.25
              }
            ];
          } catch (error) {
            console.error('Error fetching pending approvals:', error);
          } finally {
            isLoadingApprovals.value = false;
          }
        }
      });
      
      return {
        // Loading states
        isLoadingEvents,
        isLoadingDocs,
        isLoadingApprovals,
        
        // Data
        upcomingEvents,
        recentDocuments,
        pendingApprovals,
        expenseStats,
        
        // Computed values
        userFirstName,
        welcomeMessage,
        isAdmin,
        isManager,
        hasDirectReports,
        departmentName,
        upcomingEventsCount,
        recentDocsCount,
        
        // Methods - Navigation
        goToProfile,
        goToMyTeam,
        goToCalendar,
        goToDocuments,
        viewDocument,
        viewApproval,
        
        // Methods - Formatting
        formatDate,
        formatDay,
        formatMonth,
        formatTime,
        capitalize,
        
        // Methods - Icon helpers
        getDocumentIcon,
        getApprovalIcon,
        getAttendanceTagType,
        
        // Methods - Actions
        downloadDocument,
        approveItem,
        rejectItem
      };
    }
  };
  </script>
  
  <style scoped>
  .dashboard-container {
    padding: 1rem;
  }
  
  .dashboard-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }
  
  /* Welcome card */
  .welcome-card {
    margin-bottom: 1.5rem;
    padding: 1.5rem;
  }
  
  .welcome-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .welcome-text h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }
  
  .welcome-text p {
    margin: 0;
    color: var(--text-color-secondary);
  }
  
  /* Stat cards */
  .stat-card {
    display: flex;
    align-items: center;
    padding: 1.25rem;
    height: 100%;
  }
  
  .stat-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background-color: rgba(59, 130, 246, 0.1);
    color: var(--primary-color);
    margin-right: 1rem;
  }
  
  .stat-icon i {
    font-size: 1.5rem;
  }
  
  .stat-content {
    flex: 1;
  }
  
  .stat-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-color-secondary);
    margin-bottom: 0.25rem;
  }
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 0.25rem;
  }
  
  .stat-subtitle {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--text-color-secondary);
  }
  
  .stat-link a {
    font-size: 0.875rem;
    color: var(--primary-color);
    text-decoration: none;
  }
  
  .stat-link a:hover {
    text-decoration: underline;
  }
  
  /* Card headers */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .card-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }
  
  /* Empty states */
  .empty-state {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    text-align: center;
    color: var(--text-color-secondary);
  }
  
  .empty-icon {
    font-size: 2rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  /* Event list */
  .event-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .event-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 0.375rem;
    background-color: var(--surface-ground);
    transition: background-color 0.2s;
  }
  
  .event-item:hover {
    background-color: var(--surface-hover);
  }
  
  .event-date {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 0.375rem;
    background-color: var(--primary-color);
    color: white;
    margin-right: 1rem;
  }
  
  .event-day {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1;
  }
  
  .event-month {
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  
  .event-details {
    flex: 1;
  }
  
  .event-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }
  
  .event-time, .event-location {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
  }
  
  .event-location {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  /* Document list */
  .document-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .document-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 0.375rem;
    background-color: var(--surface-ground);
    transition: background-color 0.2s;
    cursor: pointer;
  }
  
  .document-item:hover {
    background-color: var(--surface-hover);
  }
  
  .document-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.375rem;
    background-color: rgba(59, 130, 246, 0.1);
    color: var(--primary-color);
    margin-right: 1rem;
  }
  
  .document-icon i {
    font-size: 1.25rem;
  }
  
  .document-details {
    flex: 1;
  }
  
  .document-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }
  
  .document-meta {
    display: flex;
    font-size: 0.875rem;
    color: var(--text-color-secondary);
  }
  
  .document-department {
    margin-right: 1rem;
  }
  
  /* Approval list */
  .approval-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  /* Responsive adjustments */
  @media screen and (max-width: 576px) {
    .welcome-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .event-date {
      width: 2.5rem;
      height: 2.5rem;
    }
    
    .document-icon {
      width: 2rem;
      height: 2rem;
    }
  }
  </style>