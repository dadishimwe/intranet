<template>
  <div class="users-container">
    <div class="page-header">
      <h1 class="page-title">Company Directory</h1>
      <div class="page-actions">
        <Button 
          v-if="isAdmin"
          label="Add User" 
          icon="pi pi-plus" 
          @click="openNewUserAppDialog"
          class="p-button-primary"
        />
      </div>
    </div>

    <!-- User filters -->
    <div class="card">
      <div class="user-filters">
        <div class="grid">
          <div class="col-12 md:col-4">
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search" />
              <InputText 
                v-model="filters.searchTerm" 
                placeholder="Search users" 
                class="w-full"
                @input="onFilterChange"
              />
            </span>
          </div>
          <div class="col-12 md:col-3">
            <Dropdown
              v-model="filters.departmentId"
              :options="departments"
              optionLabel="name"
              optionValue="id"
              placeholder="All AppDepartments"
              class="w-full"
              @change="onFilterChange"
            />
          </div>
          <div class="col-12 md:col-3">
            <Dropdown
              v-model="filters.role"
              :options="roleOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="All Roles"
              class="w-full"
              @change="onFilterChange"
            />
          </div>
          <div class="col-12 md:col-2">
            <div class="p-inputgroup w-full">
              <span class="p-inputgroup-addon">
                <i class="pi pi-user"></i>
              </span>
              <Button 
                :label="filters.isActive !== false ? 'Active Only' : 'All Users'" 
                :class="{ 'p-button-success': filters.isActive !== false }"
                class="w-full"
                @click="toggleActiveFilter"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Loading spinner -->
      <div v-if="isLoading" class="loading-container">
        <ProgressSpinner />
      </div>

      <!-- User list - Card view -->
      <div v-else class="user-list">
        <div v-if="users.length === 0" class="empty-message">
          <i class="pi pi-users"></i>
          <p>No users found</p>
        </div>
        <div v-else class="grid">
          <div v-for="user in users" :key="user.id" class="col-12 md:col-6 lg:col-4 xl:col-3">
            <div 
              class="user-card p-ripple" 
              :class="{ 'inactive-user': !user.is_active }"
              @click="viewUser(user)"
            >
              <div class="user-card-header">
                <Avatar 
                  :image="user.profile_image" 
                  size="large" 
                  shape="circle" 
                  :pt="{
                    image: {
                      style: { 
                        objectFit: 'cover',
                        width: '64px',
                        height: '64px'
                      }
                    }
                  }"
                />
                <div class="user-info">
                  <h3 class="user-name">{{ user.first_name }} {{ user.last_name }}</h3>
                  <div class="user-title">{{ user.job_title || 'No title' }}</div>
                </div>
              </div>
              <div class="user-card-content">
                <div class="user-detail">
                  <i class="pi pi-envelope"></i>
                  <span>{{ user.email }}</span>
                </div>
                <div v-if="user.department_name" class="user-detail">
                  <i class="pi pi-sitemap"></i>
                  <span>{{ user.department_name }}</span>
                </div>
                <div v-if="user.phone" class="user-detail">
                  <i class="pi pi-phone"></i>
                  <span>{{ user.phone }}</span>
                </div>
              </div>
              <div class="user-card-footer">
                <Tag 
                  :value="user.role" 
                  :severity="getRoleSeverity(user.role)" 
                />
                <Tag 
                  v-if="!user.is_active" 
                  value="Inactive" 
                  severity="danger" 
                />
              </div>
              <Ripple />
            </div>
          </div>
        </div>

        <!-- Pagination controls -->
        <Paginator 
          v-if="users.length > 0" 
          :rows="pagination.per_page" 
          :totalRecords="pagination.total" 
          :rowsPerPageOptions="[12, 24, 48]" 
          @page="onPageChange($event)"
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          class="user-paginator"
        />
      </div>
    </div>

    <!-- User Dialog -->
    <Dialog 
      v-model:visible="userDialogVisible" 
      :style="{ width: '650px' }" 
      :header="dialogMode === 'create' ? 'New User' : 'Edit User'" 
      :modal="true" 
      class="p-fluid user-dialog"
    >
      <div class="user-form">
        <div class="profile-image-upload">
          <div class="profile-image-container">
            <Avatar 
              :image="userForm.profileImageUrl || null" 
              size="xlarge" 
              shape="circle" 
              :pt="{
                image: {
                  style: { 
                    objectFit: 'cover',
                    width: '100px',
                    height: '100px'
                  }
                }
              }"
            >
              <template #icon>
                <i class="pi pi-user" style="font-size: 2rem"></i>
              </template>
            </Avatar>
            <div class="profile-upload-overlay">
              <FileUpload 
                mode="basic" 
                name="profile" 
                accept="image/*" 
                :maxFileSize="1000000" 
                chooseLabel=""
                class="p-button-rounded p-button-outlined p-button-sm profile-upload-button"
                @select="onProfileImageSelect"
                @error="onProfileImageError"
              >
                <template #chooseicon>
                  <i class="pi pi-camera"></i>
                </template>
              </FileUpload>
            </div>
          </div>
          <small v-if="profileImageError" class="p-error">{{ profileImageError }}</small>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6">
            <div class="field">
              <label for="firstName">First Name*</label>
              <InputText 
                id="firstName" 
                v-model="userForm.firstName" 
                required 
                :class="{ 'p-invalid': submitted && !userForm.firstName }"
              />
              <small v-if="submitted && !userForm.firstName" class="p-error">First name is required.</small>
            </div>
          </div>
          <div class="col-12 md:col-6">
            <div class="field">
              <label for="lastName">Last Name*</label>
              <InputText 
                id="lastName" 
                v-model="userForm.lastName" 
                required 
                :class="{ 'p-invalid': submitted && !userForm.lastName }"
              />
              <small v-if="submitted && !userForm.lastName" class="p-error">Last name is required.</small>
            </div>
          </div>
          <div class="col-12">
            <div class="field">
              <label for="email">Email*</label>
              <InputText 
                id="email" 
                v-model="userForm.email" 
                type="email" 
                required 
                :disabled="dialogMode === 'edit'"
                :class="{ 'p-invalid': submitted && !userForm.email }"
              />
              <small v-if="submitted && !userForm.email" class="p-error">Email is required.</small>
              <small v-else-if="emailError" class="p-error">{{ emailError }}</small>
            </div>
          </div>
          <div class="col-12 md:col-6">
            <div class="field">
              <label for="jobTitle">Job Title</label>
              <InputText id="jobTitle" v-model="userForm.jobTitle" />
            </div>
          </div>
          <div class="col-12 md:col-6">
            <div class="field">
              <label for="phone">Phone</label>
              <InputText id="phone" v-model="userForm.phone" />
            </div>
          </div>
          <div class="col-12 md:col-6">
            <div class="field">
              <label for="department">Department</label>
              <Dropdown 
                id="department" 
                v-model="userForm.departmentId" 
                :options="departments" 
                optionLabel="name" 
                optionValue="id" 
                placeholder="Select Department" 
              />
            </div>
          </div>
          <div class="col-12 md:col-6">
            <div class="field">
              <label for="manager">Manager</label>
              <Dropdown 
                id="manager" 
                v-model="userForm.managerId" 
                :options="managers" 
                optionLabel="name" 
                optionValue="id" 
                placeholder="Select Manager" 
              />
            </div>
          </div>
          <div v-if="isAdmin" class="col-12 md:col-6">
            <div class="field">
              <label for="role">Role*</label>
              <Dropdown 
                id="role" 
                v-model="userForm.role" 
                :options="roleOptions" 
                optionLabel="label" 
                optionValue="value" 
                placeholder="Select Role" 
                required
                :class="{ 'p-invalid': submitted && !userForm.role }"
              />
              <small v-if="submitted && !userForm.role" class="p-error">Role is required.</small>
            </div>
          </div>
          <div v-if="isAdmin && dialogMode === 'edit'" class="col-12 md:col-6">
            <div class="field">
              <label for="isActive">Status</label>
              <div class="field-checkbox">
                <Checkbox id="isActive" v-model="userForm.isActive" :binary="true" />
                <label for="isActive">Active user</label>
              </div>
            </div>
          </div>

          <!-- Password fields (only show for new users or if changing password) -->
          <template v-if="dialogMode === 'create' || showPasswordFields">
            <div class="col-12">
              <Divider align="left">
                <div class="inline-flex align-items-center">
                  <i class="pi pi-lock mr-2"></i>
                  <b>{{ dialogMode === 'create' ? 'Set Password' : 'Change Password' }}</b>
                </div>
              </Divider>
            </div>
            <div class="col-12 md:col-6">
              <div class="field">
                <label for="password">Password{{ dialogMode === 'create' ? '*' : '' }}</label>
                <Password 
                  id="password" 
                  v-model="userForm.password" 
                  toggleMask 
                  :feedback="true"
                  :required="dialogMode === 'create'"
                  :class="{ 'p-invalid': submitted && dialogMode === 'create' && !userForm.password }"
                />
                <small v-if="submitted && dialogMode === 'create' && !userForm.password" class="p-error">Password is required for new users.</small>
              </div>
            </div>
            <div class="col-12 md:col-6">
              <div class="field">
                <label for="confirmPassword">Confirm Password{{ dialogMode === 'create' ? '*' : '' }}</label>
                <Password 
                  id="confirmPassword" 
                  v-model="userForm.confirmPassword" 
                  toggleMask 
                  :feedback="false"
                  :required="dialogMode === 'create'"
                  :class="{ 'p-invalid': submitted && ((dialogMode === 'create' && !userForm.confirmPassword) || passwordMismatch) }"
                />
                <small v-if="submitted && dialogMode === 'create' && !userForm.confirmPassword" class="p-error">Please confirm the password.</small>
                <small v-else-if="passwordMismatch" class="p-error">Passwords do not match.</small>
              </div>
            </div>
          </template>

          <!-- Button to show/hide password fields when editing -->
          <div v-if="dialogMode === 'edit' && !showPasswordFields" class="col-12">
            <Button 
              label="Change Password" 
              icon="pi pi-lock" 
              class="p-button-outlined p-button-secondary mt-2" 
              type="button"
              @click="showPasswordFields = true"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button 
          label="Cancel" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="closeUserAppDialog" 
        />
        <Button 
          v-if="dialogMode === 'edit' && isAdmin" 
          label="Delete" 
          icon="pi pi-trash" 
          class="p-button-danger mr-2" 
          @click="confirmDeleteUser" 
        />
        <Button 
          label="Save" 
          icon="pi pi-check" 
          @click="saveUser" 
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- User Details Dialog -->
    <Dialog 
      v-model:visible="userDetailsVisible" 
      :style="{ width: '650px' }" 
      :header="selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : 'User Details'" 
      :modal="true"
      class="user-details-dialog"
    >
      <div v-if="selectedUser" class="user-details">
        <div class="user-details-header">
          <Avatar 
            :image="selectedUser.profile_image" 
            size="xlarge" 
            shape="circle" 
            :pt="{
              image: {
                style: { 
                  objectFit: 'cover',
                  width: '120px',
                  height: '120px'
                }
              }
            }"
          />
          <div class="user-header-info">
            <h2 class="user-full-name">{{ selectedUser.first_name }} {{ selectedUser.last_name }}</h2>
            <div class="user-job-title">{{ selectedUser.job_title || 'No title' }}</div>
            <div class="user-tags">
              <Tag 
                :value="selectedUser.role" 
                :severity="getRoleSeverity(selectedUser.role)" 
              />
              <Tag 
                v-if="!selectedUser.is_active" 
                value="Inactive" 
                severity="danger" 
              />
            </div>
          </div>
        </div>

        <div class="user-details-content">
          <div class="user-info-section">
            <h3>Contact Information</h3>
            <div class="user-info-grid">
              <div class="info-group">
                <div class="info-label">Email</div>
                <div class="info-value">
                  <a :href="`mailto:${selectedUser.email}`">{{ selectedUser.email }}</a>
                </div>
              </div>
              <div v-if="selectedUser.phone" class="info-group">
                <div class="info-label">Phone</div>
                <div class="info-value">
                  <a :href="`tel:${selectedUser.phone}`">{{ selectedUser.phone }}</a>
                </div>
              </div>
            </div>
          </div>

          <div class="user-info-section">
            <h3>Organization</h3>
            <div class="user-info-grid">
              <div v-if="selectedUser.department_name" class="info-group">
                <div class="info-label">Department</div>
                <div class="info-value">{{ selectedUser.department_name }}</div>
              </div>
              <div v-if="selectedUser.manager_name" class="info-group">
                <div class="info-label">Manager</div>
                <div class="info-value">{{ selectedUser.manager_name }}</div>
              </div>
            </div>
          </div>

          <!-- Direct Reports section (if the user is a manager) -->
          <div v-if="directReports.length > 0" class="user-info-section">
            <h3>Direct Reports</h3>
            <div class="direct-reports-list">
              <div 
                v-for="report in directReports" 
                :key="report.id" 
                class="direct-report-item p-ripple"
                @click="viewUser(report)"
              >
                <Avatar 
                  :image="report.profile_image" 
                  size="small" 
                  shape="circle" 
                  :pt="{
                    image: {
                      style: { 
                        objectFit: 'cover',
                        width: '32px',
                        height: '32px'
                      }
                    }
                  }"
                />
                <div class="report-info">
                  <div class="report-name">{{ report.first_name }} {{ report.last_name }}</div>
                  <div class="report-title">{{ report.job_title || 'No title' }}</div>
                </div>
                <Button 
                  icon="pi pi-chevron-right" 
                  class="p-button-text p-button-rounded" 
                />
                <Ripple />
              </div>
            </div>
          </div>

          <!-- Account section -->
          <div class="user-info-section">
            <h3>Account</h3>
            <div class="user-info-grid">
              <div class="info-group">
                <div class="info-label">Last Login</div>
                <div class="info-value">
                  {{ selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Never' }}
                </div>
              </div>
              <div class="info-group">
                <div class="info-label">Created</div>
                <div class="info-value">{{ formatDate(selectedUser.created_at) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button 
          label="Close" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="userDetailsVisible = false" 
        />
        <Button 
          v-if="canEditUser" 
          label="Edit" 
          icon="pi pi-pencil" 
          @click="editFromDetails" 
        />
      </template>
    </Dialog>

    <!-- Confirm Dialog -->
    <ConfirmDialog />
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

// PrimeVue components
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Avatar from 'primevue/avatar';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import Dialog from 'primevue/dialog';
import Checkbox from 'primevue/checkbox';
import Password from 'primevue/password';
import Divider from 'primevue/divider';
import FileUpload from 'primevue/fileupload';
import Paginator from 'primevue/paginator';
import ConfirmDialog from 'primevue/confirmdialog';
import Ripple from 'primevue/ripple';

export default {
  name: 'UsersView',
  components: {
    Button,
    InputText,
    Dropdown,
    Avatar,
    Tag,
    ProgressSpinner,
    Dialog,
    Checkbox,
    Password,
    Divider,
    FileUpload,
    Paginator,
    ConfirmDialog,
    Ripple
  },
  directives: {
    ripple: Ripple
  },
  setup() {
    const store = useStore();
//    const router = useRouter();
    const confirm = useConfirm();
    const toast = useToast();

    // State
    const userDialogVisible = ref(false);
    const userDetailsVisible = ref(false);
    const dialogMode = ref('create');
    const saving = ref(false);
    const submitted = ref(false);
    const showPasswordFields = ref(false);
    const passwordMismatch = ref(false);
    const emailError = ref('');
    const profileImageError = ref('');
    const selectedProfileImage = ref(null);

    // Form state for user
    const userForm = reactive({
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      jobTitle: '',
      phone: '',
      departmentId: null,
      managerId: null,
      role: '',
      isActive: true,
      password: '',
      confirmPassword: '',
      profileImageUrl: null
    });

    // Options for roles filter
    const roleOptions = ref([
      { label: 'All Roles', value: '' },
      { label: 'Admin', value: 'admin' },
      { label: 'Manager', value: 'manager' },
      { label: 'Employee', value: 'employee' }
    ]);

    // Options for departments (should come from API in real app)
    const departments = ref([
      { id: '1', name: 'Finance' },
      { id: '2', name: 'Human Resources' },
      { id: '3', name: 'Marketing' },
      { id: '4', name: 'Engineering' },
      { id: '5', name: 'Operations' }
    ]);

    // List of managers for dropdown
    const managers = ref([]);

    // Computed properties
    const users = computed(() => store.state.users.users);
    const selectedUser = computed(() => store.state.users.currentUser);
    const directReports = computed(() => store.state.users.directReports);
    const isLoading = computed(() => store.state.users.isLoading);
    const pagination = computed(() => store.state.users.pagination);
    const filters = computed(() => store.state.users.filters);

    // Check if current user is admin
    const isAdmin = computed(() => {
      return store.getters['auth/isAdmin'];
    });

    // Check if the user can be edited by current user
    const canEditUser = computed(() => {
      if (!selectedUser.value) return false;
      
      // Admin can edit any user
      if (isAdmin.value) return true;
      
      // Users can edit their own profile
      const currentUserId = store.getters['auth/currentUser']?.id;
      return selectedUser.value.id === currentUserId;
    });

    // Format date
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    };

    // Get severity class for role tag
    const getRoleSeverity = (role) => {
      switch (role) {
        case 'admin': return 'danger';
        case 'manager': return 'warning';
        case 'employee': return 'info';
        default: return 'secondary';
      }
    };

    // Filter change handler
    const onFilterChange = () => {
      fetchUsers(1);
    };

    // Toggle active filter
    const toggleActiveFilter = () => {
      store.dispatch('users/setFilter', {
        key: 'isActive',
        value: filters.value.isActive !== false ? false : null
      });
      fetchUsers(1);
    };

    // Page change handler
    const onPageChange = (event) => {
      fetchUsers(event.page + 1, event.rows);
    };

    // Fetch users from API
    const fetchUsers = async (page = 1, limit = pagination.value.per_page) => {
      try {
        await store.dispatch('users/fetchUsers', { page, limit });
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load users',
          life: 3000
        });
      }
    };

    // Fetch managers list for dropdown
    const fetchManagers = async () => {
      try {
        const response = await store.dispatch('users/fetchUsers', {
          limit: 100,
          role: 'manager'
        });
        
        managers.value = response.data.map(user => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`
        }));
        
        // Add admins as potential managers too
        const adminResponse = await store.dispatch('users/fetchUsers', {
          limit: 100,
          role: 'admin'
        });
        
        adminResponse.data.forEach(user => {
          managers.value.push({
            id: user.id,
            name: `${user.first_name} ${user.last_name}`
          });
        });
      } catch (error) {
        console.error('Error fetching managers:', error);
      }
    };

    // Fetch direct reports for a user
    const fetchDirectReports = async (userId) => {
      try {
        await store.dispatch('users/fetchDirectReports', userId);
      } catch (error) {
        console.error('Error fetching direct reports:', error);
      }
    };

    // Open new user dialog
    const openNewUserDialog = () => {
      resetUserForm();
      dialogMode.value = 'create';
      userDialogVisible.value = true;
    };

    // Close user dialog
    const closeUserDialog = () => {
      userDialogVisible.value = false;
      submitted.value = false;
      passwordMismatch.value = false;
      emailError.value = '';
      profileImageError.value = '';
      showPasswordFields.value = false;
    };

    // Reset user form
    const resetUserForm = () => {
      Object.assign(userForm, {
        id: null,
        firstName: '',
        lastName: '',
        email: '',
        jobTitle: '',
        phone: '',
        departmentId: null,
        managerId: null,
        role: 'employee', // Default role
        isActive: true,
        password: '',
        confirmPassword: '',
        profileImageUrl: null
      });
    };

    // Handle profile image selection
    const onProfileImageSelect = (event) => {
      profileImageError.value = '';
      selectedProfileImage.value = event.files[0];
      
      // Generate a temporary URL for preview
      userForm.profileImageUrl = URL.createObjectURL(selectedProfileImage.value);
    };

    // Handle profile image error
    const onProfileImageError = (event) => {
      profileImageError.value = event.message;
    };

    // View a user
    const viewUser = async (userData) => {
      try {
        // Fetch fresh user data
        await store.dispatch('users/fetchUser', userData.id);
        
        // Fetch direct reports
        await fetchDirectReports(userData.id);
        
        // Show details dialog
        userDetailsVisible.value = true;
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load user details',
          life: 3000
        });
      }
    };

    // Edit from details view
    const editFromDetails = () => {
      if (!selectedUser.value) return;
      
      // Close details dialog
      userDetailsVisible.value = false;
      
      // Reset form
      resetUserForm();
      
      // Copy data to form
      userForm.id = selectedUser.value.id;
      userForm.firstName = selectedUser.value.first_name;
      userForm.lastName = selectedUser.value.last_name;
      userForm.email = selectedUser.value.email;
      userForm.jobTitle = selectedUser.value.job_title || '';
      userForm.phone = selectedUser.value.phone || '';
      userForm.departmentId = selectedUser.value.department_id;
      userForm.managerId = selectedUser.value.manager_id;
      userForm.role = selectedUser.value.role;
      userForm.isActive = selectedUser.value.is_active;
      userForm.profileImageUrl = selectedUser.value.profile_image;
      
      // Show edit dialog
      dialogMode.value = 'edit';
      userDialogVisible.value = true;
    };

    // Confirm delete user
    const confirmDeleteUser = () => {
      confirm.require({
        message: 'Are you sure you want to delete this user?',
        header: 'Delete Confirmation',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteUser(),
        reject: () => {}
      });
    };

    // Delete user
    const deleteUser = async () => {
      if (!userForm.id) return;
      
      try {
        saving.value = true;
        
        // Delete user via API
        await store.dispatch('users/deleteUser', userForm.id);
        
        // Close dialog
        userDialogVisible.value = false;
        
        // Show success toast
        toast.add({
          severity: 'success',
          summary: 'User Deleted',
          detail: 'User has been deleted successfully',
          life: 3000
        });
        
        // Refresh list
        fetchUsers();
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete user',
          life: 3000
        });
      } finally {
        saving.value = false;
      }
    };

    // Save user (create or update)
    const saveUser = async () => {
      submitted.value = true;
      passwordMismatch.value = false;
      emailError.value = '';
      
      // Validate required fields
      if (!userForm.firstName || !userForm.lastName || !userForm.email) {
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userForm.email)) {
        emailError.value = 'Please enter a valid email address.';
        return;
      }
      
      // Validate role if admin
      if (isAdmin.value && !userForm.role) {
        return;
      }
      
      // Validate password for new users
      if (dialogMode.value === 'create' && !userForm.password) {
        return;
      }
      
      // Validate password confirmation
      if ((dialogMode.value === 'create' || (dialogMode.value === 'edit' && userForm.password)) &&
          userForm.password !== userForm.confirmPassword) {
        passwordMismatch.value = true;
        return;
      }
      
      saving.value = true;
      
      try {
        // Prepare user data
        const userData = {
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          jobTitle: userForm.jobTitle,
          phone: userForm.phone,
          departmentId: userForm.departmentId,
          managerId: userForm.managerId,
          role: userForm.role,
          isActive: userForm.isActive
        };
        
        // Add email and password for new users
        if (dialogMode.value === 'create') {
          userData.email = userForm.email;
          userData.password = userForm.password;
        }
        
        // Add password if changing it
        if (dialogMode.value === 'edit' && userForm.password) {
          userData.password = userForm.password;
        }
        
        let savedUser;
        
        if (dialogMode.value === 'create') {
          // Create new user
          savedUser = await store.dispatch('users/createUser', userData);
        } else {
          // Update existing user
          savedUser = await store.dispatch('users/updateUser', {
            id: userForm.id,
            ...userData
          });
        }
        
        // Handle profile image upload if selected
        if (selectedProfileImage.value && savedUser) {
          await store.dispatch('users/uploadProfileImage', {
            id: savedUser.id,
            imageFile: selectedProfileImage.value
          });
        }
        
        // Close dialog
        userDialogVisible.value = false;
        submitted.value = false;
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: dialogMode.value === 'create' ? 'User Created' : 'User Updated',
          detail: dialogMode.value === 'create' ? 'User has been created successfully' : 'User has been updated successfully',
          life: 3000
        });
        
        // Refresh user list
        fetchUsers();
      } catch (error) {
        console.error('Error saving user:', error);
        
        const errorMsg = error.response?.data?.message || 'Failed to save user';
        
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMsg,
          life: 3000
        });
      } finally {
        saving.value = false;
      }
    };

    // Initialize component
    onMounted(() => {
      // Load initial data
      fetchUsers();
      fetchManagers();
      
      // Load departments (in a real app, this would come from an API)
      store.dispatch('departments/fetchDepartments')
        .then(response => {
          if (response && response.data) {
            departments.value = response.data.map(dept => ({
              id: dept.id,
              name: dept.name
            }));
          }
        })
        .catch(error => {
          console.error('Error loading departments:', error);
        });
    });

    return {
      users,
      selectedUser,
      directReports,
      isLoading,
      userDialogVisible,
      userDetailsVisible,
      dialogMode,
      saving,
      submitted,
      showPasswordFields,
      passwordMismatch,
      emailError,
      profileImageError,
      pagination,
      filters,
      userForm,
      roleOptions,
      departments,
      managers,
      isAdmin,
      canEditUser,
      
      // Methods
      formatDate,
      getRoleSeverity,
      onFilterChange,
      toggleActiveFilter,
      onPageChange,
      openNewUserDialog,
      closeUserDialog,
      onProfileImageSelect,
      onProfileImageError,
      viewUser,
      editFromDetails,
      confirmDeleteUser,
      deleteUser,
      saveUser
    };
  }
};
</script>

<style scoped>
.users-container {
  padding: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
}

/* User filters */
.user-filters {
  margin-bottom: 1.5rem;
}

/* Loading container */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
}

/* Empty state */
.empty-message {
  text-align: center;
  padding: 2rem;
  color: var(--text-color-secondary);
}

.empty-message i {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

/* User list styling */
.user-list {
  margin-top: 1rem;
}

.user-card {
  background-color: var(--surface-card);
  border-radius: 0.5rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  margin-bottom: 1.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
  position: relative;
}

.user-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.user-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.user-info {
  margin-left: 1rem;
}

.user-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.user-title {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.user-card-content {
  margin-bottom: 1rem;
}

.user-detail {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.user-detail i {
  margin-right: 0.5rem;
  color: var(--primary-color);
  width: 1rem;
  text-align: center;
}

.user-card-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.inactive-user {
  opacity: 0.7;
}

/* User paginator */
.user-paginator {
  margin-top: 1.5rem;
}

/* Profile image upload */
.profile-image-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
}

.profile-image-container {
  position: relative;
  margin-bottom: 0.5rem;
}

.profile-upload-overlay {
  position: absolute;
  bottom: 0;
  right: 0;
}

.profile-upload-button {
  width: 2rem !important;
  height: 2rem !important;
}

/* User details dialog */
.user-details-header {
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
}

.user-header-info {
  margin-left: 1.5rem;
}

.user-full-name {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.user-job-title {
  color: var(--text-color-secondary);
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.user-tags {
  display: flex;
  gap: 0.5rem;
}

.user-info-section {
  margin-bottom: 1.5rem;
}

.user-info-section h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
  color: var(--text-color);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.user-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.info-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 1rem;
  color: var(--text-color);
}

.info-value a {
  color: var(--primary-color);
  text-decoration: none;
}

.info-value a:hover {
  text-decoration: underline;
}

/* Direct reports list */
.direct-reports-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.direct-report-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background-color: var(--surface-ground);
  border-radius: 0.375rem;
  transition: background-color 0.2s;
  cursor: pointer;
  position: relative;
}

.direct-report-item:hover {
  background-color: var(--surface-hover);
}

.report-info {
  margin-left: 0.75rem;
  flex: 1;
}

.report-name {
  font-weight: 500;
}

.report-title {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* Responsive adaptations */
@media screen and (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .user-details-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .user-header-info {
    margin-left: 0;
    margin-top: 1rem;
  }
  
  .user-info-grid {
    grid-template-columns: 1fr;
  }
  
  .user-tags {
    justify-content: center;
  }
}
</style>