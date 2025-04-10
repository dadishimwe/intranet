<template>
    <div class="orgchart-container">
      <div class="page-header">
        <h1 class="page-title">Organization Chart</h1>
        <div class="page-actions">
          <Button 
            label="Export" 
            icon="pi pi-download" 
            class="p-button-outlined" 
            @click="exportOrgChart"
          />
          <Button 
            :label="showDepartments ? 'Hide Departments' : 'Show Departments'" 
            :icon="showDepartments ? 'pi pi-eye-slash' : 'pi pi-eye'" 
            class="p-button-outlined ml-2" 
            @click="toggleDepartments"
          />
        </div>
      </div>
      
      <!-- Loading state -->
      <div v-if="loading" class="card loading-card">
        <ProgressSpinner class="spinner" />
        <p>Loading organization data...</p>
      </div>
      
      <!-- Error state -->
      <div v-else-if="error" class="card error-card">
        <i class="pi pi-exclamation-triangle error-icon"></i>
        <h3>Error Loading Data</h3>
        <p>{{ error }}</p>
        <Button label="Retry" icon="pi pi-refresh" @click="loadOrgData" />
      </div>
      
      <!-- Organization Chart -->
      <div v-else class="orgchart-wrapper card">
        <div class="orgchart-actions">
          <div class="zoom-controls">
            <Button icon="pi pi-minus" class="p-button-rounded p-button-text" @click="zoomOut" />
            <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            <Button icon="pi pi-plus" class="p-button-rounded p-button-text" @click="zoomIn" />
          </div>
          
          <div class="orgchart-filters">
            <Dropdown 
              v-if="departments.length > 0"
              v-model="selectedDepartment" 
              :options="departmentOptions" 
              optionLabel="name" 
              placeholder="Filter by Department" 
              class="department-filter"
              @change="filterByDepartment"
            />
            
            <div class="p-input-icon-left search-box">
              <i class="pi pi-search" />
              <InputText v-model="searchTerm" placeholder="Search employees" @input="filterBySearch" />
            </div>
          </div>
        </div>
        
        <div class="chart-container" ref="chartContainer">
          <div class="orgchart" ref="orgchart" :style="{ transform: `scale(${zoomLevel})` }">
            <!-- Recursive tree component -->
            <OrgNode 
              v-if="rootNode" 
              :node="rootNode" 
              :show-departments="showDepartments"
              :highlighted-nodes="highlightedNodes"
              @node-click="viewEmployeeDetails"
            />
          </div>
        </div>
      </div>
      
      <!-- Employee Details Dialog -->
      <Dialog 
        v-model:visible="employeeDialogVisible" 
        :header="selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : 'Employee Details'" 
        :modal="true"
        :dismissableMask="true"
        :style="{ width: '500px' }"
        :closeOnEscape="true"
      >
        <div v-if="selectedEmployee" class="employee-details">
          <div class="employee-header">
            <div class="employee-avatar">
              <img 
                v-if="selectedEmployee.profile_image" 
                :src="selectedEmployee.profile_image" 
                :alt="selectedEmployee.first_name" 
                class="employee-image"
              />
              <div v-else class="employee-initials">
                {{ getInitials(selectedEmployee) }}
              </div>
            </div>
            
            <div class="employee-title">
              <h3>{{ selectedEmployee.first_name }} {{ selectedEmployee.last_name }}</h3>
              <div class="employee-position">{{ selectedEmployee.job_title }}</div>
              <Tag 
                v-if="selectedEmployee.department_name" 
                :value="selectedEmployee.department_name"
                severity="info"
                class="department-tag"
              />
            </div>
          </div>
          
          <Divider />
          
          <div class="employee-info">
            <div class="info-item">
              <div class="info-label">Email</div>
              <div class="info-value">
                <a :href="`mailto:${selectedEmployee.email}`">{{ selectedEmployee.email }}</a>
              </div>
            </div>
            
            <div v-if="selectedEmployee.phone" class="info-item">
              <div class="info-label">Phone</div>
              <div class="info-value">{{ selectedEmployee.phone }}</div>
            </div>
            
            <div v-if="selectedEmployee.manager_name" class="info-item">
              <div class="info-label">Manager</div>
              <div class="info-value">{{ selectedEmployee.manager_name }}</div>
            </div>
            
            <div v-if="directReports.length > 0" class="info-item">
              <div class="info-label">Direct Reports</div>
              <div class="info-value">
                <ul class="direct-reports-list">
                  <li v-for="report in directReports" :key="report.id">
                    {{ report.first_name }} {{ report.last_name }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <template #footer>
          <Button 
            label="View Profile" 
            icon="pi pi-user" 
            @click="goToEmployeeProfile" 
          />
        </template>
      </Dialog>
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted, nextTick } from 'vue';
  import { useStore } from 'vuex';
  import { useRouter } from 'vue-router';
  import Button from 'primevue/button';
  import Dropdown from 'primevue/dropdown';
  import InputText from 'primevue/inputtext';
  import Dialog from 'primevue/dialog';
  import Divider from 'primevue/divider';
  import Tag from 'primevue/tag';
  import ProgressSpinner from 'primevue/progressspinner';
  import OrgNode from '../components/orgchart/OrgNode.vue';
  
  export default {
    name: 'OrgChartView',
    components: {
      Button,
      Dropdown,
      InputText,
      Dialog,
      Divider,
      Tag,
      ProgressSpinner,
      OrgNode
    },
    
    setup() {
      const store = useStore();
      const router = useRouter();
      
      // State
      const loading = ref(false);
      const error = ref(null);
      const orgData = ref([]);
      const departments = ref([]);
      const rootNode = ref(null);
      const zoomLevel = ref(1);
      const showDepartments = ref(true);
      const selectedDepartment = ref(null);
      const searchTerm = ref('');
      const highlightedNodes = ref([]);
      const employeeDialogVisible = ref(false);
      const selectedEmployee = ref(null);
      const directReports = ref([]);
      
      // DOM refs
      const chartContainer = ref(null);
      const orgchart = ref(null);
      
      // Computed properties
      const departmentOptions = computed(() => {
        const options = [{ id: null, name: 'All Departments' }];
        departments.value.forEach(dept => {
          options.push(dept);
        });
        return options;
      });
      
      // Methods
      const loadOrgData = async () => {
        try {
          loading.value = true;
          error.value = null;
          
          // Fetch org chart data
          await store.dispatch('users/fetchOrgChart');
          orgData.value = store.state.users.orgChart;
          
          // Fetch departments
          await store.dispatch('departments/fetchDepartments');
          departments.value = store.state.departments.list;
          
          // Build tree structure
          buildOrgTree();
        } catch (err) {
          console.error('Error loading org chart data:', err);
          error.value = 'Failed to load organization data. Please try again.';
        } finally {
          loading.value = false;
        }
      };
      
      const buildOrgTree = () => {
        if (!orgData.value || orgData.value.length === 0) {
          rootNode.value = null;
          return;
        }
        
        // Create nodes map
        const nodesMap = new Map();
        
        // First pass: Create all nodes
        orgData.value.forEach(employee => {
          nodesMap.set(employee.id, {
            ...employee,
            children: []
          });
        });
        
        // Second pass: Build parent-child relationships
        let root = null;
        
        orgData.value.forEach(employee => {
          const node = nodesMap.get(employee.id);
          
          if (employee.manager_id) {
            // Add to parent's children
            const parent = nodesMap.get(employee.manager_id);
            if (parent) {
              parent.children.push(node);
            }
          } else {
            // This is a root node (no manager)
            root = node;
          }
        });
        
        // Sort children by last name in each node
        const sortChildren = (node) => {
          if (node.children && node.children.length > 0) {
            node.children.sort((a, b) => 
              a.last_name.localeCompare(b.last_name) || 
              a.first_name.localeCompare(b.first_name)
            );
            
            node.children.forEach(child => sortChildren(child));
          }
        };
        
        if (root) {
          sortChildren(root);
        }
        
        rootNode.value = root;
      };
      
      const zoomIn = () => {
        zoomLevel.value = Math.min(2, zoomLevel.value + 0.1);
      };
      
      const zoomOut = () => {
        zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.1);
      };
      
      const toggleDepartments = () => {
        showDepartments.value = !showDepartments.value;
      };
      
      const filterByDepartment = () => {
        if (!selectedDepartment.value || selectedDepartment.value.id === null) {
          highlightedNodes.value = [];
          buildOrgTree(); // Reset to original tree
          return;
        }
        
        // Find employees in the selected department
        const deptEmployees = orgData.value.filter(
          emp => emp.department_id === selectedDepartment.value.id
        );
        
        // Highlight these nodes
        highlightedNodes.value = deptEmployees.map(emp => emp.id);
        
        // Rebuild the tree to show all nodes (highlighted ones will be styled differently)
        buildOrgTree();
      };
      
      const filterBySearch = () => {
        if (!searchTerm.value.trim()) {
          highlightedNodes.value = [];
          buildOrgTree(); // Reset to original tree
          return;
        }
        
        const term = searchTerm.value.toLowerCase();
        
        // Find employees matching the search term
        const matchingEmployees = orgData.value.filter(
          emp => emp.first_name.toLowerCase().includes(term) || 
                 emp.last_name.toLowerCase().includes(term) ||
                 emp.job_title?.toLowerCase().includes(term) ||
                 emp.email.toLowerCase().includes(term)
        );
        
        // Highlight these nodes
        highlightedNodes.value = matchingEmployees.map(emp => emp.id);
        
        // Rebuild the tree to show all nodes (highlighted ones will be styled differently)
        buildOrgTree();
      };
      
      const viewEmployeeDetails = async (employee) => {
        selectedEmployee.value = employee;
        
        // Get direct reports
        try {
          const reports = await store.dispatch('users/fetchDirectReports', employee.id);
          directReports.value = reports || [];
        } catch (error) {
          console.error('Error fetching direct reports:', error);
          directReports.value = [];
        }
        
        employeeDialogVisible.value = true;
      };
      
      const goToEmployeeProfile = () => {
        if (selectedEmployee.value) {
          router.push(`/users/${selectedEmployee.value.id}`);
        }
      };
      
      const getInitials = (employee) => {
        if (!employee) return '';
        
        const first = employee.first_name.charAt(0).toUpperCase();
        const last = employee.last_name.charAt(0).toUpperCase();
        
        return `${first}${last}`;
      };
      
      const exportOrgChart = () => {
        // In a real application, this would create a PDF or image export
        // For this implementation, we'll just show a message
        store.dispatch('showToast', {
          severity: 'info',
          summary: 'Export',
          detail: 'Organization chart export functionality would be implemented here'
        });
      };
      
      // Load data when component mounts
      onMounted(async () => {
        await loadOrgData();
        
        // Center the chart after it's rendered
        nextTick(() => {
          if (chartContainer.value && orgchart.value) {
            chartContainer.value.scrollLeft = 
              (orgchart.value.scrollWidth - chartContainer.value.clientWidth) / 2;
          }
        });
      });
      
      return {
        loading,
        error,
        rootNode,
        departments,
        departmentOptions,
        zoomLevel,
        showDepartments,
        selectedDepartment,
        searchTerm,
        highlightedNodes,
        employeeDialogVisible,
        selectedEmployee,
        directReports,
        chartContainer,
        orgchart,
        
        loadOrgData,
        zoomIn,
        zoomOut,
        toggleDepartments,
        filterByDepartment,
        filterBySearch,
        viewEmployeeDetails,
        goToEmployeeProfile,
        getInitials,
        exportOrgChart
      };
    }
  };
  </script>
  
  <style scoped>
  .orgchart-container {
    padding: 1rem;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }
  
  .loading-card, .error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
  }
  
  .spinner {
    width: 50px;
    height: 50px;
    margin-bottom: 1rem;
  }
  
  .error-icon {
    font-size: 3rem;
    color: var(--danger-color);
    margin-bottom: 1rem;
  }
  
  .orgchart-wrapper {
    display: flex;
    flex-direction: column;
    padding: 1rem;
  }
  
  .orgchart-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .zoom-controls {
    display: flex;
    align-items: center;
  }
  
  .zoom-level {
    margin: 0 0.5rem;
    min-width: 3rem;
    text-align: center;
  }
  
  .orgchart-filters {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .department-filter {
    width: 200px;
  }
  
  .search-box {
    width: 200px;
  }
  
  .chart-container {
    overflow: auto;
    border: 1px solid var(--surface-border);
    padding: 2rem;
    display: flex;
    justify-content: center;
    min-height: 500px;
    background-color: var(--surface-ground);
  }
  
  .orgchart {
    transform-origin: center top;
    transition: transform 0.3s;
  }
  
  /* Employee details styles */
  .employee-details {
    padding: 1rem 0;
  }
  
  .employee-header {
    display: flex;
    align-items: center;
  }
  
  .employee-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 1.5rem;
    background-color: var(--primary-color);
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .employee-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .employee-initials {
    font-size: 2rem;
    font-weight: 600;
    color: white;
  }
  
  .employee-title h3 {
    margin: 0 0 0.5rem 0;
    font-weight: 600;
  }
  
  .employee-position {
    color: var(--text-color-secondary);
    margin-bottom: 0.5rem;
  }
  
  .department-tag {
    font-size: 0.75rem;
  }
  
  .employee-info {
    margin-top: 1rem;
  }
  
  .info-item {
    margin-bottom: 1rem;
  }
  
  .info-label {
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: var(--text-color-secondary);
  }
  
  .info-value {
    color: var(--text-color);
  }
  
  .direct-reports-list {
    list-style-type: none;
    padding-left: 0;
    margin: 0;
  }
  
  .direct-reports-list li {
    padding: 0.25rem 0;
  }
  
  /* Responsive adjustments */
  @media screen and (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .page-actions {
      margin-top: 1rem;
      width: 100%;
      display: flex;
      gap: 0.5rem;
    }
    
    .orgchart-actions {
      flex-direction: column;
      align-items: stretch;
    }
    
    .zoom-controls {
      margin-bottom: 1rem;
      justify-content: center;
    }
    
    .orgchart-filters {
      flex-direction: column;
      width: 100%;
    }
    
    .department-filter,
    .search-box {
      width: 100%;
    }
    
    .chart-container {
      min-height: 400px;
    }
    
    .employee-header {
      flex-direction: column;
      text-align: center;
    }
    
    .employee-avatar {
      margin-right: 0;
      margin-bottom: 1rem;
    }
  }
  </style>