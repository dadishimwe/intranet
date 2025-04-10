<template>
  <div class="expenses-container">
    <div class="page-header">
      <h1 class="page-title">Expenses</h1>
      <div class="page-actions">
        <Button 
          label="New Expense" 
          icon="pi pi-plus" 
          @click="openNewExpenseDialog"
          class="p-button-primary"
        />
      </div>
    </div>

    <!-- Expense stats summary cards -->
    <div class="grid expense-stats">
      <div class="col-12 md:col-6 lg:col-3">
        <div class="card summary-card">
          <div class="summary-title">Draft</div>
          <div class="summary-value">{{ formatCurrency(stats.draft?.total_amount || 0) }}</div>
          <div class="summary-count">{{ stats.draft?.count || 0 }} expenses</div>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="card summary-card">
          <div class="summary-title">Submitted</div>
          <div class="summary-value">{{ formatCurrency(stats.submitted?.total_amount || 0) }}</div>
          <div class="summary-count">{{ stats.submitted?.count || 0 }} expenses</div>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="card summary-card">
          <div class="summary-title">Approved</div>
          <div class="summary-value">{{ formatCurrency(stats.approved?.total_amount || 0) }}</div>
          <div class="summary-count">{{ stats.approved?.count || 0 }} expenses</div>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="card summary-card">
          <div class="summary-title">Paid</div>
          <div class="summary-value">{{ formatCurrency(stats.paid?.total_amount || 0) }}</div>
          <div class="summary-count">{{ stats.paid?.count || 0 }} expenses</div>
        </div>
      </div>
    </div>

    <!-- Expense filters and table -->
    <div class="card">
      <div class="expense-filters">
        <div class="grid">
          <div class="col-12 md:col-3">
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search" />
              <InputText 
                v-model="filters.search" 
                placeholder="Search expenses" 
                class="w-full"
                @input="onFilterChange"
              />
            </span>
          </div>
          <div class="col-12 md:col-3">
            <Dropdown
              v-model="filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
              @change="onFilterChange"
            />
          </div>
          <div class="col-12 md:col-3">
            <Dropdown
              v-model="filters.category"
              :options="categoryOptions"
              optionLabel="name"
              optionValue="name"
              placeholder="Category"
              class="w-full"
              @change="onFilterChange"
            />
          </div>
          <div class="col-12 md:col-3">
            <Calendar
              v-model="filters.dateRange"
              selectionMode="range"
              placeholder="Date range"
              class="w-full"
              @date-select="onFilterChange"
            />
          </div>
        </div>
      </div>

      <!-- Loading spinner -->
      <div v-if="loading" class="loading-container">
        <ProgressSpinner />
      </div>

      <!-- Expense table -->
      <DataTable 
        v-else
        :value="expenses" 
        :paginator="true" 
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50]"
        tableStyle="min-width: 50rem"
        paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} expenses"
        responsiveLayout="scroll"
        :loading="tableLoading"
        sortField="date"
        :sortOrder="-1"
        v-model:selection="selectedExpenses"
        dataKey="id"
        @rowSelect="onExpenseSelect"
        @rowUnselect="onExpenseUnselect"
        class="expense-table"
      >
        <template #empty>
          <div class="empty-message">
            <i class="pi pi-money-bill"></i>
            <p>No expenses found</p>
          </div>
        </template>

        <Column selectionMode="single" style="width: 3rem" :exportable="false"></Column>
        
        <Column field="date" header="Date" sortable>
          <template #body="slotProps">
            {{ formatDate(slotProps.data.date) }}
          </template>
        </Column>

        <Column field="description" header="Description" sortable></Column>

        <Column field="category" header="Category" sortable>
          <template #body="slotProps">
            <Tag :value="slotProps.data.category" :severity="getCategorySeverity(slotProps.data.category)" />
          </template>
        </Column>

        <Column field="amount" header="Amount" sortable>
          <template #body="slotProps">
            {{ formatCurrency(slotProps.data.amount) }}
          </template>
        </Column>

        <Column field="status" header="Status" sortable>
          <template #body="slotProps">
            <Tag 
              :value="formatStatus(slotProps.data.status)" 
              :severity="getStatusSeverity(slotProps.data.status)" 
            />
          </template>
        </Column>

        <Column header="Actions" style="width: 8rem">
          <template #body="slotProps">
            <div class="action-buttons">
              <Button 
                icon="pi pi-eye" 
                class="p-button-rounded p-button-text" 
                @click="viewExpense(slotProps.data)" 
                tooltip="View" 
                :tooltipOptions="{ position: 'top' }"
              />
              <Button 
                v-if="canEditExpense(slotProps.data)" 
                icon="pi pi-pencil" 
                class="p-button-rounded p-button-text" 
                @click="editExpense(slotProps.data)" 
                tooltip="Edit" 
                :tooltipOptions="{ position: 'top' }"
              />
              <Button 
                v-if="canDeleteExpense(slotProps.data)" 
                icon="pi pi-trash" 
                class="p-button-rounded p-button-text p-button-danger" 
                @click="confirmDeleteExpense(slotProps.data)" 
                tooltip="Delete" 
                :tooltipOptions="{ position: 'top' }"
              />
            </div>
          </template>
        </Column>
      </DataTable>

      <!-- Paginator controls -->
      <div class="pagination-controls">
        <div class="pagination-summary">
          {{ paginationSummary }}
        </div>
      </div>
    </div>

    <!-- Expense Dialog -->
    <Dialog 
      v-model:visible="expenseDialogVisible" 
      :style="{ width: '500px' }" 
      :header="dialogMode === 'create' ? 'New Expense' : 'Edit Expense'" 
      :modal="true" 
      class="p-fluid expense-dialog"
    >
      <div class="expense-form">
        <div class="field">
          <label for="amount">Amount *</label>
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon">$</span>
            <InputNumber 
              id="amount" 
              v-model="expense.amount" 
              mode="decimal" 
              :minFractionDigits="2" 
              :maxFractionDigits="2" 
              required 
              :class="{ 'p-invalid': submitted && !expense.amount }"
            />
          </div>
          <small v-if="submitted && !expense.amount" class="p-error">Amount is required.</small>
        </div>

        <div class="field">
          <label for="date">Date *</label>
          <Calendar 
            id="date" 
            v-model="expense.date" 
            dateFormat="mm/dd/yy" 
            :showIcon="true" 
            required 
            :class="{ 'p-invalid': submitted && !expense.date }"
          />
          <small v-if="submitted && !expense.date" class="p-error">Date is required.</small>
        </div>

        <div class="field">
          <label for="description">Description *</label>
          <Textarea 
            id="description" 
            v-model="expense.description" 
            rows="3" 
            autoResize 
            required 
            :class="{ 'p-invalid': submitted && !expense.description }"
          />
          <small v-if="submitted && !expense.description" class="p-error">Description is required.</small>
        </div>

        <div class="field">
          <label for="category">Category *</label>
          <Dropdown 
            id="category" 
            v-model="expense.category" 
            :options="categoryOptions" 
            optionLabel="name" 
            optionValue="name" 
            placeholder="Select a category" 
            required 
            :class="{ 'p-invalid': submitted && !expense.category }"
          />
          <small v-if="submitted && !expense.category" class="p-error">Category is required.</small>
        </div>

        <div class="field">
          <label for="receipt">Receipt</label>
          <div class="p-fileupload-content">
            <FileUpload 
              ref="fileUpload"
              mode="basic" 
              name="receipt" 
              accept="image/*,application/pdf" 
              :maxFileSize="5000000" 
              chooseLabel="Select Receipt" 
              class="p-button-outlined w-full"
              @select="onFileSelect"
              @error="onFileError"
            />
          </div>
          <small v-if="fileError" class="p-error">{{ fileError }}</small>
          
          <!-- Preview of existing receipt -->
          <div v-if="expense.receiptPath && !selectedFile" class="receipt-preview">
            <div class="receipt-preview-info">
              <i class="pi pi-file-pdf" v-if="isReceiptPdf"></i>
              <i class="pi pi-image" v-else></i>
              <span>Current receipt</span>
            </div>
            <Button 
              icon="pi pi-download" 
              class="p-button-text p-button-sm" 
              @click="downloadReceipt"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button 
          label="Cancel" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="closeExpenseDialog" 
        />
        <Button 
          v-if="dialogMode === 'edit' && canDeleteExpense(expense)" 
          label="Delete" 
          icon="pi pi-trash" 
          class="p-button-danger mr-2" 
          @click="confirmDeleteExpense(expense)" 
        />
        <Button 
          label="Save" 
          icon="pi pi-check" 
          @click="saveExpense" 
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- Expense Details Dialog -->
    <Dialog 
      v-model:visible="expenseDetailsVisible" 
      :style="{ width: '650px' }" 
      :header="selectedExpense ? `Expense: ${formatCurrency(selectedExpense.amount)}` : 'Expense Details'" 
      :modal="true"
      class="expense-details-dialog"
    >
      <div v-if="selectedExpense" class="expense-details">
        <div class="expense-header">
          <div class="expense-amount">
            <span class="amount-value">{{ formatCurrency(selectedExpense.amount) }}</span>
            <span class="currency">{{ selectedExpense.currency || 'USD' }}</span>
          </div>
          <Tag 
            :value="formatStatus(selectedExpense.status)" 
            :severity="getStatusSeverity(selectedExpense.status)" 
            class="status-tag"
          />
        </div>

        <div class="expense-info-grid">
          <div class="info-group">
            <div class="info-label">Date</div>
            <div class="info-value">{{ formatDate(selectedExpense.date) }}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Category</div>
            <div class="info-value">
              <Tag :value="selectedExpense.category" :severity="getCategorySeverity(selectedExpense.category)" />
            </div>
          </div>
          <div v-if="selectedExpense.user_name" class="info-group">
            <div class="info-label">Submitted By</div>
            <div class="info-value">{{ selectedExpense.user_name }}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Created</div>
            <div class="info-value">{{ formatDate(selectedExpense.created_at) }}</div>
          </div>
        </div>

        <Divider />

        <div class="description-section">
          <h3>Description</h3>
          <div class="description-content">{{ selectedExpense.description }}</div>
        </div>

        <div v-if="selectedExpense.receipt_path" class="receipt-section">
          <Divider />
          <h3>Receipt</h3>
          <div class="receipt-actions">
            <Button 
              label="View Receipt" 
              icon="pi pi-eye" 
              class="p-button-outlined" 
              @click="viewReceipt" 
            />
            <Button 
              label="Download" 
              icon="pi pi-download" 
              class="p-button-text" 
              @click="downloadReceiptFromDetails" 
            />
          </div>
        </div>

        <div v-if="selectedExpense.approvals && selectedExpense.approvals.length > 0" class="approvals-section">
          <Divider />
          <h3>Approval History</h3>
          <Timeline :value="formattedApprovals" class="approval-timeline">
            <template #content="slotProps">
              <div class="approval-item">
                <small class="approval-date">{{ formatDate(slotProps.item.date) }}</small>
                <div class="approval-content">
                  <div class="approval-description">
                    <span class="approval-user">{{ slotProps.item.user }}</span>
                    <span> {{ slotProps.item.action }} </span>
                  </div>
                  <div v-if="slotProps.item.comments" class="approval-comments">
                    "{{ slotProps.item.comments }}"
                  </div>
                </div>
              </div>
            </template>
            <template #opposite="slotProps">
              <Tag 
                :value="slotProps.item.status" 
                :severity="getStatusSeverity(slotProps.item.status)" 
              />
            </template>
          </Timeline>
        </div>

        <!-- Action buttons for expense workflow -->
        <div v-if="showExpenseActions" class="expense-actions">
          <Divider />
          <h3>Actions</h3>
          <div class="expense-workflow-buttons">
            <!-- Submit button (for draft expenses) -->
            <Button 
              v-if="canSubmitExpense"
              label="Submit for Approval" 
              icon="pi pi-send" 
              class="p-button-success" 
              @click="submitExpense" 
              :loading="processingAction"
            />

            <!-- Approval buttons (for managers reviewing expenses) -->
            <div v-if="canReviewExpense" class="review-buttons">
              <Button 
                label="Approve" 
                icon="pi pi-check" 
                class="p-button-success mr-2" 
                @click="approveExpense" 
                :loading="processingAction"
              />
              <Button 
                label="Reject" 
                icon="pi pi-times" 
                class="p-button-danger" 
                @click="openRejectDialog" 
                :loading="processingAction"
              />
            </div>

            <!-- Payment button (for admins) -->
            <Button 
              v-if="canMarkAsPaid"
              label="Mark as Paid" 
              icon="pi pi-check-circle" 
              class="p-button-primary" 
              @click="markAsPaid" 
              :loading="processingAction"
            />

            <!-- Edit button (if the expense can be edited) -->
            <Button 
              v-if="canEditExpense(selectedExpense)"
              label="Edit Expense" 
              icon="pi pi-pencil" 
              class="p-button-secondary" 
              @click="editFromDetails" 
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button 
          label="Close" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="expenseDetailsVisible = false" 
        />
      </template>
    </Dialog>

    <!-- Reject Dialog -->
    <Dialog 
      v-model:visible="rejectDialogVisible" 
      :style="{ width: '450px' }" 
      header="Reject Expense" 
      :modal="true"
      class="p-fluid"
    >
      <div class="reject-form">
        <div class="field">
          <label for="rejectReason">Reason for Rejection</label>
          <Textarea 
            id="rejectReason" 
            v-model="rejectReason" 
            rows="3" 
            autoResize 
            placeholder="Please provide a reason for rejecting this expense"
          />
        </div>
      </div>

      <template #footer>
        <Button 
          label="Cancel" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="rejectDialogVisible = false" 
        />
        <Button 
          label="Reject" 
          icon="pi pi-times" 
          class="p-button-danger" 
          @click="rejectExpense" 
          :loading="processingAction"
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
import Calendar from 'primevue/calendar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import FileUpload from 'primevue/fileupload';
import Divider from 'primevue/divider';
import Timeline from 'primevue/timeline';
import ConfirmDialog from 'primevue/confirmdialog';

