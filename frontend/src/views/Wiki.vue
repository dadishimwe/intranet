<template>
  <div class="wiki-container">
    <!-- Page header with title and actions -->
    <div class="page-header">
      <h1 class="page-title">Knowledge Base</h1>
      <div class="page-actions">
        <Button 
          label="New Page" 
          icon="pi pi-plus" 
          @click="openNewPageAppDialog"
          class="p-button-primary"
        />
      </div>
    </div>
    
    <!-- Wiki content area with sidebar and main content -->
    <div class="wiki-content">
      <!-- Sidebar for tree navigation -->
      <div class="wiki-sidebar card">
        <div class="wiki-search p-input-icon-left w-full">
          <i class="pi pi-search" />
          <InputText 
            v-model="searchQuery" 
            placeholder="Search wiki..." 
            class="w-full"
            @input="debounceSearch"
          />
        </div>
        
        <div v-if="isSearching" class="wiki-sidebar-loading">
          <ProgressSpinner style="width: 50px; height: 50px" />
        </div>
        
        <div v-else-if="searchQuery && searchResults.length > 0" class="wiki-search-results">
          <h3 class="search-results-title">Search Results</h3>
          <ul class="search-results-list">
            <li 
              v-for="result in searchResults" 
              :key="result.id" 
              class="search-result-item p-ripple"
              @click="viewPage(result.id)"
            >
              <div class="search-result-title">{{ result.title }}</div>
              <div class="search-result-path">{{ result.path }}</div>
              <Ripple />
            </li>
          </ul>
          <Button 
            label="Clear Search" 
            icon="pi pi-times" 
            class="p-button-text p-button-sm mt-2" 
            @click="clearSearch"
          />
        </div>
        
        <div v-else-if="searchQuery && searchResults.length === 0" class="wiki-empty-results">
          <i class="pi pi-search"></i>
          <p>No pages match your search</p>
          <Button 
            label="Clear" 
            icon="pi pi-times" 
            class="p-button-text p-button-sm" 
            @click="clearSearch"
          />
        </div>
        
        <div v-else class="wiki-tree">
          <h3 class="wiki-tree-title">Wiki Pages</h3>
          <div v-if="isLoading" class="wiki-sidebar-loading">
            <ProgressSpinner style="width: 50px; height: 50px" />
          </div>
          <div v-else>
            <TreeTable :value="wikiTreeNodes" selectionMode="single" :expandedKeys="expandedKeys">
              <Column field="title" expander>
                <template #body="{ data }">
                  <div 
                    class="wiki-node p-ripple" 
                    :class="{ 'active-node': currentPage && currentPage.id === data.id }"
                    @click="viewPage(data.id)"
                  >
                    {{ data.title }}
                    <Ripple />
                  </div>
                </template>
              </Column>
            </TreeTable>
          </div>
        </div>
      </div>
      
      <!-- Main content area -->
      <div class="wiki-main">
        <!-- Loading state -->
        <div v-if="isLoading" class="wiki-loading">
          <ProgressSpinner />
        </div>
        
        <!-- Empty state - no page selected -->
        <div v-else-if="!currentPage" class="wiki-empty card">
          <div class="wiki-empty-content">
            <i class="pi pi-book"></i>
            <h2>Welcome to the Knowledge Base</h2>
            <p>Select a page from the sidebar or create a new one to get started.</p>
            <Button 
              label="Create Your First Page" 
              icon="pi pi-plus" 
              @click="openNewPageAppDialog" 
              class="p-button-primary mt-3"
            />
          </div>
        </div>
        
        <!-- Wiki page content -->
        <div v-else class="wiki-page card">
          <!-- Breadcrumb navigation -->
          <Breadcrumb :model="breadcrumbItems" class="wiki-breadcrumb mb-3" />
          
          <!-- Page header with title and metadata -->
          <div class="wiki-page-header">
            <h1 class="wiki-page-title">{{ currentPage.title }}</h1>
            <div class="wiki-page-meta">
              <span class="wiki-page-author">
                <i class="pi pi-user"></i>
                {{ currentPage.created_by_name }}
              </span>
              <span class="wiki-page-date">
                <i class="pi pi-calendar"></i>
                {{ formatDate(currentPage.updated_at || currentPage.created_at) }}
              </span>
              <div class="wiki-page-actions">
                <Button 
                  icon="pi pi-pencil" 
                  class="p-button-text p-button-rounded" 
                  @click="editPage" 
                  v-tooltip.top="'Edit Page'" 
                />
                <Button 
                  icon="pi pi-history" 
                  class="p-button-text p-button-rounded" 
                  @click="viewRevisions" 
                  v-tooltip.top="'View History'" 
                />
                <Button 
                  icon="pi pi-trash" 
                  class="p-button-text p-button-rounded p-button-danger" 
                  @click="confirmDeletePage" 
                  v-tooltip.top="'Delete Page'" 
                />
              </div>
            </div>
          </div>
          
          <!-- Page content rendered as markdown -->
          <div class="wiki-page-content p-4">
            <div v-html="renderedContent"></div>
          </div>
          
          <!-- Page footer with tags and other metadata -->
          <div class="wiki-page-footer" v-if="currentPage.tags && currentPage.tags.length > 0">
            <div class="wiki-page-tags">
              <i class="pi pi-tags"></i>
              <span 
                v-for="tag in currentPage.tags" 
                :key="tag"
                class="wiki-tag"
              >{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Wiki page dialog (create/edit) -->
    <Dialog 
      v-model:visible="pageDialogVisible" 
      :style="{ width: '80%', maxWidth: '800px' }" 
      :header="dialogMode === 'create' ? 'Create New Page' : 'Edit Page'" 
      :modal="true" 
      class="p-fluid wiki-dialog"
    >
      <div class="wiki-form">
        <div class="field">
          <label for="pageTitle">Title*</label>
          <InputText 
            id="pageTitle" 
            v-model="pageForm.title" 
            required 
            :class="{ 'p-invalid': submitted && !pageForm.title }"
          />
          <small v-if="submitted && !pageForm.title" class="p-error">Title is required.</small>
        </div>
        
        <div class="field">
          <label for="pageParent">Parent Page</label>
          <Dropdown 
            id="pageParent" 
            v-model="pageForm.parentId" 
            :options="parentPageOptions" 
            optionLabel="title" 
            optionValue="id" 
            placeholder="No Parent (Top Level)" 
          />
        </div>
        
        <div class="field">
          <label for="pageDepartment">Department</label>
          <Dropdown 
            id="pageDepartment" 
            v-model="pageForm.departmentId" 
            :options="departments" 
            optionLabel="name" 
            optionValue="id" 
            placeholder="No Department" 
          />
        </div>
        
        <div class="field">
          <label for="pageTags">Tags</label>
          <Chips 
            id="pageTags" 
            v-model="pageForm.tags" 
            separator="," 
            placeholder="Add tags (press enter or comma to add)"
          />
          <small class="form-helper-text">Tags help with organization and searching</small>
        </div>
        
        <div class="field">
          <label for="pageContent">Content*</label>
          <Textarea 
            id="pageContent" 
            v-model="pageForm.content" 
            rows="12" 
            required
            :class="{ 'p-invalid': submitted && !pageForm.content }"
          />
          <small v-if="submitted && !pageForm.content" class="p-error">Content is required.</small>
          <small class="form-helper-text">
            This editor supports Markdown formatting. 
            <a href="#" @click.prevent="showMarkdownHelp">View formatting help</a>
          </small>
        </div>
      </div>

      <template #footer>
        <Button 
          label="Cancel" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="closePageAppDialog" 
        />
        <Button 
          label="Save" 
          icon="pi pi-check" 
          @click="savePage" 
          :loading="saving"
        />
      </template>
    </Dialog>
    
    <!-- Revisions dialog -->
    <Dialog 
      v-model:visible="revisionsDialogVisible" 
      :style="{ width: '650px' }" 
      header="Page History" 
      :modal="true"
      class="wiki-revisions-dialog"
    >
      <div v-if="pageRevisions.length === 0" class="empty-revisions">
        <i class="pi pi-history"></i>
        <p>No revision history available</p>
      </div>
      <div v-else class="revisions-list">
        <Timeline :value="formattedRevisions">
          <template #content="slotProps">
            <div class="revision-item">
              <div class="revision-content">
                <h3>{{ slotProps.item.title }}</h3>
                <div class="revision-meta">
                  <span class="revision-date">{{ slotProps.item.date }}</span>
                  <span class="revision-author">{{ slotProps.item.author }}</span>
                </div>
                <p v-if="slotProps.item.description" class="revision-description">
                  {{ slotProps.item.description }}
                </p>
                <div class="revision-actions">
                  <Button 
                    label="View" 
                    icon="pi pi-eye" 
                    class="p-button-sm p-button-text" 
                    @click="viewRevision(slotProps.item.id)"
                  />
                  <Button 
                    label="Restore" 
                    icon="pi pi-replay" 
                    class="p-button-sm p-button-text" 
                    @click="restoreRevision(slotProps.item.id)"
                  />
                </div>
              </div>
            </div>
          </template>
        </Timeline>
      </div>
      
      <template #footer>
        <Button 
          label="Close" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="revisionsDialogVisible = false" 
        />
      </template>
    </Dialog>
    
    <!-- Markdown help dialog -->
    <Dialog 
      v-model:visible="markdownHelpVisible" 
      :style="{ width: '700px' }" 
      header="Markdown Formatting Guide" 
      :modal="true"
    >
      <div class="markdown-help">
        <div class="markdown-help-section">
          <h3>Basic Formatting</h3>
          <div class="markdown-example-grid">
            <div class="markdown-example">
              <div class="markdown-code">**Bold text**</div>
              <div class="markdown-result"><strong>Bold text</strong></div>
            </div>
            <div class="markdown-example">
              <div class="markdown-code">*Italic text*</div>
              <div class="markdown-result"><em>Italic text</em></div>
            </div>
            <div class="markdown-example">
              <div class="markdown-code">~~Strikethrough~~</div>
              <div class="markdown-result"><s>Strikethrough</s></div>
            </div>
          </div>
        </div>
        
        <div class="markdown-help-section">
          <h3>Headings</h3>
          <div class="markdown-example">
            <div class="markdown-code"># Heading 1</div>
            <div class="markdown-result"><h1 style="margin: 0">Heading 1</h1></div>
          </div>
          <div class="markdown-example">
            <div class="markdown-code">## Heading 2</div>
            <div class="markdown-result"><h2 style="margin: 0">Heading 2</h2></div>
          </div>
          <div class="markdown-example">
            <div class="markdown-code">### Heading 3</div>
            <div class="markdown-result"><h3 style="margin: 0">Heading 3</h3></div>
          </div>
        </div>
        
        <div class="markdown-help-section">
          <h3>Lists</h3>
          <div class="markdown-example">
            <div class="markdown-code">
              - Item 1<br>
              - Item 2<br>
              - Item 3
            </div>
            <div class="markdown-result">
              <ul style="margin: 0">
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
              </ul>
            </div>
          </div>
          <div class="markdown-example">
            <div class="markdown-code">
              1. First item<br>
              2. Second item<br>
              3. Third item
            </div>
            <div class="markdown-result">
              <ol style="margin: 0">
                <li>First item</li>
                <li>Second item</li>
                <li>Third item</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div class="markdown-help-section">
          <h3>Links and Images</h3>
          <div class="markdown-example">
            <div class="markdown-code">[Link text](https://example.com)</div>
            <div class="markdown-result"><a href="#">Link text</a></div>
          </div>
          <div class="markdown-example">
            <div class="markdown-code">![Alt text](image-url.jpg)</div>
            <div class="markdown-result">Image with alt text</div>
          </div>
        </div>
        
        <div class="markdown-help-section">
          <h3>Code</h3>
          <div class="markdown-example">
            <div class="markdown-code">`inline code`</div>
            <div class="markdown-result"><code>inline code</code></div>
          </div>
          <div class="markdown-example">
            <div class="markdown-code">
              ```<br>
              // Code block<br>
              function example() {<br>
              &nbsp;&nbsp;return true;<br>
              }<br>
              ```
            </div>
            <div class="markdown-result">
              <pre style="margin: 0"><code>// Code block
function example() {
  return true;
}</code></pre>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <Button 
          label="Close" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="markdownHelpVisible = false" 
        />
      </template>
    </Dialog>
    
    <!-- Confirm Dialog -->
    <ConfirmDialog />
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// PrimeVue components
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Chips from 'primevue/chips';
import ProgressSpinner from 'primevue/progressspinner';
import Dialog from 'primevue/dialog';
import TreeTable from 'primevue/treetable';
import Column from 'primevue/column';
import Breadcrumb from 'primevue/breadcrumb';
import Timeline from 'primevue/timeline';
import Tooltip from 'primevue/tooltip';
import ConfirmDialog from 'primevue/confirmdialog';
import Ripple from 'primevue/ripple';

export default {
  name: 'WikiView',
  components: {
    Button,
    InputText,
    Dropdown,
    Textarea,
    Chips,
    ProgressSpinner,
    Dialog,
    TreeTable,
    Column,
    Breadcrumb,
    Timeline,
    ConfirmDialog
  },
  directives: {
    tooltip: Tooltip,
    ripple: Ripple
  },
  setup() {
    const store = useStore();
    const router = useRouter();
    const confirm = useConfirm();
    const toast = useToast();

    // State
    const searchQuery = ref('');
    const isSearching = ref(false);
    const pageDialogVisible = ref(false);
    const revisionsDialogVisible = ref(false);
    const markdownHelpVisible = ref(false);
    const dialogMode = ref('create');
    const submitted = ref(false);
    const saving = ref(false);
    const expandedKeys = ref({});
    
    // Debounce search
    let searchTimeout = null;
    
    // Form state for page
    const pageForm = reactive({
      id: null,
      title: '',
      content: '',
      parentId: null,
      departmentId: null,
      tags: []
    });

    // Departments (fetch from store or API)
    const departments = ref([
      { id: '1', name: 'Finance' },
      { id: '2', name: 'Human Resources' },
      { id: '3', name: 'Marketing' },
      { id: '4', name: 'Engineering' },
      { id: '5', name: 'Operations' }
    ]);

    // Computed properties
    const isLoading = computed(() => store.state.knowledge.isLoading);
    const wikiPages = computed(() => store.state.knowledge.wikiPages);
    const wikiTree = computed(() => store.state.knowledge.wikiTree);
    const currentPage = computed(() => store.state.knowledge.currentPage);
    const pageRevisions = computed(() => store.state.knowledge.pageRevisions);
    const searchResults = computed(() => store.state.knowledge.searchResults);

    // Format wiki tree for TreeTable component
    const wikiTreeNodes = computed(() => {
      return formatTreeNodes(wikiTree.value);
    });

    // Options for parent page dropdown
    const parentPageOptions = computed(() => {
      const options = [];
      
      // Add option for no parent (root level)
      options.push({ id: null, title: 'No Parent (Top Level)' });
      
      // Add all pages except current page and its descendants
      if (wikiPages.value) {
        wikiPages.value.forEach(page => {
          // Skip current page and its descendants to prevent circular references
          if (pageForm.id && (page.id === pageForm.id || isDescendant(page.id, pageForm.id))) {
            return;
          }
          options.push({ id: page.id, title: page.title });
        });
      }
      
      return options;
    });

    // Breadcrumb trail for current page
    const breadcrumbItems = computed(() => {
      if (!currentPage.value) return [];
      
      const items = [
        { label: 'Wiki Home', command: () => router.push('/wiki') }
      ];
      
      if (store.getters['knowledge/breadcrumbPath'] && store.getters['knowledge/breadcrumbPath'].length > 0) {
        store.getters['knowledge/breadcrumbPath'].forEach((item, index) => {
          if (index === 0) return; // Skip home item as we already added it
          
          items.push({
            label: item.title,
            command: () => viewPage(item.id),
            class: item.isActive ? 'active-breadcrumb' : ''
          });
        });
      }
      
      return items;
    });

    // Format revisions for timeline component
    const formattedRevisions = computed(() => {
      return pageRevisions.value.map(revision => ({
        id: revision.id,
        title: `Version ${revision.version}`,
        date: formatDate(revision.created_at),
        author: revision.created_by_name || 'Unknown',
        description: revision.change_description || '',
        color: revision.is_current ? '#4caf50' : '#2196f3'
      }));
    });

    // Rendered markdown content
    const renderedContent = computed(() => {
      if (!currentPage.value || !currentPage.value.content) return '';
      
      // Convert markdown to HTML and sanitize
      const html = marked(currentPage.value.content);
      return DOMPurify.sanitize(html);
    });

    // Format date
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    };

    // Format tree nodes for TreeTable component
//    const formatTreeNodes = (tree, parent = null) => {
      if (!tree || tree.length === 0) return [];
      
      return tree.map(item => {
        const node = {
          key: item.id,
          id: item.id,
          title: item.title,
          data: {
            id: item.id,
            title: item.title,
            createdBy: item.created_by_name,
            updatedAt: item.updated_at
          }
        };
        
        // If item has children, add them
        if (item.children && item.children.length > 0) {
          node.children = formatTreeNodes(item.children, item);
        }
        
        return node;
      });
    };

    // Check if a page is a descendant of another page
    const isDescendant = (pageId, potentialAncestorId) => {
      // Find the page
      const page = wikiPages.value.find(p => p.id === pageId);
      if (!page) return false;
      
      // If the page has no parent, it can't be a descendant
      if (!page.parent_id) return false;
      
      // If the page's parent is the potential ancestor, it is a descendant
      if (page.parent_id === potentialAncestorId) return true;
      
      // Recursively check if the page's parent is a descendant of the potential ancestor
      return isDescendant(page.parent_id, potentialAncestorId);
    };

    // Handle search input with debounce
    const debounceSearch = () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      searchTimeout = setTimeout(() => {
        if (searchQuery.value.length >= 2) {
          performSearch();
        } else if (searchQuery.value.length === 0) {
          clearSearch();
        }
      }, 300);
    };

    // Perform search
    const performSearch = async () => {
      if (!searchQuery.value || searchQuery.value.length < 2) return;
      
      isSearching.value = true;
      try {
        await store.dispatch('knowledge/searchWikiPages', searchQuery.value);
      } catch (error) {
        console.error('Error searching wiki:', error);
      } finally {
        isSearching.value = false;
      }
    };

    // Clear search
    const clearSearch = () => {
      searchQuery.value = '';
      store.dispatch('knowledge/setSearchResults', []);
    };

    // View wiki page
    const viewPage = async (id) => {
      if (!id) {
        // Reset current page if no ID provided
        store.commit('knowledge/setCurrentPage', null);
        return;
      }
      
      try {
        await store.dispatch('knowledge/fetchWikiPage', id);
        
        // Expand parents in tree
        const page = store.state.knowledge.currentPage;
        if (page && page.parent_id) {
          expandParentNodes(page.parent_id);
        }
        
        // Navigate to page URL if not already there
        if (router.currentRoute.value.path !== `/wiki/${id}`) {
          router.push(`/wiki/${id}`);
        }
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load wiki page',
          life: 3000
        });
      }
    };

    // Expand parent nodes in tree
    const expandParentNodes = (parentId) => {
      if (!parentId) return;
      
      expandedKeys.value[parentId] = true;
      
      // Find parent's parent to expand it too
      const parentPage = wikiPages.value.find(p => p.id === parentId);
      if (parentPage && parentPage.parent_id) {
        expandParentNodes(parentPage.parent_id);
      }
    };

    // Open new page dialog
    const openNewPageDialog = () => {
      resetPageForm();
      dialogMode.value = 'create';
      pageDialogVisible.value = true;
    };

    // Edit current page
    const editPage = () => {
      if (!currentPage.value) return;
      
      resetPageForm();
      
      // Copy data to form
      pageForm.id = currentPage.value.id;
      pageForm.title = currentPage.value.title;
      pageForm.content = currentPage.value.content;
      pageForm.parentId = currentPage.value.parent_id;
      pageForm.departmentId = currentPage.value.department_id;
      pageForm.tags = currentPage.value.tags || [];
      
      dialogMode.value = 'edit';
      pageDialogVisible.value = true;
    };

    // View page revisions
    const viewRevisions = async () => {
      if (!currentPage.value) return;
      
      try {
        // If revisions are not already loaded with the page
        if (!pageRevisions.value || pageRevisions.value.length === 0) {
          await store.dispatch('knowledge/fetchPageRevisions', currentPage.value.id);
        }
        
        revisionsDialogVisible.value = true;
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load revision history',
          life: 3000
        });
      }
    };

    // View specific revision
    const viewRevision = async (revisionId) => {
      if (!currentPage.value) return;
      
      try {
        await store.dispatch('knowledge/fetchRevision', {
          id: currentPage.value.id,
          revisionId
        });
        
        // Open edit dialog with revision content
        resetPageForm();
        
        // Get the revision data
        const revision = store.state.knowledge.currentRevision;
        
        pageForm.id = currentPage.value.id;
        pageForm.title = revision.title;
        pageForm.content = revision.content;
        pageForm.parentId = revision.parent_id;
        pageForm.departmentId = revision.department_id;
        pageForm.tags = revision.tags || [];
        
        dialogMode.value = 'edit';
        pageDialogVisible.value = true;
        revisionsDialogVisible.value = false;
        
        // Show info toast
        toast.add({
          severity: 'info',
          summary: 'Viewing Revision',
          detail: `Viewing version from ${formatDate(revision.created_at)}`,
          life: 5000
        });
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load revision',
          life: 3000
        });
      }
    };

    // Restore revision
    const restoreRevision = async (revisionId) => {
      if (!currentPage.value) return;
      
      confirm.require({
        message: 'Are you sure you want to restore this version? Current content will be overwritten.',
        header: 'Restore Confirmation',
        icon: 'pi pi-info-circle',
        acceptClass: 'p-button-primary',
        accept: async () => {
          try {
            // First fetch the revision
            await store.dispatch('knowledge/fetchRevision', {
              id: currentPage.value.id,
              revisionId
            });
            
            // Get the revision data
            const revision = store.state.knowledge.currentRevision;
            
            // Prepare update data
            const updateData = {
              id: currentPage.value.id,
              title: revision.title,
              content: revision.content,
              parentId: revision.parent_id,
              departmentId: revision.department_id,
              tags: revision.tags || [],
              changeDescription: `Restored version from ${formatDate(revision.created_at)}`
            };
            
            // Update page with revision content
            await store.dispatch('knowledge/updateWikiPage', updateData);
            
            // Close dialog and refresh page
            revisionsDialogVisible.value = false;
            await viewPage(currentPage.value.id);
            
            toast.add({
              severity: 'success',
              summary: 'Revision Restored',
              detail: 'The page has been restored to a previous version',
              life: 3000
            });
          } catch (error) {
            toast.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to restore revision',
              life: 3000
            });
          }
        },
        reject: () => {}
      });
    };

    // Confirm delete page
    const confirmDeletePage = () => {
      if (!currentPage.value) return;
      
      confirm.require({
        message: 'Are you sure you want to delete this page? This action cannot be undone.',
        header: 'Delete Confirmation',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deletePage(),
        reject: () => {}
      });
    };

    // Delete page
    const deletePage = async () => {
      if (!currentPage.value) return;
      
      try {
        await store.dispatch('knowledge/deleteWikiPage', currentPage.value.id);
        
        // Navigate back to wiki home
        router.push('/wiki');
        
        // Show success toast
        toast.add({
          severity: 'success',
          summary: 'Page Deleted',
          detail: 'Wiki page has been deleted successfully',
          life: 3000
        });
        
        // Refresh wiki tree
        fetchWikiTree();
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete wiki page',
          life: 3000
        });
      }
    };

    // Close page dialog
    const closePageDialog = () => {
      pageDialogVisible.value = false;
      submitted.value = false;
    };

    // Reset page form
    const resetPageForm = () => {
      Object.assign(pageForm, {
        id: null,
        title: '',
        content: '',
        parentId: null,
        departmentId: null,
        tags: []
      });
    };

    // Show markdown help
    const showMarkdownHelp = () => {
      markdownHelpVisible.value = true;
    };

    // Save page (create or update)
    const savePage = async () => {
      submitted.value = true;
      
      // Validate required fields
      if (!pageForm.title || !pageForm.content) {
        return;
      }
      
      saving.value = true;
      
      try {
        // Prepare page data
        const pageData = {
          title: pageForm.title,
          content: pageForm.content,
          parentId: pageForm.parentId,
          departmentId: pageForm.departmentId,
          tags: pageForm.tags
        };
        
        // Add change description for edit mode
        if (dialogMode.value === 'edit') {
          pageData.changeDescription = 'Updated page content';
        }
        
        let savedPage;
        
        if (dialogMode.value === 'create') {
          // Create new page
          savedPage = await store.dispatch('knowledge/createWikiPage', pageData);
        } else {
          // Update existing page
          savedPage = await store.dispatch('knowledge/updateWikiPage', {
            id: pageForm.id,
            ...pageData
          });
        }
        
        // Close dialog
        pageDialogVisible.value = false;
        submitted.value = false;
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: dialogMode.value === 'create' ? 'Page Created' : 'Page Updated',
          detail: dialogMode.value === 'create' ? 'Wiki page has been created successfully' : 'Wiki page has been updated successfully',
          life: 3000
        });
        
        // Navigate to saved page
        if (savedPage) {
          // Refresh wiki tree first
          await fetchWikiTree();
          
          // Then view the page
          await viewPage(savedPage.id);
        }
      } catch (error) {
        console.error('Error saving wiki page:', error);
        
        const errorMsg = error.response?.data?.message || 'Failed to save wiki page';
        
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

    // Fetch wiki tree
    const fetchWikiTree = async () => {
      try {
        await store.dispatch('knowledge/fetchWikiTree');
      } catch (error) {
        console.error('Error fetching wiki tree:', error);
      }
    };

    // Load initial data
    const loadInitialData = async () => {
      try {
        // Fetch wiki pages and tree structure
        await Promise.all([
          store.dispatch('knowledge/fetchWikiPages'),
          fetchWikiTree()
        ]);
        
        // If route includes an ID, load that page
        const pageId = router.currentRoute.value.params.id;
        if (pageId) {
          await viewPage(pageId);
        }
      } catch (error) {
        console.error('Error loading wiki data:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load wiki data',
          life: 3000
        });
      }
    };

    // Initialize component
    onMounted(() => {
      loadInitialData();
      
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

    // Watch for route changes
    watch(() => router.currentRoute.value.params.id, (newId) => {
      if (newId) {
        viewPage(newId);
      } else {
        // Reset current page if no ID in route
        store.commit('knowledge/setCurrentPage', null);
      }
    });

    return {
      // State
      searchQuery,
      isSearching,
      pageDialogVisible,
      revisionsDialogVisible,
      markdownHelpVisible,
      dialogMode,
      submitted,
      saving,
      expandedKeys,
      pageForm,
      departments,
      
      // Computed properties
      isLoading,
      wikiPages,
      wikiTreeNodes,
      currentPage,
      parentPageOptions,
      breadcrumbItems,
      pageRevisions,
      formattedRevisions,
      renderedContent,
      searchResults,
      
      // Methods
      formatDate,
      debounceSearch,
      clearSearch,
      viewPage,
      openNewPageDialog,
      editPage,
      closePageDialog,
      savePage,
      viewRevisions,
      viewRevision,
      restoreRevision,
      confirmDeletePage,
      showMarkdownHelp
    };
  }
};
</script>

