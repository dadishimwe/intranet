<template>
  <div class="calendar-container">
    <div class="page-header">
      <h1 class="page-title">Calendar</h1>
      <div class="page-actions">
        <Button 
          label="New Event" 
          icon="pi pi-plus" 
          @click="openNewEventAppDialog"
          class="p-button-primary"
        />
      </div>
    </div>

    <div class="card">
      <div class="calendar-toolbar">
        <div class="view-buttons">
          <SelectButton v-model="calendarView" :options="viewOptions" />
        </div>
        <div class="month-navigation">
          <Button 
            icon="pi pi-chevron-left" 
            class="p-button-text" 
            @click="previousPeriod" 
          />
          <h2 class="calendar-title">{{ currentViewTitle }}</h2>
          <Button 
            icon="pi pi-chevron-right" 
            class="p-button-text" 
            @click="nextPeriod" 
          />
        </div>
        <div class="filter-buttons">
          <MultiSelect 
            v-model="selectedAppDepartments" 
            :options="departments" 
            optionLabel="name" 
            placeholder="All AppDepartments" 
            class="departments-filter" 
            :maxSelectedLabels="1"
          />
          <ToggleButton 
            v-model="showOnlyMyEvents" 
            onLabel="My Events" 
            offLabel="All Events" 
            onIcon="pi pi-user" 
            offIcon="pi pi-users" 
            class="ml-2"
          />
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="calendar-loading">
        <ProgressSpinner />
      </div>

      <!-- Calendar view -->
      <div v-else class="calendar-view">
        <!-- Month view -->
        <FullCalendar 
          v-if="calendarView === 'month'" 
          ref="fullCalendar"
          :options="calendarOptions"
        />

        <!-- Week view -->
        <FullCalendar 
          v-else-if="calendarView === 'week'" 
          ref="fullCalendar"
          :options="calendarWeekOptions"
        />

        <!-- Day view -->
        <FullCalendar 
          v-else-if="calendarView === 'day'" 
          ref="fullCalendar"
          :options="calendarDayOptions"
        />

        <!-- List view -->
        <FullCalendar 
          v-else-if="calendarView === 'list'" 
          ref="fullCalendar"
          :options="calendarListOptions"
        />
      </div>
    </div>

    <!-- Event Dialog -->
    <Dialog 
      v-model:visible="eventDialogVisible" 
      :style="{ width: '500px' }" 
      :header="dialogMode === 'create' ? 'New Event' : 'Edit Event'" 
      :modal="true" 
      class="p-fluid"
    >
      <div class="event-form">
        <div class="field">
          <label for="title">Title *</label>
          <InputText 
            id="title" 
            v-model="event.title" 
            required 
            autofocus 
            :class="{ 'p-invalid': submitted && !event.title }"
          />
          <small v-if="submitted && !event.title" class="p-error">Title is required.</small>
        </div>

        <div class="field">
          <label for="description">Description</label>
          <Textarea 
            id="description" 
            v-model="event.description" 
            rows="3" 
            autoResize 
          />
        </div>

        <div class="field">
          <label>All Day</label>
          <div class="field-checkbox">
            <Checkbox v-model="event.allDay" binary id="allDay" />
            <label for="allDay">Event runs all day</label>
          </div>
        </div>

        <div class="field">
          <label>Date/Time *</label>
          <div class="date-time-fields">
            <div class="start-datetime">
              <Calendar 
                v-model="event.startDate" 
                dateFormat="mm/dd/yy" 
                placeholder="Start Date" 
                :showTime="!event.allDay"
                :timeOnly="false" 
                :showIcon="true"
                :class="{ 'p-invalid': submitted && !event.startDate }"
              />
              <small v-if="submitted && !event.startDate" class="p-error">Start date is required.</small>
            </div>

            <div class="end-datetime">
              <Calendar 
                v-model="event.endDate" 
                dateFormat="mm/dd/yy" 
                placeholder="End Date" 
                :showTime="!event.allDay"
                :timeOnly="false" 
                :showIcon="true"
                :class="{ 'p-invalid': submitted && !event.endDate }"
              />
              <small v-if="submitted && !event.endDate" class="p-error">End date is required.</small>
              <small v-if="dateRangeError" class="p-error">End date must be after start date.</small>
            </div>
          </div>
        </div>

        <div class="field">
          <label for="location">Location</label>
          <InputText id="location" v-model="event.location" />
        </div>

        <div class="field">
          <label for="departmentId">Department</label>
          <Dropdown 
            id="departmentId" 
            v-model="event.departmentId" 
            :options="departments" 
            optionLabel="name" 
            optionValue="id" 
            placeholder="Select Department"
          />
        </div>

        <div class="field">
          <label>Visibility</label>
          <div class="field-checkbox">
            <Checkbox v-model="event.isCompanyWide" binary id="isCompanyWide" />
            <label for="isCompanyWide">Company-wide event</label>
          </div>
          <small>If checked, all employees will see this event</small>
        </div>

        <div class="field">
          <label for="attendees">Attendees</label>
          <MultiSelect 
            id="attendees" 
            v-model="event.attendees" 
            :options="users" 
            optionLabel="fullName" 
            optionValue="id" 
            placeholder="Select Attendees"
            display="chip"
          />
        </div>
      </div>

      <template #footer>
        <Button 
          label="Cancel" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="closeEventAppDialog" 
        />
        <Button 
          v-if="dialogMode === 'edit' && canDeleteEvent" 
          label="Delete" 
          icon="pi pi-trash" 
          class="p-button-danger mr-2" 
          @click="confirmDeleteEvent" 
        />
        <Button 
          label="Save" 
          icon="pi pi-check" 
          @click="saveEvent" 
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- Event Details Dialog -->
    <Dialog 
      v-model:visible="eventDetailsVisible" 
      :style="{ width: '500px' }" 
      :header="selectedEvent.title" 
      :modal="true"
    >
      <div v-if="selectedEvent" class="event-details">
        <div class="event-detail-item">
          <i class="pi pi-calendar"></i>
          <span v-if="selectedEvent.allDay">
            {{ formatDate(selectedEvent.startTime) }}
            <span v-if="!isSameDay(selectedEvent.startTime, selectedEvent.endTime)">
              - {{ formatDate(selectedEvent.endTime) }}
            </span>
            <Tag value="All Day" class="ml-2" />
          </span>
          <span v-else>
            {{ formatDateTime(selectedEvent.startTime) }} - {{ formatTime(selectedEvent.endTime) }}
          </span>
        </div>

        <div v-if="selectedEvent.location" class="event-detail-item">
          <i class="pi pi-map-marker"></i>
          <span>{{ selectedEvent.location }}</span>
        </div>

        <div v-if="selectedEvent.description" class="event-description">
          {{ selectedEvent.description }}
        </div>

        <div v-if="selectedEvent.department_name" class="event-detail-item">
          <i class="pi pi-sitemap"></i>
          <span>Department: {{ selectedEvent.department_name }}</span>
        </div>

        <div v-if="selectedEvent.created_by_name" class="event-detail-item">
          <i class="pi pi-user"></i>
          <span>Created by: {{ selectedEvent.created_by_name }}</span>
        </div>

        <Divider v-if="selectedEvent.attendees && selectedEvent.attendees.length > 0" />

        <div v-if="selectedEvent.attendees && selectedEvent.attendees.length > 0" class="attendees-section">
          <h3>Attendees</h3>
          <ul class="attendee-list">
            <li v-for="attendee in selectedEvent.attendees" :key="attendee.user_id" class="attendee-item">
              <div class="attendee-avatar">
                <Avatar 
                  :image="attendee.profile_image" 
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
              </div>
              <div class="attendee-info">
                <span class="attendee-name">{{ attendee.first_name }} {{ attendee.last_name }}</span>
                <Tag 
                  :value="capitalizeFirst(attendee.status)" 
                  :severity="getAttendanceTagSeverity(attendee.status)" 
                  class="attendee-status"
                />
              </div>
            </li>
          </ul>
        </div>

        <div v-if="isAttendee" class="response-section">
          <Divider />
          <h3>Your Response</h3>
          <div class="response-buttons">
            <Button 
              label="Accept" 
              class="p-button-success mr-2" 
              @click="updateAttendance('accepted')" 
              :disabled="currentAttendanceStatus === 'accepted'" 
            />
            <Button 
              label="Maybe" 
              class="p-button-warning mr-2" 
              @click="updateAttendance('tentative')" 
              :disabled="currentAttendanceStatus === 'tentative'" 
            />
            <Button 
              label="Decline" 
              class="p-button-danger" 
              @click="updateAttendance('declined')" 
              :disabled="currentAttendanceStatus === 'declined'" 
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button 
          label="Close" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="eventDetailsVisible = false" 
        />
        <Button 
          v-if="canEditEvent" 
          label="Edit" 
          icon="pi pi-pencil" 
          @click="editSelectedEvent" 
        />
      </template>
    </Dialog>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog />
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';

