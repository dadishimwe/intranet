<template>
    <div class="documents-container">
      <div class="page-header">
        <h1 class="page-title">Document Repository</h1>
        <div class="page-actions">
          <Button 
            label="Upload Document" 
            icon="pi pi-upload" 
            class="p-button-primary" 
            @click="openUploadAppDialog"
          />
        </div>
      </div>
      
      <!-- Filters -->
      <div class="card filter-card">
        <div class="grid">
          <div class="col-12 md:col-4">
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search" />
              <InputText 
                v-model="filters.searchTerm" 
                placeholder="Search documents" 
                class="w-full"
                @keyup.enter="loadDocuments"
              />
            </span>
          </div>
          
          <div class="col-12 md:col-3">
            <Dropdown
              v-model="filters.category"
              :options="categories"
              optionLabel="name"
              optionValue="value"
              placeholder="Select category"
              class="w-full"
              @change="loadDocuments"
            />
          </div>
          
          <div class="col-12 md:col-3">
            <Dropdown
              v-model="filters.departmentId"
              :options="departments"
              optionLabel="name"
              optionValue="id"
              placeholder="Select department"
              class="w-full"
              @change="loadDocuments"
            />
          </div>
          
          <div class="col-12 md:col-2">
            <Button 
              icon="pi pi-filter-slash" 
              label="Clear" 
              class="p-button-outlined w-full" 
              @click="clearFilters"
            />
          </div>
        </div>
      </div>
      
      <!-- Loading state -->
      <div v-if="loading" class="card loading-card">
        <ProgressSpinner class="spinner" />
        <p>Loading documents...</p>
      </div>
      
      <!-- Empty state -->
      <div v-else-if="documents.length === 0" class="card empty-state">
        <i class="pi pi-folder-open empty-icon"></i>
        <h3>No documents found</h3>
        <p>There are no documents matching your criteria. Try adjusting your filters or upload a new document.</p>
        <Button label="Upload Document" icon="pi pi-upload" @click="openUploadAppDialog" />
      </div>
      
      <!-- Documents list -->
      <div v-else class="document-list">
        <div class="grid">
          <div 
            v-for="doc in documents" 
            :key="doc.id" 
            class="col-12 md:col-6 lg:col-4"
          >
            <div class="card document-card">
              <div class="document-card-content">
                <div class="document-icon-container">
                  <i class="document-icon pi" :class="getDocumentIcon(doc.file_type)"></i>
                </div>
                
                <div class="document-details">
                  <div class="document-title">{{ doc.title }}</div>
                  <div class="document-meta">
                    <span class="document-type">{{ formatFileType(doc.file_type) }}</span>
                    <span class="document-date">{{ formatDate(doc.created_at) }}</span>
                  </div>
                  <div class="document-info">
                    <span v-if="doc.department_name" class="document-department">
                      <i class="pi pi-building"></i> {{ doc.department_name }}
                    </span>
                    <span class="document-size">
                      <i class="pi pi-file"></i> {{ formatFileSize(doc.file_size) }}
                    </span>
                  </div>
                  <div v-if="doc.description" class="document-description">
                    {{ truncateText(doc.description, 100) }}
                  </div>
                  <Tag 
                    v-if="doc.is_public" 
                    severity="info" 
                    value="Public" 
                    class="document-tag"
                  />
                </div>
              </div>
              
              <div class="document-actions">
                <Button 
                  icon="pi pi-eye" 
                  class="p-button-rounded p-button-text" 
                  @click="viewDocument(doc.id)"
                  tooltip="View"
                  tooltipOptions="{ position: 'top' }"
                />
                <Button 
                  icon="pi pi-download" 
                  class="p-button-rounded p-button-text" 
                  @click="downloadDocument(doc)"
                  tooltip="Download"
                  tooltipOptions="{ position: 'top' }"
                />
                <Button 
                  v-if="canEditDocument(doc)"
                  icon="pi pi-pencil" 
                  class="p-button-rounded p-button-text" 
                  @click="editDocument(doc)"
                  tooltip="Edit"
                  tooltipOptions="{ position: 'top' }"
                />
                <Button 
                  v-if="canDeleteDocument(doc)"
                  icon="pi pi-trash" 
                  class="p-button-rounded p-button-text p-button-danger" 
                  @click="confirmDeleteDocument(doc)"
                  tooltip="Delete"
                  tooltipOptions="{ position: 'top' }"
                />
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pagination -->
        <div class="pagination-container">
          <Paginator 
            v-if="pagination.total > pagination.per_page"
            :rows="pagination.per_page" 
            :totalRecords="pagination.total"
            :first="(pagination.current_page - 1) * pagination.per_page"
            :rowsPerPageOptions="[10, 20, 50]"
            @page="onPageChange($event)"
          />
        </div>
      </div>
      
      <!-- Upload document dialog -->
      <Dialog 
        v-model:visible="uploadDialogVisible" 
        header="Upload Document" 
        :modal="true"
        :style="{ width: '500px' }"
        :closable="!uploading"
        :closeOnEscape="!uploading"
      >
        <div class="upload-form">
          <div class="form-field">
            <label for="documentTitle">Title <span class="required">*</span></label>
            <InputText 
              id="documentTitle" 
              v-model="documentForm.title" 
              class="w-full"
              :disabled="uploading"
              :class="{ 'p-invalid': submitted && !documentForm.title }"
            />
            <small v-if="submitted && !documentForm.title" class="p-error">Title is required</small>
          </div>
          
          <div class="form-field">
            <label for="documentDescription">Description</label>
            <Textarea 
              id="documentDescription" 
              v-model="documentForm.description" 
              rows="3" 
              class="w-full"
              :disabled="uploading"
            />
          </div>
          
          <div class="form-field">
            <label for="documentCategory">Category</label>
            <Dropdown
              id="documentCategory"
              v-model="documentForm.category"
              :options="categories"
              optionLabel="name"
              optionValue="value"
              placeholder="Select category"
              class="w-full"
              :disabled="uploading"
            />
          </div>
          
          <div class="form-field">
            <label for="documentDepartment">Department</label>
            <Dropdown
              id="documentDepartment"
              v-model="documentForm.departmentId"
              :options="departments"
              optionLabel="name"
              optionValue="id"
              placeholder="Select department"
              class="w-full"
              :disabled="uploading"
            />
          </div>
          
          <div class="form-field">
            <div class="flex align-items-center">
              <Checkbox 
                id="isPublic" 
                v-model="documentForm.isPublic" 
                :binary="true"
                :disabled="uploading"
              />
              <label for="isPublic" class="ml-2">Make document public</label>
            </div>
          </div>
          
          <div class="form-field file-upload">
            <label>Document File <span class="required">*</span></label>
            <FileUpload
              name="document"
              :multiple="false"
              accept="application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation, text/plain, image/jpeg, image/png"
              :maxFileSize="10000000"
              @select="onFileSelect"
              @clear="onFileClear"
              :disabled="uploading"
              :auto="false"
              chooseLabel="Select Document"
              :class="{ 'p-invalid': submitted && !selectedFile }"
            >
              <template #empty>
                <p>Drag and drop a file here or click to browse.</p>
                <p class="text-sm">Supported formats: PDF, Word, Excel, PowerPoint, Text, and Images</p>
                <p class="text-sm">Maximum file size: 10MB</p>
              </template>
            </FileUpload>
            <small v-if="submitted && !selectedFile" class="p-error">Document file is required</small>
          </div>
          
          <ProgressBar v-if="uploading" :value="uploadProgress" class="mt-3" />
        </div>
        
        <template #footer>
          <Button 
            label="Cancel" 
            icon="pi pi-times" 
            class="p-button-text" 
            @click="closeUploadAppDialog" 
            :disabled="uploading"
          />
          <Button 
            label="Upload" 
            icon="pi pi-upload" 
            @click="uploadDocument" 
            :loading="uploading"
          />
        </template>
      </Dialog>
      
      <!-- Edit document dialog -->
      <Dialog 
        v-model:visible="editDialogVisible" 
        header="Edit Document" 
        :modal="true"
        :style="{ width: '500px' }"
      >
        <div class="edit-form" v-if="selectedDocument">
          <div class="form-field">
            <label for="editTitle">Title <span class="required">*</span></label>
            <InputText 
              id="editTitle" 
              v-model="editForm.title" 
              class="w-full"
              :class="{ 'p-invalid': editSubmitted && !editForm.title }"
            />
            <small v-if="editSubmitted && !editForm.title" class="p-error">Title is required</small>
          </div>
          
          <div class="form-field">
            <label for="editDescription">Description</label>
            <Textarea 
              id="editDescription" 
              v-model="editForm.description" 
              rows="3" 
              class="w-full"
            />
          </div>
          
          <div class="form-field">
            <label for="editCategory">Category</label>
            <Dropdown
              id="editCategory"
              v-model="editForm.category"
              :options="categories"
              optionLabel="name"
              optionValue="value"
              placeholder="Select category"
              class="w-full"
            />
          </div>
          
          <div class="form-field">
            <label for="editDepartment">Department</label>
            <Dropdown
              id="editDepartment"
              v-model="editForm.departmentId"
              :options="departments"
              optionLabel="name"
              optionValue="id"
              placeholder="Select department"
              class="w-full"
            />
          </div>
          
          <div class="form-field">
            <div class="flex align-items-center">
              <Checkbox 
                id="editIsPublic" 
                v-model="editForm.isPublic" 
                :binary="true"
              />
              <label for="editIsPublic" class="ml-2">Make document public</label>
            </div>
          </div>
        </div>
        
        <template #footer>
          <Button 
            label="Cancel" 
            icon="pi pi-times" 
            class="p-button-text" 
            @click="closeEditAppDialog"
          />
          <Button 
            label="Save" 
            icon="pi pi-check" 
            @click="saveDocumentChanges"
          />
        </template>
      </Dialog>
      
      <!-- Delete confirmation dialog -->
      <ConfirmDialog></ConfirmDialog>
    </div>
  </template>
  
  <script>
  import { ref, reactive, computed, onMounted } from 'vue';
  import { useStore } from 'vuex';
  import { useRouter } from 'vue-router';
  import { useConfirm } from 'primevue/useconfirm';
  import InputText from 'primevue/inputtext';
  import Button from 'primevue/button';
  import Dropdown from 'primevue/dropdown';
  import ProgressSpinner from 'primevue/progressspinner';
  import ProgressBar from 'primevue/progressbar';
  import FileUpload from 'primevue/fileupload';
  import Paginator from 'primevue/paginator';
  import Dialog from 'primevue/dialog';
  import Textarea from 'primevue/textarea';
  import Checkbox from 'primevue/checkbox';
  import Tag from 'primevue/tag';
  import ConfirmDialog from 'primevue/confirmdialog';
  import api from '../services/api';
  
  export default {
    name: 'DocumentsView',
    components: {
      InputText,
      Button,
      Dropdown,
      ProgressSpinner,
      ProgressBar,
      FileUpload,
      Paginator,
      Dialog,
      Textarea,
      Checkbox,
      Tag,
      ConfirmDialog
    },
    
    setup() {
      const store = useStore();
      const router = useRouter();
      const confirm = useConfirm();
      
      // State
      const loading = ref(false);
      const documents = ref([]);
      const selectedDocument = ref(null);
      const selectedFile = ref(null);
      const uploading = ref(false);
      const uploadProgress = ref(0);
      const submitted = ref(false);
      const editSubmitted = ref(false);
      const uploadDialogVisible = ref(false);
      const editDialogVisible = ref(false);
      
      // Pagination
      const pagination = ref({
        current_page: 1,
        per_page: 20,
        total: 0,
        last_page: 1
      });
      
      // Filters
      const filters = reactive({
        searchTerm: '',
        category: null,
        departmentId: null
      });
      
      // Form data
      const documentForm = reactive({
        title: '',
        description: '',
        category: null,
        departmentId: null,
        isPublic: false
      });
      
      const editForm = reactive({
        title: '',
        description: '',
        category: null,
        departmentId: null,
        isPublic: false
      });
      
      // Computed values
      const isAdmin = computed(() => store.getters['auth/isAdmin']);
      const currentUser = computed(() => store.getters['auth/currentUser']);
      
      const categories = computed(() => [
        { name: 'All Categories', value: null },
        { name: 'Report', value: 'report' },
        { name: 'Policy', value: 'policy' },
        { name: 'Procedure', value: 'procedure' },
        { name: 'Form', value: 'form' },
        { name: 'Presentation', value: 'presentation' },
        { name: 'Template', value: 'template' },
        { name: 'Financial', value: 'financial' },
        { name: 'HR', value: 'hr' },
        { name: 'Marketing', value: 'marketing' },
        { name: 'Technical', value: 'technical' },
        { name: 'Other', value: 'other' }
      ]);
      
      const departments = computed(() => {
        const depts = [{ name: 'All Departments', value: null }];
        const departmentsList = store.state.departments?.list || [];
        
        departmentsList.forEach(dept => {
          depts.push({
            name: dept.name,
            id: dept.id
          });
        });
        
        return depts;
      });
      
      // Methods
      const loadDocuments = async (page = 1) => {
        try {
          loading.value = true;
          
          const response = await api.get('/api/documents', {
            params: {
              page,
              limit: pagination.value.per_page,
              search: filters.searchTerm || undefined,
              category: filters.category || undefined,
              departmentId: filters.departmentId || undefined
            }
          });
          
          documents.value = response.data.data;
          pagination.value = response.data.pagination;
        } catch (error) {
          console.error('Error loading documents:', error);
          store.dispatch('showToast', {
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load documents'
          });
        } finally {
          loading.value = false;
        }
      };
      
      const onPageChange = (event) => {
        const page = event.page + 1;
        loadDocuments(page);
      };
      
      const clearFilters = () => {
        filters.searchTerm = '';
        filters.category = null;
        filters.departmentId = null;
        loadDocuments();
      };
      
      const openUploadDialog = () => {
        // Reset form
        documentForm.title = '';
        documentForm.description = '';
        documentForm.category = null;
        documentForm.departmentId = currentUser.value?.departmentId || null;
        documentForm.isPublic = false;
        
        selectedFile.value = null;
        submitted.value = false;
        uploadDialogVisible.value = true;
      };
      
      const closeUploadDialog = () => {
        if (uploading.value) return;
        uploadDialogVisible.value = false;
      };
      
      const onFileSelect = (event) => {
        selectedFile.value = event.files[0];
        
        // Auto-fill title from filename if empty
        if (!documentForm.title && selectedFile.value) {
          // Remove extension
          const filename = selectedFile.value.name.replace(/\.[^/.]+$/, '');
          documentForm.title = filename;
        }
        
        // Auto-detect category from file type if empty
        if (!documentForm.category && selectedFile.value) {
          const fileType = selectedFile.value.type;
          
          if (fileType.includes('pdf')) {
            documentForm.category = 'report';
          } else if (fileType.includes('word')) {
            documentForm.category = 'policy';
          } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
            documentForm.category = 'financial';
          } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
            documentForm.category = 'presentation';
          }
        }
      };
      
      const onFileClear = () => {
        selectedFile.value = null;
      };
      
      const uploadDocument = async () => {
        submitted.value = true;
        
        // Validate form
        if (!documentForm.title || !selectedFile.value) {
          return;
        }
        
        try {
          uploading.value = true;
          uploadProgress.value = 0;
          
          // Create form data
          const formData = new FormData();
          formData.append('title', documentForm.title);
          formData.append('document', selectedFile.value);
          
          if (documentForm.description) {
            formData.append('description', documentForm.description);
          }
          
          if (documentForm.category) {
            formData.append('category', documentForm.category);
          }
          
          if (documentForm.departmentId) {
            formData.append('departmentId', documentForm.departmentId);
          }
          
          formData.append('isPublic', documentForm.isPublic);
          
          // Upload with progress tracking
          const response = await api.post('/api/documents', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            }
          });
          
          // Add document to list
          documents.value.unshift(response.data.data);
          
          // Close dialog
          uploadDialogVisible.value = false;
          
          // Show success message
          store.dispatch('showToast', {
            severity: 'success',
            summary: 'Success',
            detail: 'Document uploaded successfully'
          });
        } catch (error) {
          console.error('Error uploading document:', error);
          store.dispatch('showToast', {
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to upload document'
          });
        } finally {
          uploading.value = false;
        }
      };
      
      const viewDocument = (id) => {
        router.push(`/documents/${id}`);
      };
      
      const downloadDocument = (doc) => {
        // In production, this would trigger a direct download
        if (doc.file_path) {
          window.open(doc.file_path, '_blank');
        }
      };
      
      const canEditDocument = (doc) => {
        if (isAdmin.value) return true;
        return doc.created_by === currentUser.value?.id;
      };
      
      const canDeleteDocument = (doc) => {
        if (isAdmin.value) return true;
        return doc.created_by === currentUser.value?.id;
      };
      
      const editDocument = (doc) => {
        selectedDocument.value = doc;
        
        // Copy values to edit form
        editForm.title = doc.title;
        editForm.description = doc.description || '';
        editForm.category = doc.category;
        editForm.departmentId = doc.department_id;
        editForm.isPublic = doc.is_public;
        
        editSubmitted.value = false;
        editDialogVisible.value = true;
      };
      
      const closeEditDialog = () => {
        editDialogVisible.value = false;
      };
      
      const saveDocumentChanges = async () => {
        editSubmitted.value = true;
        
        // Validate form
        if (!editForm.title) {
          return;
        }
        
        try {
          loading.value = true;
          
          const response = await api.put(`/api/documents/${selectedDocument.value.id}`, {
            title: editForm.title,
            description: editForm.description,
            category: editForm.category,
            departmentId: editForm.departmentId,
            isPublic: editForm.isPublic
          });
          
          // Update document in list
          const index = documents.value.findIndex(d => d.id === selectedDocument.value.id);
          if (index !== -1) {
            documents.value[index] = response.data.data;
          }
          
          // Close dialog
          editDialogVisible.value = false;
          
          // Show success message
          store.dispatch('showToast', {
            severity: 'success',
            summary: 'Success',
            detail: 'Document updated successfully'
          });
        } catch (error) {
          console.error('Error updating document:', error);
          store.dispatch('showToast', {
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to update document'
          });
        } finally {
          loading.value = false;
        }
      };
      
      const confirmDeleteDocument = (doc) => {
        confirm.require({
          message: 'Are you sure you want to delete this document?',
          header: 'Delete Confirmation',
          icon: 'pi pi-exclamation-triangle',
          acceptClass: 'p-button-danger',
          accept: () => deleteDocument(doc),
          reject: () => {}
        });
      };
      
      const deleteDocument = async (doc) => {
        try {
          loading.value = true;
          
          await api.delete(`/api/documents/${doc.id}`);
          
          // Remove document from list
          documents.value = documents.value.filter(d => d.id !== doc.id);
          
          // Show success message
          store.dispatch('showToast', {
            severity: 'success',
            summary: 'Success',
            detail: 'Document deleted successfully'
          });
        } catch (error) {
          console.error('Error deleting document:', error);
          store.dispatch('showToast', {
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to delete document'
          });
        } finally {
          loading.value = false;
        }
      };
      
      const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      };
      
      const formatFileSize = (bytes) => {
        if (!bytes) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };
      
      const formatFileType = (type) => {
        if (!type) return 'Unknown';
        
        const lookup = {
          'application/pdf': 'PDF',
          'application/msword': 'Word',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
          'application/vnd.ms-excel': 'Excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
          'application/vnd.ms-powerpoint': 'PowerPoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
          'text/plain': 'Text',
          'image/jpeg': 'JPEG',
          'image/png': 'PNG'
        };
        
        return lookup[type] || type.split('/')[1].toUpperCase();
      };
      
      const getDocumentIcon = (fileType) => {
        if (!fileType) return 'pi-file-o';
        
        const type = fileType.toLowerCase();
        
        if (type.includes('pdf')) return 'pi-file-pdf';
        if (type.includes('word') || type.includes('document')) return 'pi-file-word';
        if (type.includes('excel') || type.includes('sheet')) return 'pi-file-excel';
        if (type.includes('powerpoint') || type.includes('presentation')) return 'pi-file-powerpoint';
        if (type.includes('zip') || type.includes('rar')) return 'pi-file-archive';
        if (type.includes('jpg') || type.includes('jpeg') || 
            type.includes('png') || type.includes('gif')) return 'pi-file-image';
        if (type.includes('text') || type.includes('txt')) return 'pi-file-lines';
        
        return 'pi-file-o';
      };
      
      const truncateText = (text, maxLength) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        
        return text.substr(0, maxLength) + '...';
      };
      
      // Load departments on mount
      onMounted(async () => {
        try {
          await store.dispatch('departments/fetchDepartments');
          loadDocuments();
        } catch (error) {
          console.error('Error initializing documents page:', error);
        }
      });
      
      return {
        // State
        loading,
        documents,
        pagination,
        filters,
        uploadDialogVisible,
        editDialogVisible,
        documentForm,
        editForm,
        selectedDocument,
        selectedFile,
        uploading,
        uploadProgress,
        submitted,
        editSubmitted,
        
        // Computed
        categories,
        departments,
        
        // Methods
        loadDocuments,
        onPageChange,
        clearFilters,
        openUploadDialog,
        closeUploadDialog,
        onFileSelect,
        onFileClear,
        uploadDocument,
        viewDocument,
        downloadDocument,
        canEditDocument,
        canDeleteDocument,
        editDocument,
        closeEditDialog,
        saveDocumentChanges,
        confirmDeleteDocument,
        
        // Formatters
        formatDate,
        formatFileSize,
        formatFileType,
        getDocumentIcon,
        truncateText
      };
    }
  };
  </script>
  
  <style scoped>
  .documents-container {
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
  
  .filter-card {
    margin-bottom: 1.5rem;
    padding: 1rem;
  }
  
  .loading-card, .empty-state {
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
  
  .empty-icon {
    font-size: 3rem;
    color: var(--text-color-secondary);
    margin-bottom: 1rem;
  }
  
  .document-list {
    margin-bottom: 2rem;
  }
  
  .document-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    transition: transform 0.2s;
  }
  
  .document-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .document-card-content {
    display: flex;
    padding: 1rem;
    flex: 1;
  }
  
  .document-icon-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 0.5rem;
    margin-right: 1rem;
    background-color: rgba(59, 130, 246, 0.1);
  }
  
  .document-icon {
    font-size: 1.5rem;
    color: var(--primary-color);
  }
  
  .document-details {
    flex: 1;
  }
  
  .document-title {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }
  
  .document-meta {
    display: flex;
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    margin-bottom: 0.5rem;
  }
  
  .document-type {
    margin-right: 1rem;
  }
  
  .document-info {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    margin-bottom: 0.5rem;
  }
  
  .document-department, .document-size {
    display: flex;
    align-items: center;
    margin-right: 1rem;
  }
  
  .document-department i, .document-size i {
    margin-right: 0.25rem;
  }
  
  .document-description {
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
    color: var(--text-color-secondary);
  }
  
  .document-tag {
    margin-top: 0.25rem;
  }
  
  .document-actions {
    display: flex;
    justify-content: flex-end;
    padding: 0.5rem;
    border-top: 1px solid var(--surface-border);
  }
  
  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
  }
  
  .form-field {
    margin-bottom: 1.5rem;
  }
  
  .form-field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  .form-field .required {
    color: var(--danger-color);
  }
  
  @media screen and (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .page-actions {
      margin-top: 1rem;
      width: 100%;
    }
    
    .page-actions button {
      width: 100%;
    }
    
    .document-card-content {
      flex-direction: column;
    }
    
    .document-icon-container {
      margin-right: 0;
      margin-bottom: 1rem;
    }
  }
  </style>
<!-- 
  export default {
    name: 'DocumentsView',
    components: {
      InputText,
      Button,
      Dropdown,
      ProgressSpinner,
      ProgressBar,
      FileUpload,
      Paginator,
      Dialog,
      Textarea,
      Checkbox,
      Tag,
      ConfirmDialog-->