<style scoped>
.wiki-container {
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

/* Wiki content layout */
.wiki-content {
  display: flex;
  gap: 1.5rem;
}

.wiki-sidebar {
  width: 300px;
  flex-shrink: 0;
  height: calc(100vh - 180px);
  overflow-y: auto;
  padding: 1rem;
}

.wiki-main {
  flex: 1;
  min-width: 0; /* For proper text wrapping */
}

.wiki-search {
  margin-bottom: 1.5rem;
}

.wiki-tree-title, .search-results-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--text-color-secondary);
}

/* Wiki tree customization */
.wiki-node {
  padding: 0.375rem 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s;
  position: relative;
  cursor: pointer;
}

.wiki-node:hover {
  background-color: var(--surface-hover);
}

.active-node {
  background-color: var(--primary-color-lighter, rgba(103, 58, 183, 0.1));
  font-weight: 500;
}

/* Search results styling */
.search-results-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.search-result-item {
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  background-color: var(--surface-ground);
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s;
}

.search-result-item:hover {
  background-color: var(--surface-hover);
}

.search-result-title {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.search-result-path {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* Wiki empty states */
.wiki-empty, .wiki-sidebar-loading, .wiki-empty-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-color-secondary);
}

.wiki-empty i, .wiki-empty-results i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