// PrimeVue components
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import MultiSelect from 'primevue/multiselect';
import ToggleButton from 'primevue/togglebutton';
import ProgressSpinner from 'primevue/progressspinner';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Avatar from 'primevue/avatar';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import ConfirmDialog from 'primevue/confirmdialog';

export default {
  name: 'CalendarView',
  components: {
    FullCalendar,
    Button,
    SelectButton,
    MultiSelect,
    ToggleButton,
    ProgressSpinner,
    Dialog,
    InputText,
    Textarea,
    Checkbox,
    Calendar,
    Dropdown,
    Avatar,
    Tag,
    Divider,
    ConfirmDialog
  },
  setup() {
    const store = useStore();
    const confirm = useConfirm();
    const toast = useToast();
    const fullCalendar = ref(null);

    // State
    const loading = ref(true);
    const events = ref([]);
    const calendarView = ref('month');
    const currentDate = ref(new Date());
    const selectedDepartments = ref([]);
    const showOnlyMyEvents = ref(false);
    const saving = ref(false);
    const submitted = ref(false);
    const dateRangeError = ref(false);

    // Event dialog state
    const eventDialogVisible = ref(false);
    const dialogMode = ref('create'); // 'create' or 'edit'
    
    // Event details dialog
    const eventDetailsVisible = ref(false);
    const selectedEvent = ref(null);
    
    // Form state
    const event = reactive({
      id: null,
      title: '',
      description: '',
      startDate: null,
      endDate: null,
      allDay: false,
      location: '',
      departmentId: null,
      isCompanyWide: false,
      attendees: []
    });

    // Options for calendar view selector
    const viewOptions = [
      { label: 'Month', value: 'month' },
      { label: 'Week', value: 'week' },
      { label: 'Day', value: 'day' },
      { label: 'List', value: 'list' }
    ];

    // Mock departments data (should be fetched from API)
    const departments = ref([]);
    
    // Mock users data (should be fetched from API)
    const users = ref([]);

    // Calendar options
    const calendarOptions = computed(() => ({
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      headerToolbar: false, // We're using our own header
      editable: true,
      selectable: true,
      selectMirror: true,
      dayMaxEvents: true,
      weekends: true,
      initialDate: currentDate.value,
      events: mapEventsToCalendar(events.value),
      eventClick: handleEventClick,
      dateClick: handleDateClick,
      select: handleDateSelect,
      eventDrop: handleEventDrop,
      eventResize: handleEventResize,
      height: 'auto'
    }));

    // Week view options
    const calendarWeekOptions = computed(() => ({
      ...calendarOptions.value,
      initialView: 'timeGridWeek',
      allDaySlot: true,
      slotMinTime: '07:00:00',
      slotMaxTime: '20:00:00'
    }));

    // Day view options
    const calendarDayOptions = computed(() => ({
      ...calendarOptions.value,
      initialView: 'timeGridDay',
      allDaySlot: true,
      slotMinTime: '07:00:00',
      slotMaxTime: '20:00:00'
    }));

    // List view options
    const calendarListOptions = computed(() => ({
      ...calendarOptions.value,
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
      initialView: 'listWeek'
    }));

    // Current view title (month/year)
    const currentViewTitle = computed(() => {
      const date = currentDate.value;
      const formatter = new Intl.DateTimeFormat('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
      
      return formatter.format(date);
    });

    // Check if current user is an attendee of the selected event
    const isAttendee = computed(() => {
      if (!selectedEvent.value || !selectedEvent.value.attendees) return false;
      
      const currentUserId = store.getters['auth/currentUser']?.id;
      return selectedEvent.value.attendees.some(attendee => 
        attendee.user_id === currentUserId
      );
    });

    // Get current user's attendance status
    const currentAttendanceStatus = computed(() => {
      if (!isAttendee.value) return null;
      
      const currentUserId = store.getters['auth/currentUser']?.id;
      const attendee = selectedEvent.value.attendees.find(a => 
        a.user_id === currentUserId
      );
      
      return attendee ? attendee.status : null;
    });

    // Check if user can edit the selected event
    const canEditEvent = computed(() => {
      if (!selectedEvent.value) return false;
      
      const currentUser = store.getters['auth/currentUser'];
      if (!currentUser) return false;
      
      // Admin can edit any event
      if (store.getters['auth/isAdmin']) return true;
      
      // Creator can edit their own event
      return selectedEvent.value.created_by === currentUser.id;
    });

    // Check if user can delete the selected event
    const canDeleteEvent = computed(() => {
      return canEditEvent.value;
    });

    // Methods
    const fetchEvents = async () => {
      try {
        loading.value = true;
        
        // Build filter query
        const filters = {};
        
        // Date range for current view
        const calendarApi = fullCalendar.value?.getApi();
        if (calendarApi) {
          const view = calendarApi.view;
          filters.start = view.activeStart.toISOString();
          filters.end = view.activeEnd.toISOString();
        }
        
        // Department filter
        if (selectedDepartments.value.length > 0) {
          filters.departmentId = selectedDepartments.value[0].id;
        }
        
        // Show only my events filter
        if (showOnlyMyEvents.value) {
          filters.userId = store.getters['auth/currentUser']?.id;
        }
        
        // Fetch events from API
//        const response = await fetch('/api/calendar', { 
          params: filters 
        });
        
        // For now, using mock data since we don't have the actual API integrated
        events.value = await mockFetchEvents();
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load events',
          life: 3000
        });
      } finally {
        loading.value = false;
      }
    };

    // Mock event data fetch function 
    const mockFetchEvents = () => {
      // Return a promise to simulate API call
      return new Promise(resolve => {
        setTimeout(() => {
          resolve([
            {
              id: '1',
              title: 'Annual Budget Meeting',
              description: 'Review annual budget and forecast for next fiscal year',
              start_time: new Date(new Date().getFullYear(), new Date().getMonth(), 15, 10, 0),
              end_time: new Date(new Date().getFullYear(), new Date().getMonth(), 15, 12, 0),
              all_day: false,
              location: 'Conference Room A',
              created_by: 'admin',
              created_by_name: 'Admin User',
              department_id: '1',
              department_name: 'Finance',
              is_company_wide: true,
              attendees: [
                {
                  user_id: '1',
                  first_name: 'John',
                  last_name: 'Doe',
                  email: 'john@example.com',
                  status: 'accepted'
                },
                {
                  user_id: '2',
                  first_name: 'Jane',
                  last_name: 'Smith',
                  email: 'jane@example.com',
                  status: 'tentative'
                }
              ]
            },
            {
              id: '2',
              title: 'Team Building Event',
              description: 'Company-wide team building activities',
              start_time: new Date(new Date().getFullYear(), new Date().getMonth(), 22),
              end_time: new Date(new Date().getFullYear(), new Date().getMonth(), 23),
              all_day: true,
              location: 'City Park',
              created_by: 'admin',
              created_by_name: 'Admin User',
              department_id: null,
              department_name: null,
              is_company_wide: true,
              attendees: []
            }
          ]);
        }, 500);
      });
    };

    // Mock data for departments
    const fetchDepartments = () => {
      departments.value = [
        { id: '1', name: 'Finance' },
        { id: '2', name: 'Human Resources' },
        { id: '3', name: 'Marketing' },
        { id: '4', name: 'Engineering' },
        { id: '5', name: 'Operations' }
      ];
    };

    // Mock data for users
    const fetchUsers = () => {
      users.value = [
        { id: '1', fullName: 'John Doe', email: 'john@example.com' },
        { id: '2', fullName: 'Jane Smith', email: 'jane@example.com' },
        { id: '3', fullName: 'Bob Johnson', email: 'bob@example.com' },
        { id: '4', fullName: 'Alice Williams', email: 'alice@example.com' }
      ];
    };

    // Map events to FullCalendar format
    const mapEventsToCalendar = (eventsData) => {
      return eventsData.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start_time,
        end: event.end_time,
        allDay: event.all_day,
        extendedProps: {
          description: event.description,
          location: event.location,
          departmentId: event.department_id,
          departmentName: event.department_name,
          isCompanyWide: event.is_company_wide,
          createdBy: event.created_by,
          createdByName: event.created_by_name,
          attendees: event.attendees
        },
        backgroundColor: getEventColor(event),
        borderColor: getEventColor(event)
      }));
    };

    // Determine event color based on department or other attributes
    const getEventColor = (event) => {
      // Company-wide events are blue
      if (event.is_company_wide) return '#3B82F6';
      
      // Color based on department
      switch (event.department_id) {
        case '1': return '#22C55E'; // Finance - green
        case '2': return '#F59E0B'; // HR - yellow
        case '3': return '#8B5CF6'; // Marketing - purple
        case '4': return '#EC4899'; // Engineering - pink
        case '5': return '#14B8A6'; // Operations - teal
        default: return '#64748B'; // Default - gray
      }
    };

    // Handle clicking on an event
    const handleEventClick = (info) => {
      // Get the clicked event data
      const eventId = info.event.id;
      
      // Find the full event details
      const eventData = events.value.find(e => e.id === eventId);
      
      if (eventData) {
        selectedEvent.value = eventData;
        eventDetailsVisible.value = true;
      }
    };

    // Handle clicking on a date
    const handleDateClick = (info) => {
      // Set start date to clicked date
      const clickedDate = new Date(info.date);
      resetEventForm();
      
      event.startDate = clickedDate;
      event.endDate = new Date(clickedDate.getTime() + 60 * 60 * 1000); // +1 hour
      
      dialogMode.value = 'create';
      eventDialogVisible.value = true;
    };

    // Handle selecting a date range
    const handleDateSelect = (info) => {
      resetEventForm();
      
      event.startDate = new Date(info.start);
      event.endDate = new Date(info.end);
      event.allDay = info.allDay;
      
      dialogMode.value = 'create';
      eventDialogVisible.value = true;
    };

    // Handle dragging an event
    const handleEventDrop = (info) => {
      const eventId = info.event.id;
      const eventData = events.value.find(e => e.id === eventId);
      
      if (eventData) {
        // Update event dates
        const updatedEvent = {
          ...eventData,
          start_time: info.event.start,
          end_time: info.event.end || info.event.start,
          all_day: info.event.allDay
        };
        
        // Optimistically update the UI
        const index = events.value.findIndex(e => e.id === eventId);
        if (index !== -1) {
          events.value[index] = updatedEvent;
        }
        
        // Save to server (would use real API in production)
        saveEventToServer(updatedEvent)
          .then(() => {
            toast.add({
              severity: 'success',
              summary: 'Event Updated',
              detail: 'Event dates updated successfully',
              life: 3000
            });
          })
          .catch(() => {
            // Revert the change in UI if save fails
            info.revert();
            toast.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update event',
              life: 3000
            });
          });
      }
    };

    // Handle resizing an event
    const handleEventResize = (info) => {
      // Similar to handleEventDrop
      const eventId = info.event.id;
      const eventData = events.value.find(e => e.id === eventId);
      
      if (eventData) {
        // Update event end date
        const updatedEvent = {
          ...eventData,
          end_time: info.event.end
        };
        
        // Optimistically update the UI
        const index = events.value.findIndex(e => e.id === eventId);
        if (index !== -1) {
          events.value[index] = updatedEvent;
        }
        
        // Save to server
        saveEventToServer(updatedEvent)
          .then(() => {
            toast.add({
              severity: 'success',
              summary: 'Event Updated',
              detail: 'Event duration updated successfully',
              life: 3000
            });
          })
          .catch(() => {
            // Revert the change in UI if save fails
            info.revert();
            toast.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update event',
              life: 3000
            });
          });
      }
    };

    // Change calendar view to previous month/week/day
    const previousPeriod = () => {
      const calendarApi = fullCalendar.value.getApi();
      calendarApi.prev();
      currentDate.value = calendarApi.getDate();
    };

    // Change calendar view to next month/week/day
    const nextPeriod = () => {
      const calendarApi = fullCalendar.value.getApi();
      calendarApi.next();
      currentDate.value = calendarApi.getDate();
    };

    // Open dialog to create a new event
    const openNewEventDialog = () => {
      resetEventForm();
      
      // Set default start/end times
      const now = new Date();
      now.setMinutes(0, 0, 0); // Round to nearest hour
      now.setHours(now.getHours() + 1);
      
      event.startDate = now;
      event.endDate = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
      
      dialogMode.value = 'create';
      eventDialogVisible.value = true;
    };

    // Close event dialog
    const closeEventDialog = () => {
      eventDialogVisible.value = false;
      submitted.value = false;
      dateRangeError.value = false;
    };

    // Reset event form
    const resetEventForm = () => {
      event.id = null;
      event.title = '';
      event.description = '';
      event.startDate = null;
      event.endDate = null;
      event.allDay = false;
      event.location = '';
      event.departmentId = null;
      event.isCompanyWide = false;
      event.attendees = [];
    };

    // Validate event form
    const validateEventForm = () => {
      dateRangeError.value = false;
      
      // Check required fields
      if (!event.title || !event.startDate || !event.endDate) {
        return false;
      }
      
      // Check date range
      if (event.startDate > event.endDate) {
        dateRangeError.value = true;
        return false;
      }
      
      return true;
    };

    // Save event (create or update)
    const saveEvent = () => {
      submitted.value = true;
      
      if (!validateEventForm()) {
        return;
      }
      
      saving.value = true;
      
      // Prepare event data
      const eventData = {
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startDate,
        endTime: event.endDate,
        allDay: event.allDay,
        location: event.location,
        departmentId: event.departmentId,
        isCompanyWide: event.isCompanyWide,
        attendees: event.attendees
      };
      
      // Save to server (create or update)
      const savePromise = event.id 
        ? saveEventToServer(eventData) // Update
        : createEventOnServer(eventData); // Create
      
      savePromise
        .then(savedEvent => {
          // Update local data
          if (event.id) {
            // Update existing event in list
            const index = events.value.findIndex(e => e.id === event.id);
            if (index !== -1) {
              events.value[index] = savedEvent;
            }
          } else {
            // Add new event to list
            events.value.push(savedEvent);
          }
          
          // Close dialog and show success message
          eventDialogVisible.value = false;
          submitted.value = false;
          
          toast.add({
            severity: 'success',
            summary: dialogMode.value === 'create' ? 'Event Created' : 'Event Updated',
            detail: dialogMode.value === 'create' 
              ? 'Event has been created successfully' 
              : 'Event has been updated successfully',
            life: 3000
          });
          
          // Refresh calendar
          refreshCalendar();
        })
        .catch(error => {
          console.error('Error saving event:', error);
          toast.add({
            severity: 'error',
            summary: 'Error',
            detail: `Failed to ${dialogMode.value === 'create' ? 'create' : 'update'} event`,
            life: 3000
          });
        })
        .finally(() => {
          saving.value = false;
        });
    };
    
    // Mock function to simulate saving to server
    const saveEventToServer = (eventData) => {
      // Simulate API call with a promise
      return new Promise((resolve) => {
        setTimeout(() => {
          // In a real app, this would be a PUT/PATCH request to update the event
          console.log('Updating event on server:', eventData);
          
          // Convert to the format that matches our API response
          const savedEvent = {
            id: eventData.id,
            title: eventData.title,
            description: eventData.description,
            start_time: eventData.startTime,
            end_time: eventData.endTime,
            all_day: eventData.allDay,
            location: eventData.location,
            department_id: eventData.departmentId,
            is_company_wide: eventData.isCompanyWide,
            created_by: store.getters['auth/currentUser']?.id,
            created_by_name: store.getters['auth/userFullName'],
            attendees: eventData.attendees.map(id => {
              const user = users.value.find(u => u.id === id);
              return {
                user_id: id,
                first_name: user?.fullName.split(' ')[0] || '',
                last_name: user?.fullName.split(' ')[1] || '',
                email: user?.email || '',
                status: 'pending'
              };
            })
          };
          
          // Find department name if departmentId is provided
          if (eventData.departmentId) {
            const dept = departments.value.find(d => d.id === eventData.departmentId);
            savedEvent.department_name = dept ? dept.name : null;
          }
          
          resolve(savedEvent);
        }, 500);
      });
    };
    
    // Mock function to simulate creating event on server
    const createEventOnServer = (eventData) => {
      // Simulate API call with a promise
      return new Promise((resolve) => {
        setTimeout(() => {
          // In a real app, this would be a POST request to create the event
          console.log('Creating event on server:', eventData);
          
          // Generate a fake ID for the new event
          const newId = Math.random().toString(36).substring(2, 11);
          
          // Convert to the format that matches our API response
          const savedEvent = {
            id: newId,
            title: eventData.title,
            description: eventData.description,
            start_time: eventData.startTime,
            end_time: eventData.endTime,
            all_day: eventData.allDay,
            location: eventData.location,
            department_id: eventData.departmentId,
            is_company_wide: eventData.isCompanyWide,
            created_by: store.getters['auth/currentUser']?.id,
            created_by_name: store.getters['auth/userFullName'],
            attendees: eventData.attendees.map(id => {
              const user = users.value.find(u => u.id === id);
              return {
                user_id: id,
                first_name: user?.fullName.split(' ')[0] || '',
                last_name: user?.fullName.split(' ')[1] || '',
                email: user?.email || '',
                status: 'pending'
              };
            })
          };
          
          // Find department name if departmentId is provided
          if (eventData.departmentId) {
            const dept = departments.value.find(d => d.id === eventData.departmentId);
            savedEvent.department_name = dept ? dept.name : null;
          }
          
          resolve(savedEvent);
        }, 500);
      });
    };
    
    // Edit selected event
    const editSelectedEvent = () => {
      if (!selectedEvent.value) return;
      
      // Close details dialog
      eventDetailsVisible.value = false;
      
      // Populate form with event data
      event.id = selectedEvent.value.id;
      event.title = selectedEvent.value.title;
      event.description = selectedEvent.value.description || '';
      event.startDate = new Date(selectedEvent.value.start_time);
      event.endDate = new Date(selectedEvent.value.end_time);
      event.allDay = selectedEvent.value.all_day;
      event.location = selectedEvent.value.location || '';
      event.departmentId = selectedEvent.value.department_id;
      event.isCompanyWide = selectedEvent.value.is_company_wide;
      event.attendees = selectedEvent.value.attendees?.map(a => a.user_id) || [];
      
      // Show edit dialog
      dialogMode.value = 'edit';
      eventDialogVisible.value = true;
    };
    
    // Delete event
    const confirmDeleteEvent = () => {
      confirm.require({
        message: 'Are you sure you want to delete this event?',
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteEvent(),
        reject: () => {}
      });
    };
    
    // Delete event after confirmation
    const deleteEvent = () => {
      if (!event.id) return;
      
      saving.value = true;
      
      // Simulate API call
      setTimeout(() => {
        // Remove from local events array
        const index = events.value.findIndex(e => e.id === event.id);
        if (index !== -1) {
          events.value.splice(index, 1);
        }
        
        // Close dialog
        eventDialogVisible.value = false;
        submitted.value = false;
        saving.value = false;
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: 'Event Deleted',
          detail: 'Event has been deleted successfully',
          life: 3000
        });
        
        // Refresh calendar
        refreshCalendar();
      }, 500);
    };
    
    // Update attendance status
    const updateAttendance = (status) => {
      if (!selectedEvent.value || !isAttendee.value) return;
      
      const currentUserId = store.getters['auth/currentUser']?.id;
      
      // Simulate API call
      setTimeout(() => {
        // Update local event data
        const attendee = selectedEvent.value.attendees.find(a => a.user_id === currentUserId);
        if (attendee) {
          attendee.status = status;
        }
        
        // Show success message
        toast.add({
          severity: 'success',
          summary: 'Response Updated',
          detail: `You have ${status} the event`,
          life: 3000
        });
      }, 300);
    };
    
    // Refresh calendar
    const refreshCalendar = () => {
      if (fullCalendar.value) {
        const calendarApi = fullCalendar.value.getApi();
        calendarApi.refetchEvents();
      }
    };
    
    // Format date
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }).format(date);
    };
    
    // Format date and time
    const formatDateTime = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    };
    
    // Format time only
    const formatTime = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    };
    
    // Check if two dates are the same day
    const isSameDay = (date1, date2) => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return d1.getFullYear() === d2.getFullYear() && 
             d1.getMonth() === d2.getMonth() && 
             d1.getDate() === d2.getDate();
    };
    
    // Get tag severity for attendance status
    const getAttendanceTagSeverity = (status) => {
      switch (status) {
        case 'accepted': return 'success';
        case 'declined': return 'danger';
        case 'tentative': return 'warning';
        default: return 'info';
      }
    };
    
    // Capitalize first letter
    const capitalizeFirst = (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    };
    
    // Watch for changes to filters and refresh data
    watch([selectedDepartments, showOnlyMyEvents], () => {
      fetchEvents();
    });
    
    // Watch for calendar view changes
    watch(calendarView, () => {
      if (fullCalendar.value) {
        const calendarApi = fullCalendar.value.getApi();
        
        switch (calendarView.value) {
          case 'month':
            calendarApi.changeView('dayGridMonth');
            break;
          case 'week':
            calendarApi.changeView('timeGridWeek');
            break;
          case 'day':
            calendarApi.changeView('timeGridDay');
            break;
          case 'list':
            calendarApi.changeView('listWeek');
            break;
        }
        
        // Store current date when changing views
        currentDate.value = calendarApi.getDate();
      }
    });
    
    // Fetch data on component mount
    onMounted(() => {
      fetchDepartments();
      fetchUsers();
      fetchEvents();
    });
    
    return {
      loading,
      events,
      calendarView,
      viewOptions,
      currentViewTitle,
      selectedDepartments,
      showOnlyMyEvents,
      departments,
      users,
      calendarOptions,
      calendarWeekOptions,
      calendarDayOptions,
      calendarListOptions,
      fullCalendar,
      eventDialogVisible,
      dialogMode,
      event,
      submitted,
      dateRangeError,
      saving,
      eventDetailsVisible,
      selectedEvent,
      isAttendee,
      currentAttendanceStatus,
      canEditEvent,
      canDeleteEvent,
      
      // Methods
      previousPeriod,
      nextPeriod,
      openNewEventDialog,
      closeEventDialog,
      saveEvent,
      editSelectedEvent,
      confirmDeleteEvent,
      updateAttendance,
      formatDate,
      formatDateTime,
      formatTime,
      isSameDay,
      getAttendanceTagSeverity,
      capitalizeFirst
    };
  }
};
</script>