export default {
  name: 'ExpensesView',
  components: {
    Button,
    InputText,
    Dropdown,
    Calendar,
    DataTable,
    Column,
    Tag,
    ProgressSpinner,
    Dialog,
    InputNumber,
    Textarea,
    FileUpload,
    Divider,
    Timeline,
    ConfirmDialog
  },
  setup() {
    const store = useStore();
    const router = useRouter();
    const confirm = useConfirm();
    const toast = useToast();
    const fileUpload = ref(null);

    // State
    const loading = ref(true);
    const tableLoading = ref(false);
    const expenses = ref([]);
    const stats = ref({});
    const selectedExpenses = ref(null);
    const selectedExpense = ref(null);
    const expenseDialogVisible = ref(false);
    const expenseDetailsVisible = ref(false);
    const rejectDialogVisible = ref(false);
    const dialogMode = ref('create');
    const saving = ref(false);
    const submitted = ref(false);
    const processingAction = ref(false);
    const rejectReason = ref('');
    const selectedFile = ref(null);
    const fileError = ref('');

    // Pagination state
    const pagination = ref({
      page: 1,
      rows: 10,
      totalRecords: 0
    });

    // Filter state
    const filters = reactive({
      search: '',
      status: null,
      dateRange: null,
      category: null
    });

    // Form state
    const expense = reactive({
      id: null,
      amount: null,
      currency: 'USD',
      date: null,
      description: '',
      category: null,
      receiptPath: null,
      status: 'draft'
    });

    // Options for status filter
    const statusOptions = [
      { label: 'All Statuses', value: null },
      { label: 'Draft', value: 'draft' },
      { label: 'Submitted', value: 'submitted' },
      { label: 'Approved', value: 'approved' },
      { label: 'Rejected', value: 'rejected' },
      { label: 'Paid', value: 'paid' }
    ];

    // Options for category filter (hardcoded for now, should come from API)
    const categoryOptions = [
      { name: 'Travel' },
      { name: 'Meals' },
      { name: 'Office Supplies' },
      { name: 'Training' },
      { name: 'Other' }
    ];

    // Format status for display
    const formatStatus = (status) => {
      if (!status) return '';
      return status.charAt(0).toUpperCase() + status.slice(1);
    };

    // Format currency
    const formatCurrency = (amount) => {
      if (amount === undefined || amount === null) return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };

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

    // Get severity class for status tag
    const getStatusSeverity = (status) => {
      switch (status) {
        case 'draft': return 'info';
        case 'submitted': return 'warning';
        case 'approved': return 'success';
        case 'rejected': return 'danger';
        case 'paid': return 'success';
        default: return 'info';
      }
    };

    // Get severity class for category tag
    const getCategorySeverity = (category) => {
      switch (category) {
        case 'Travel': return 'info';
        case 'Meals': return 'success';
        case 'Office Supplies': return 'warning';
        case 'Training': return 'primary';
        default: return 'secondary';
      }
    };

    // Check if the current user can edit an expense
    const canEditExpense = (expenseData) => {
      if (!expenseData) return false;
      
      // Only draft and rejected expenses can be edited
      if (!['draft', 'rejected'].includes(expenseData.status)) return false;
      
      // Admin can edit any expense
      if (store.getters['auth/isAdmin']) return true;
      
      // User can edit their own expenses
      const currentUserId = store.getters['auth/currentUser']?.id;
      return expenseData.user_id === currentUserId;
    };

    // Check if the current user can delete an expense
    const canDeleteExpense = (expenseData) => {
      if (!expenseData) return false;
      
      // Only draft and rejected expenses can be deleted
      if (!['draft', 'rejected'].includes(expenseData.status)) return false;
      
      // Admin can delete any expense
      if (store.getters['auth/isAdmin']) return true;
      
      // User can delete their own expenses
      const currentUserId = store.getters['auth/currentUser']?.id;
      return expenseData.user_id === currentUserId;
    };

    // Pagination summary text
    const paginationSummary = computed(() => {
      const { page, rows, totalRecords } = pagination.value;
      const first = (page - 1) * rows + 1;
      const last = Math.min(page * rows, totalRecords);
      return `Showing ${first} to ${last} of ${totalRecords} expenses`;
    });

    // Check if user can submit the selected expense
    const canSubmitExpense = computed(() => {
      if (!selectedExpense.value) return false;
      if (selectedExpense.value.status !== 'draft') return false;
      
      // Only the owner can submit their expense
      const currentUserId = store.getters['auth/currentUser']?.id;
      return selectedExpense.value.user_id === currentUserId;
    });

    // Check if user can review (approve/reject) the selected expense
    const canReviewExpense = computed(() => {
      if (!selectedExpense.value) return false;
      if (selectedExpense.value.status !== 'submitted') return false;
      
      // Admin can approve any expense
      if (store.getters['auth/isAdmin']) return true;
      
      // Managers can approve expenses of their direct reports
      if (store.getters['auth/isManager']) {
        // In a real app, we would check if the expense is from a direct report
        // For now, we'll simulate this
        return selectedExpense.value.user_manager_id === store.getters['auth/currentUser']?.id;
      }
      
      return false;
    });

    // Check if user can mark the expense as paid
    const canMarkAsPaid = computed(() => {
      if (!selectedExpense.value) return false;
      if (selectedExpense.value.status !== 'approved') return false;
      
      // Only admin can mark as paid
      return store.getters['auth/isAdmin'];
    });

    // Show actions section if user can perform any action on this expense
    const showExpenseActions = computed(() => {
      return canSubmitExpense.value || canReviewExpense.value || 
             canMarkAsPaid.value || canEditExpense(selectedExpense.value);
    });

    // Format approvals for timeline
    const formattedApprovals = computed(() => {
      if (!selectedExpense.value || !selectedExpense.value.approvals) return [];
      
      return selectedExpense.value.approvals.map(approval => ({
        status: approval.status,
        date: approval.updated_at || approval.created_at,
        user: approval.approver_name,
        action: getApprovalAction(approval.status),
        comments: approval.comments
      }));
    });

    // Determine action text for approval status
    const getApprovalAction = (status) => {
      switch (status) {
        case 'approved': return 'approved this expense';
        case 'rejected': return 'rejected this expense';
        case 'pending': return 'needs to review this expense';
        default: return 'reviewed this expense';
      }
    };

    // Check if receipt is PDF
    const isReceiptPdf = computed(() => {
      if (!selectedExpense.value || !selectedExpense.value.receipt_path) return false;
      return selectedExpense.value.receipt_path.toLowerCase().endsWith('.pdf');
    });

    // Filter change handler
    const onFilterChange = () => {
      fetchExpenses();
    };

    // Fetch expenses from API
    const fetchExpenses = async () => {
      tableLoading.value = true;
      
      try {
        // Build query parameters
        const params = {
          page: pagination.value.page,
          limit: pagination.value.rows
        };
        
        // Add filters if set
        if (filters.search) params.search = filters.search;
        if (filters.status) params.status = filters.status;
        if (filters.category) params.category = filters.category;
        
        // Add date range if selected
        if (filters.dateRange && Array.isArray(filters.dateRange) && filters.dateRange.length === 2) {
          params.startDate = filters.dateRange[0].toISOString().split('T')[0];
          params.endDate = filters.dateRange[1].toISOString().split('T')[0];
        }
        
        // In a real app, this would be an API call
        // For now, we'll use mock data
        const response = await mockFetchExpenses(params);
        
        expenses.value = response.data;
        pagination.value.totalRecords = response.pagination.total;
      } catch (error) {
        console.error('Error fetching expenses:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load expenses',
          life: 3000
        });
      } finally {
        tableLoading.value = false;
      }
    };

    // Fetch expense statistics
    const fetchExpenseStats = async () => {
      try {
        // In a real app, this would be an API call
        // For now, we'll use mock data
        const response = await mockFetchExpenseStats();
        stats.value = response;
      } catch (error) {
        console.error('Error fetching expense stats:', error);
      }
    };

    // Mock function to fetch expenses
    const mockFetchExpenses = (params) => {
      return new Promise(resolve => {
        setTimeout(() => {
          // Generate mock data
          const mockData = [
            {
              id: '1',
              amount: 125.50,
              currency: 'USD',
              date: new Date(2025, 3, 5),
              description: 'Business lunch with clients',
              category: 'Meals',
              receipt_path: '/uploads/receipts/receipt1.pdf',
              status: 'approved',
              user_id: '1',
              user_name: 'John Doe',
              user_email: 'john@example.com',
              created_at: new Date(2025, 3, 4),
              updated_at: new Date(2025, 3, 5),
              approvals: [
                {
                  id: '101',
                  status: 'approved',
                  approver_id: '2',
                  approver_name: 'Jane Smith',
                  comments: 'Approved as per company policy',
                  created_at: new Date(2025, 3, 5)
                }
              ]
            },
            {
              id: '2',
              amount: 450.00,
              currency: 'USD',
              date: new Date(2025, 3, 2),
              description: 'Conference registration fee',
              category: 'Training',
              receipt_path: '/uploads/receipts/receipt2.pdf',
              status: 'submitted',
              user_id: '1',
              user_name: 'John Doe',
              user_email: 'john@example.com',
              created_at: new Date(2025, 3, 1),
              updated_at: new Date(2025, 3, 2)
            },
            {
              id: '3',
              amount: 89.99,
              currency: 'USD',
              date: new Date(2025, 3, 1),
              description: 'Office supplies - printer ink',
              category: 'Office Supplies',
              receipt_path: '/uploads/receipts/receipt3.jpg',
              status: 'draft',
              user_id: '1',
              user_name: 'John Doe',
              user_email: 'john@example.com',
              created_at: new Date(2025, 3, 1)
            }
          ];
          
          // Filter data based on params
          let filteredData = [...mockData];
          
          if (params.status) {
            filteredData = filteredData.filter(expense => expense.status === params.status);
          }
          
          if (params.category) {
            filteredData = filteredData.filter(expense => expense.category === params.category);
          }
          
          if (params.search) {
            const search = params.search.toLowerCase();
            filteredData = filteredData.filter(expense => 
              expense.description.toLowerCase().includes(search) ||
              expense.category.toLowerCase().includes(search) ||
              expense.user_name.toLowerCase().includes(search)
            );
          }
          
          if (params.startDate && params.endDate) {
            const startDate = new Date(params.startDate);
            const endDate = new Date(params.endDate);
            filteredData = filteredData.filter(expense => {
              const expenseDate = new Date(expense.date);
              return expenseDate >= startDate && expenseDate <= endDate;
            });
          }
          
          // Calculate pagination
          const total = filteredData.length;
          const start = (params.page - 1) * params.limit;
          const end = start + params.limit;
          const paginatedData = filteredData.slice(start, end);
          
          resolve({
            data: paginatedData,
            pagination: {
              total,
              per_page: params.limit,
              current_page: params.page,
              last_page: Math.ceil(total / params.limit)
            }
          });
        }, 500);
      });
    };

    // Mock function to fetch expense statistics
    const mockFetchExpenseStats = () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            draft: {
              count: 2,
              total_amount: 120.50
            },
            submitted: {
              count: 1,
              total_amount: 450.00
            },
            approved: {
              count: 3,
              total_amount: 725.75
            },
            rejected: {
              count: 1,
              total_amount: 50.25
            },
            paid: {
              count: 2,
              total_amount: 600.25
            }
          });
        }, 300);
      });
    };

    // Open new expense dialog
    const openNewExpenseDialog = () => {
      resetExpenseForm();
      expense.date = new Date(); // Set default date to today
      dialogMode.value = 'create';
      expenseDialogVisible.value = true;
    };

    // Close expense dialog
    const closeExpenseDialog = () => {
      expenseDialogVisible.value = false;
      submitted.value = false;
      fileError.value = '';
      selectedFile.value = null;
      if (fileUpload.value) {
        fileUpload.value.clear();
      }
    };

    // Reset expense form
    const resetExpenseForm = () => {
      expense.id = null;
      expense.amount = null;
      expense.currency = 'USD';
      expense.date = null;
      expense.description = '';
      expense.category = null;
      expense.receiptPath = null;
      expense.status = 'draft';
    };

    // Handle file selection
    const onFileSelect = (event) => {
      fileError.value = '';
      selectedFile.value = event.files[0];
    };

    // Handle file upload error
    const onFileError = (event) => {
      fileError.value = event.message;
    };

    // View an expense
    const viewExpense = (expenseData) => {
      selectedExpense.value = expenseData;
      expenseDetailsVisible.value = true;
    };

    // Edit an expense
    const editExpense = (expenseData) => {
      resetExpenseForm();
      
      // Copy data to form
      expense.id = expenseData.id;
      expense.amount = expenseData.amount;
      expense.currency = expenseData.currency || 'USD';
      expense.date = new Date(expenseData.date);
      expense.description = expenseData.description;
      expense.category = expenseData.category;
      expense.receiptPath = expenseData.receipt_path;
      expense.status = expenseData.status;
      
      dialogMode.value = 'edit';
      expenseDialogVisible.value = true;
    };

    // Edit from details view
    const editFromDetails = () => {
      if (!selectedExpense.value) return;
      
      // Close details dialog
      expenseDetailsVisible.value = false;
      
      // Edit the expense
      editExpense(selectedExpense.value);
    };

    // Confirm delete expense
    const confirmDeleteExpense = (expenseData) => {
      confirm.require({
        message: 'Are you sure you want to delete this expense?',
        header: 'Delete Confirmation',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteExpense(expenseData),
        reject: () => {}
      });
    };

    // Delete expense
    const deleteExpense = async (expenseData) => {
      if (!expenseData || !expenseData.id) return;
      
      try {
        // Close dialogs if open
        expenseDialogVisible.value = false;
        expenseDetailsVisible.value = false;
        
        // In a real app, this would be an API call
        // For now, we'll simulate success
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Remove from local array
        expenses.value = expenses.value.filter(e => e.id !== expenseData.id);
        
        // Update selection if needed
        if (selectedExpense.value && selectedExpense.value.id === expenseData.id) {
          selectedExpense.value = null;
        }
        
        // Show success toast
        toast.add({
          severity: 'success',
          summary: 'Expense Deleted',
          detail: 'Expense has been deleted successfully',
          life: 3000
        });
        
        // Refresh stats
        fetchExpenseStats();
      } catch (error) {
        console.error('Error deleting expense:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete expense',
          life: 3000
        });
      }
    };

    // Save expense (create or update)
    const saveExpense = async () => {
      submitted.value = true;
      
      // Validate form
      if (!expense.amount || !expense.date || !expense.description || !expense.category) {
        return;
      }
      
      saving.value = true;
      
      try {
        // Prepare form data for API submission
        const formData = new FormData();
        formData.append('amount', expense.amount);
        formData.append('currency', expense.currency);
        formData.append('date', expense.date.toISOString().split('T')[0]);
        formData.append('description', expense.description);
        formData.append('category', expense.category);
        
        if (selectedFile.value) {
          formData.append('receipt', selectedFile.value);
        }
        
        // In a real app, this would be an API call
        // For now, we'll simulate success
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate mock response data
        const savedExpense = {
          id: expense.id || Math.random().toString(36).substring(2, 11),
          amount: expense.amount,
          currency: expense.currency,
          date: expense.date,
          description: expense.description,
          category: expense.category,
          receipt_path: selectedFile.value ? `/uploads/receipts/mock-${selectedFile.value.name}` : expense.receiptPath,
          status: expense.status,
          user_id: store.getters['auth/currentUser'].id,
          user_name: store.getters['auth/userFullName'],
          created_at: new Date(),
          updated_at: new Date()
        };
        
        // Update local data
        if (expense.id) {
          // Update existing record
          const index = expenses.value.findIndex(e => e.id === expense.id);
          if (index !== -1) {
            expenses.value[index] = savedExpense;
          }
        } else {
          // Add new record
          expenses.value.unshift(savedExpense);
        }
        
        // Close dialog
        expenseDialogVisible.value = false;
        submitted.value = false;
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: dialogMode.value === 'create' ? 'Expense Created' : 'Expense Updated',
          detail: dialogMode.value === 'create' ? 'Expense has been created successfully' : 'Expense has been updated successfully',
          life: 3000
        });
        
        // Refresh stats
        fetchExpenseStats();
      } catch (error) {
        console.error('Error saving expense:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save expense',
          life: 3000
        });
      } finally {
        saving.value = false;
        fileError.value = '';
        selectedFile.value = null;
        if (fileUpload.value) {
          fileUpload.value.clear();
        }
      }
    };

    // Submit expense for approval
    const submitExpense = async () => {
      if (!selectedExpense.value || !canSubmitExpense.value) return;
      
      processingAction.value = true;
      
      try {
        // In a real app, this would be an API call
        // For now, we'll simulate success
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Update local data
        selectedExpense.value.status = 'submitted';
        selectedExpense.value.updated_at = new Date();
        
        // Update in the list
        const index = expenses.value.findIndex(e => e.id === selectedExpense.value.id);
        if (index !== -1) {
          expenses.value[index] = { ...selectedExpense.value };
        }
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: 'Expense Submitted',
          detail: 'Expense has been submitted for approval',
          life: 3000
        });
        
        // Close details dialog
        expenseDetailsVisible.value = false;
        
        // Refresh stats
        fetchExpenseStats();
      } catch (error) {
        console.error('Error submitting expense:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to submit expense',
          life: 3000
        });
      } finally {
        processingAction.value = false;
      }
    };

    // Approve expense
    const approveExpense = async () => {
      if (!selectedExpense.value || !canReviewExpense.value) return;
      
      processingAction.value = true;
      
      try {
        // In a real app, this would be an API call
        // For now, we'll simulate success
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Update local data
        selectedExpense.value.status = 'approved';
        selectedExpense.value.updated_at = new Date();
        
        // Add approval record
        if (!selectedExpense.value.approvals) {
          selectedExpense.value.approvals = [];
        }
        
        selectedExpense.value.approvals.push({
          id: Math.random().toString(36).substring(2, 11),
          status: 'approved',
          approver_id: store.getters['auth/currentUser'].id,
          approver_name: store.getters['auth/userFullName'],
          comments: null,
          created_at: new Date()
        });
        
        // Update in the list
        const index = expenses.value.findIndex(e => e.id === selectedExpense.value.id);
        if (index !== -1) {
          expenses.value[index] = { ...selectedExpense.value };
        }
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: 'Expense Approved',
          detail: 'Expense has been approved',
          life: 3000
        });
        
        // Close details dialog
        expenseDetailsVisible.value = false;
        
        // Refresh stats
        fetchExpenseStats();
      } catch (error) {
        console.error('Error approving expense:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to approve expense',
          life: 3000
        });
      } finally {
        processingAction.value = false;
      }
    };

    // Open reject dialog
    const openRejectDialog = () => {
      rejectReason.value = '';
      rejectDialogVisible.value = true;
    };

    // Reject expense
    const rejectExpense = async () => {
      if (!selectedExpense.value || !canReviewExpense.value) return;
      
      processingAction.value = true;
      
      try {
        // In a real app, this would be an API call
        // For now, we'll simulate success
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Update local data
        selectedExpense.value.status = 'rejected';
        selectedExpense.value.updated_at = new Date();
        
        // Add rejection record
        if (!selectedExpense.value.approvals) {
          selectedExpense.value.approvals = [];
        }
        
        selectedExpense.value.approvals.push({
          id: Math.random().toString(36).substring(2, 11),
          status: 'rejected',
          approver_id: store.getters['auth/currentUser'].id,
          approver_name: store.getters['auth/userFullName'],
          comments: rejectReason.value || null,
          created_at: new Date()
        });
        
        // Update in the list
        const index = expenses.value.findIndex(e => e.id === selectedExpense.value.id);
        if (index !== -1) {
          expenses.value[index] = { ...selectedExpense.value };
        }
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: 'Expense Rejected',
          detail: 'Expense has been rejected',
          life: 3000
        });
        
        // Close dialogs
        rejectDialogVisible.value = false;
        expenseDetailsVisible.value = false;
        
        // Refresh stats
        fetchExpenseStats();
      } catch (error) {
        console.error('Error rejecting expense:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to reject expense',
          life: 3000
        });
      } finally {
        processingAction.value = false;
      }
    };

    // Mark expense as paid
    const markAsPaid = async () => {
      if (!selectedExpense.value || !canMarkAsPaid.value) return;
      
      processingAction.value = true;
      
      try {
        // In a real app, this would be an API call
        // For now, we'll simulate success
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Update local data
        selectedExpense.value.status = 'paid';
        selectedExpense.value.paid_at = new Date();
        selectedExpense.value.updated_at = new Date();
        
        // Update in the list
        const index = expenses.value.findIndex(e => e.id === selectedExpense.value.id);
        if (index !== -1) {
          expenses.value[index] = { ...selectedExpense.value };
        }
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: 'Expense Paid',
          detail: 'Expense has been marked as paid',
          life: 3000
        });
        
        // Close details dialog
        expenseDetailsVisible.value = false;
        
        // Refresh stats
        fetchExpenseStats();
      } catch (error) {
        console.error('Error marking expense as paid:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to mark expense as paid',
          life: 3000
        });
      } finally {
        processingAction.value = false;
      }
    };

    // View receipt
    const viewReceipt = () => {
      if (!selectedExpense.value || !selectedExpense.value.receipt_path) return;
      
      // In a real app, this would open the file in a new tab
      window.open(selectedExpense.value.receipt_path, '_blank');
    };

    // Download receipt from details view
    const downloadReceiptFromDetails = () => {
      if (!selectedExpense.value || !selectedExpense.value.receipt_path) return;
      
      // In a real app, this would trigger a download
      // For now, just simulate opening the file
      window.open(selectedExpense.value.receipt_path, '_blank');
    };

    // Download receipt from dialog
    const downloadReceipt = () => {
      if (!expense.receiptPath) return;
      
      // In a real app, this would trigger a download
      // For now, just simulate opening the file
      window.open(expense.receiptPath, '_blank');
    };

    // Row select handler
    const onExpenseSelect = (event) => {
      viewExpense(event.data);
    };

    // Row unselect handler
    const onExpenseUnselect = () => {
      // Nothing to do here
    };

    // Initialize component
    onMounted(() => {
      Promise.all([
        fetchExpenses(),
        fetchExpenseStats()
      ]).finally(() => {
        loading.value = false;
      });
    });

    return {
      loading,
      tableLoading,
      expenses,
      stats,
      selectedExpenses,
      selectedExpense,
      expenseDialogVisible,
      expenseDetailsVisible,
      rejectDialogVisible,
      dialogMode,
      saving,
      submitted,
      processingAction,
      rejectReason,
      selectedFile,
      fileError,
      fileUpload,
      pagination,
      filters,
      expense,
      statusOptions,
      categoryOptions,
      paginationSummary,
      canSubmitExpense,
      canReviewExpense,
      canMarkAsPaid,
      showExpenseActions,
      formattedApprovals,
      isReceiptPdf,
      
      // Methods
      formatStatus,
      formatCurrency,
      formatDate,
      getStatusSeverity,
      getCategorySeverity,
      canEditExpense,
      canDeleteExpense,
      onFilterChange,
      openNewExpenseDialog,
      closeExpenseDialog,
      onFileSelect,
      onFileError,
      viewExpense,
      editExpense,
      editFromDetails,
      confirmDeleteExpense,
      saveExpense,
      submitExpense,
      approveExpense,
      openRejectDialog,
      rejectExpense,
      markAsPaid,
      viewReceipt,
      downloadReceiptFromDetails,
      downloadReceipt,
      onExpenseSelect,
      onExpenseUnselect
    };
  }
};
</script>

