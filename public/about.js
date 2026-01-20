/**
 * about.js - Store-connected about page
 * Manages dynamic content based on flight selection and metadata
 */

import { createStore } from './store/createStore.js';
import { rootReducer } from './store/reducers/rootReducer.js';
import { thunkMiddleware } from './store/middleware/apiMiddleware.js';
import { devLoggerMiddleware } from './store/middleware/loggerMiddleware.js';

// Import actions
import {
  fetchFlightsForProject,
  fetchVariables
} from './store/actions/metadataActions.js';

// Import selectors
import {
  getCurrentFlightNumber,
  getCurrentFlightId
} from './store/selectors/selectors.js';

// Import reusable components
import FlightDropdown from './modules/components/flightDropdown.js';
import VariablesListTable from './modules/components/VariablesListTable.js';

// ========================================
// Initialize Store
// ========================================

const initialState = {
  metadata: {
    projects: [],
    flights: {},
    variables: []
  },
  selection: {
    projectName: 'GOTHAAM',
    flightId: null,
    flightNumber: null,
    selectedChartIndex: 0,
    selectedVariables: ['atx', 'wic', 'wdc', 'dpxc', 'psxc', 'tasx', 'rhum', 'palt']
  },
  data: {
    flightData: {}
  },
  ui: {
    timeline: {
      isPlaying: false,
      progress: 0,
      currentTime: null
    },
    charts: {
      zoomDomains: {},
      visibleCount: 4
    },
    map: {
      showRadar: true
    },
    loading: {
      projects: false,
      flights: false,
      flightData: false,
      variables: false
    },
    errors: {
      projects: null,
      flights: null,
      flightData: null,
      variables: null
    }
  }
};

const middleware = [thunkMiddleware, devLoggerMiddleware];
const store = createStore(rootReducer, initialState, middleware);

console.log('[about] Store created:', store.getState());

// ========================================
// Initialize Reusable Components
// ========================================

// Create flight dropdown component (uses existing HTML elements)
const flightDropdown = new FlightDropdown(store, {
  dropdownId: 'flight-dropdown',
  triggerId: 'flight-trigger',
  menuId: 'flight-menu',
  createDOM: false
});

// Create variables list table (will be injected into existing container)
const variablesTable = new VariablesListTable(store, {
  containerId: 'variables-table-container',
  tableClass: 'variables-list-table',
  showCategory: false,
  showUnits: false,
  showActions: false,
  searchable: true,
  itemsPerPage: 8,
  scrollable: true
});

// ========================================
// Time Range Display
// ========================================

function updateTimeRangeDisplay() {
  const state = store.getState();
  const flightId = getCurrentFlightId(state);
  const flightData = state.data.flightData[flightId];

  const timeRangeElement = document.getElementById('time-range-text');
  if (!timeRangeElement) return;

  if (flightData && flightData.timeRange) {
    const start = new Date(flightData.timeRange.start).toLocaleTimeString();
    const end = new Date(flightData.timeRange.end).toLocaleTimeString();
    timeRangeElement.textContent = `${start} - ${end}`;
  } else {
    timeRangeElement.textContent = 'Select Time Range';
  }
}

// ========================================
// Projects Table Management
// ========================================

// Sample projects data - in a real app, this would come from the API
const SAMPLE_PROJECTS = [
  { year: 2024, name: 'MAIRE24', status: 'Paused', type: 'Bravo', aircraft: 'GV', contact: 'Evan Flores' },
  { year: 2024, name: 'ACES', status: 'Complete', type: 'Alfa', aircraft: 'GV', contact: 'Arlene Wilson' },
  { year: 2024, name: 'CAESAR', status: 'Data Review', type: 'Bravo', aircraft: 'C-130', contact: 'Jennie Cooper' },
  { year: 2022, name: 'MAIRE', status: 'Complete', type: 'Alfa', aircraft: 'C-130', contact: 'Philip Steward' },
  { year: 2022, name: 'ACCLIP', status: 'Pending', type: 'Bravo', aircraft: 'GV', contact: 'Jorge Black' },
  { year: 2021, name: 'IBM', status: 'Danger', type: 'Gold', aircraft: 'GV', contact: 'Gladys Jones' },
  { year: 2021, name: 'IBM', status: 'Danger', type: 'Gold', aircraft: 'C-130', contact: 'Gladys Jones' }
];