.wiki-empty h2 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

/* Wiki page styling */
.wiki-page {
  padding: 1.5rem;
}

.wiki-page-header {
  margin-bottom: 1.5rem;
}

.wiki-page-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.wiki-page-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.wiki-page-author, .wiki-page-date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.wiki-page-actions {
  margin-left: auto;
}

.wiki-page-content {
  line-height: 1.6;
  font-size: 1rem;
}

.wiki-page-content h1 {
  font-size: 1.75rem;
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.wiki-page-content h2 {
  font-size: 1.5rem;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.wiki-page-content h3 {
  font-size: 1.25rem;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

.wiki-page-content p {
  margin: 0 0 1rem 0;
}

.wiki-page-content ul, .wiki-page-content ol {
  margin: 0 0 1rem 0;
  padding-left: 1.5rem;
}

.wiki-page-content code {
  background-color: var(--surface-ground);
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-family: monospace;
}

.wiki-page-content pre {
  background-color: var(--surface-ground);
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0 0 1rem 0;
}

.wiki-page-content pre code {
  background-color: transparent;
  padding: 0;
}

.wiki-page-content blockquote {
  border-left: 4px solid var(--primary-color-lighter, rgba(103, 58, 183, 0.3));
  padding-left: 1rem;
  margin: 0 0 1rem 0;
  color: var(--text-color-secondary);
}

.wiki-page-footer {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}

.wiki-page-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.wiki-tag {
  background-color: var(--surface-ground);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
}

/* Revision dialog styling */
.revision-item {
  padding: 0.5rem 0;
}

.revision-content {
  background-color: var(--surface-ground);
  padding: 1rem;
  border-radius: 4px;
}

.revision-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.revision-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.revision-description {
  font-size: 0.875rem;
  margin: 0.5rem 0;
}

.revision-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* Markdown help styling */
.markdown-help-section {
  margin-bottom: 1.5rem;
}

.markdown-help-section h3 {
  margin: 0 0 0.75rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.markdown-example-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.markdown-example {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
}

.markdown-code {
  background-color: var(--surface-ground);
  padding: 0.5rem;
  border-radius: 4px 4px 0 0;
  font-family: monospace;
  border: 1px solid var(--surface-border);
}

.markdown-result {
  background-color: var(--surface-card);
  padding: 0.5rem;
  border-radius: 0 0 4px 4px;
  border: 1px solid var(--surface-border);
  border-top: none;
}

/* Helper text for form fields */
.form-helper-text {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

/* Responsive adjustments */
@media screen and (max-width: 991px) {
  .wiki-content {
    flex-direction: column;
  }
  
  .wiki-sidebar {
    width: 100%;
    height: auto;
    max-height: 300px;
    margin-bottom: 1rem;
  }
  
  .wiki-page-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .wiki-page-actions {
    margin-left: 0;
    margin-top: 0.5rem;
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}

@media screen and (max-width: 576px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .markdown-example-grid {
    grid-template-columns: 1fr;
  }
  
  .wiki-page-title {
    font-size: 1.5rem;
  }
}
</style>