<style scoped>
.expenses-container {
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

/* Expense stats cards */
.expense-stats {
  margin-bottom: 1.5rem;
}

.summary-card {
  padding: 1.25rem;
  background-color: var(--surface-card);
  border-radius: 0.5rem;
  text-align: center;
}

.summary-title {
  font-size: 1rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--text-color);
}

.summary-count {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* Filters */
.expense-filters {
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

/* Action buttons */
.action-buttons {
  display: flex;
  justify-content: flex-start;
  gap: 0.5rem;
}

/* Pagination controls */
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}

.pagination-summary {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* Receipt preview */
.receipt-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--surface-ground);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
}

.receipt-preview-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.receipt-preview-info i {
  color: var(--primary-color);
}

/* Expense details */
.expense-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.expense-amount {
  display: flex;
  align-items: baseline;
}

.amount-value {
  font-size: 2rem;
  font-weight: 600;
  margin-right: 0.5rem;
}

.currency {
  font-size: 1rem;
  color: var(--text-color-secondary);
}

.status-tag {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

.expense-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem 2rem;
  margin-bottom: 1.5rem;
}

.info-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 1rem;
  color: var(--text-color);
  font-weight: 500;
}

.description-section h3,
.receipt-section h3,
.approvals-section h3,
.expense-actions h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.description-content {
  background-color: var(--surface-ground);
  border-radius: 0.375rem;
  padding: 1rem;
  white-space: pre-line;
  margin-bottom: 1rem;
}

.receipt-actions {
  display: flex;
  gap: 0.75rem;
}

/* Approval timeline */
.approval-timeline {
  margin: 1rem 0;
}

.approval-item {
  padding: 0.5rem 0;
}

.approval-date {
  color: var(--text-color-secondary);
  display: block;
  margin-bottom: 0.25rem;
}

.approval-content {
  background-color: var(--surface-ground);
  border-radius: 0.375rem;
  padding: 0.75rem;
}

.approval-description {
  margin-bottom: 0.25rem;
}

.approval-user {
  font-weight: 500;
}

.approval-comments {
  font-style: italic;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

/* Action buttons */
.expense-workflow-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.review-buttons {
  display: flex;
  gap: 0.75rem;
}

/* Responsive adaptations */
@media screen and (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .expense-info-grid {
    grid-template-columns: 1fr;
  }
  
  .expense-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .review-buttons {
    flex-direction: column;
    width: 100%;
  }
  
  .review-buttons .p-button {
    width: 100%;
  }
}
</style>