let currentPage = 1;
let rowsPerPage = 6;

function getStatusClass(status) {
  const statusMap = {
    'Complete': 'status-complete',
    'Paused': 'status-paused',
    'Data Review': 'status-review',
    'Pending': 'status-pending',
    'Danger': 'status-danger'
  };
  return statusMap[status] || 'status-pending';
}

function renderProjectsTable() {
  const tbody = document.getElementById('projects-table-body');
  if (!tbody) return;

  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const pageProjects = SAMPLE_PROJECTS.slice(startIdx, endIdx);

  tbody.innerHTML = '';

  pageProjects.forEach(project => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${project.year}</td>
      <td>${project.name}</td>
      <td><span class="status-badge ${getStatusClass(project.status)}">${project.status}</span></td>
      <td>${project.type}</td>
      <td><span class="aircraft-badge">${project.aircraft}</span></td>
      <td><span class="user-name">${project.contact}</span></td>
      <td><button class="table-action-btn" title="More options"><i class="fas fa-ellipsis-v"></i></button></td>
    `;
    tbody.appendChild(row);
  });

  updatePaginationControls();
}

function updatePaginationControls() {
  const totalPages = Math.ceil(SAMPLE_PROJECTS.length / rowsPerPage);
  const pageInput = document.getElementById('page-input');
  const totalPagesSpan = document.getElementById('total-pages');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  if (pageInput) pageInput.value = currentPage;
  if (totalPagesSpan) totalPagesSpan.textContent = totalPages;

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function setupTablePagination() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const pageInput = document.getElementById('page-input');
  const rowsSelect = document.getElementById('rows-per-page');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderProjectsTable();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(SAMPLE_PROJECTS.length / rowsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderProjectsTable();
      }
    });
  }

  if (pageInput) {
    pageInput.addEventListener('change', (e) => {
      const totalPages = Math.ceil(SAMPLE_PROJECTS.length / rowsPerPage);
      const newPage = Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, totalPages));
      currentPage = newPage;
      renderProjectsTable();
    });
  }

  if (rowsSelect) {
    rowsSelect.addEventListener('change', (e) => {
      rowsPerPage = parseInt(e.target.value, 10);
      currentPage = 1;
      renderProjectsTable();
    });
  }
}

// ========================================
// Tab Navigation
// ========================================

function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabYear = tab.getAttribute('data-tab');
      console.log('[about] Tab switched to:', tabYear);
      // Filter projects by year if needed
    });
  });
}

// ========================================
// Expand Buttons
// ========================================

function setupExpandButtons() {
  const expandBtns = document.querySelectorAll('.card-expand-btn');

  expandBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.info-card');
      if (card) {
        card.classList.toggle('expanded');
        console.log('[about] Card toggled');
      }
    });
  });
}

// ========================================
// Store Subscription
// ========================================

function onStoreChange() {
  const state = store.getState();

  // Update time range display
  updateTimeRangeDisplay();
}

store.subscribe(onStoreChange);

// ========================================
// Initialize Page
// ========================================

console.log('[about] Initializing about page');

// Setup UI interactions for table and tabs
setupTablePagination();
setupTabNavigation();
setupExpandButtons();

// Fetch initial data
store.dispatch(fetchVariables());
store.dispatch(fetchFlightsForProject(initialState.selection.projectName));

// Render table with sample data
renderProjectsTable();

// Initial state update
onStoreChange();

console.log('[about] Page initialization complete');