<style scoped>
.calendar-container {
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

.calendar-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.calendar-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
}

.month-navigation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.calendar-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.departments-filter {
  min-width: 200px;
}

/* Event dialog */
.date-time-fields {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.start-datetime,
.end-datetime {
  flex: 1;
  min-width: 200px;
}

/* Event details */
.event-details {
  color: var(--text-color);
}

.event-detail-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}

.event-detail-item i {
  margin-right: 0.5rem;
  color: var(--primary-color);
  width: 1.25rem;
}

.event-description {
  margin: 1rem 0;
  padding: 0.75rem;
  background-color: var(--surface-ground);
  border-radius: 0.5rem;
  white-space: pre-line;
}

/* Attendees */
.attendees-section h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.attendee-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.attendee-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  background-color: var(--surface-ground);
}

.attendee-avatar {
  margin-right: 0.75rem;
}

.attendee-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
}

.attendee-name {
  font-weight: 500;
}

.attendee-status {
  font-size: 0.75rem;
}

/* Response section */
.response-section h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.response-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Full calendar overrides */
:deep(.fc) {
  --fc-border-color: var(--surface-border);
  --fc-event-border-color: transparent;
  --fc-today-bg-color: rgba(59, 130, 246, 0.1);
  --fc-event-bg-color: var(--primary-color);
  --fc-event-text-color: #fff;
  --fc-page-bg-color: var(--surface-card);
}

:deep(.fc-event) {
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

:deep(.fc-header-toolbar) {
  margin-bottom: 1rem !important;
}

:deep(.fc-day-today) {
  background-color: var(--surface-hover) !important;
}

:deep(.fc-timegrid-event-harness), 
:deep(.fc-daygrid-event-harness) {
  margin-right: 0.25rem;
}

/* Responsive adaptations */
@media screen and (max-width: 768px) {
  .calendar-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .month-navigation {
    width: 100%;
    justify-content: space-between;
  }

  .view-buttons,
  .filter-buttons {
    width: 100%;
    display: flex;
    justify-content: space-between;
  }
  
  .departments-filter {
    width: 100%;
  }
}
</style>