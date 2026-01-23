/**
 * AboutPage.js - SPA Page Module
 * Refactored from about.js to support SPA lifecycle (init/destroy)
 */

// Import actions
import {
  fetchFlightsForProject,
  fetchVariables
} from '../store/actions/metadataActions.js';

// Import selectors
import {
  getCurrentFlightNumber,
  getCurrentFlightId
} from '../store/selectors/selectors.js';

// Import reusable components
import FlightDropdown from '../modules/components/flightDropdown.js';
import VariablesListTable from '../modules/components/VariablesListTable.js';

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

/**
 * Initialize the About page
 * @param {Object} store - Redux-like store instance
 * @param {Object} context - Context from PageManager
 * @returns {Object} Page instance with destroy method
 */
export async function init(store, context = {}) {
  console.log('[AboutPage] Initializing');

  // Track components for cleanup
  const components = {};
  const subscriptions = [];
  const eventListeners = [];

  // Pagination state
  let currentPage = 1;
  let rowsPerPage = 6;

  // ========================================
  // Initialize Reusable Components
  // ========================================

  components.flightDropdown = new FlightDropdown(store, {
    dropdownId: 'flight-dropdown',
    triggerId: 'flight-trigger',
    menuId: 'flight-menu',
    createDOM: false
  });

  components.variablesTable = new VariablesListTable(store, {
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
      const handler = () => {
        if (currentPage > 1) {
          currentPage--;
          renderProjectsTable();
        }
      };
      prevBtn.addEventListener('click', handler);
      eventListeners.push({ element: prevBtn, event: 'click', handler });
    }

    if (nextBtn) {
      const handler = () => {
        const totalPages = Math.ceil(SAMPLE_PROJECTS.length / rowsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderProjectsTable();
        }
      };
      nextBtn.addEventListener('click', handler);
      eventListeners.push({ element: nextBtn, event: 'click', handler });
    }

    if (pageInput) {
      const handler = (e) => {
        const totalPages = Math.ceil(SAMPLE_PROJECTS.length / rowsPerPage);
        const newPage = Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, totalPages));
        currentPage = newPage;
        renderProjectsTable();
      };
      pageInput.addEventListener('change', handler);
      eventListeners.push({ element: pageInput, event: 'change', handler });
    }

    if (rowsSelect) {
      const handler = (e) => {
        rowsPerPage = parseInt(e.target.value, 10);
        currentPage = 1;
        renderProjectsTable();
      };
      rowsSelect.addEventListener('change', handler);
      eventListeners.push({ element: rowsSelect, event: 'change', handler });
    }
  }

  // ========================================
  // Tab Navigation
  // ========================================

  function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(tab => {
      const handler = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabYear = tab.getAttribute('data-tab');
        console.log('[AboutPage] Tab switched to:', tabYear);
      };
      tab.addEventListener('click', handler);
      eventListeners.push({ element: tab, event: 'click', handler });
    });
  }

  // ========================================
  // Expand Buttons
  // ========================================

  function setupExpandButtons() {
    const expandBtns = document.querySelectorAll('.card-expand-btn');

    expandBtns.forEach(btn => {
      const handler = () => {
        const card = btn.closest('.info-card');
        if (card) {
          card.classList.toggle('expanded');
          console.log('[AboutPage] Card toggled');
        }
      };
      btn.addEventListener('click', handler);
      eventListeners.push({ element: btn, event: 'click', handler });
    });
  }

  // ========================================
  // Store Subscription
  // ========================================

  function onStoreChange() {
    updateTimeRangeDisplay();
  }

  const storeSub = store.subscribe(onStoreChange);
  subscriptions.push(storeSub);

  // ========================================
  // Initialize Page
  // ========================================

  console.log('[AboutPage] Setting up UI interactions');

  setupTablePagination();
  setupTabNavigation();
  setupExpandButtons();

  // Fetch initial data
  store.dispatch(fetchVariables());
  const initialProject = store.getState().selection.projectName;
  store.dispatch(fetchFlightsForProject(initialProject));

  // Render table with sample data
  renderProjectsTable();

  // Initial state update
  onStoreChange();

  console.log('[AboutPage] Page initialization complete');

  // ========================================
  // Return Page Instance with Destroy Method
  // ========================================

  return {
    name: 'about',
    components,

    /**
     * Destroy the page - cleanup all resources
     */
    destroy() {
      console.log('[AboutPage] Destroying page');

      // Unsubscribe all store subscriptions
      subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });

      // Remove all event listeners
      eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });

      // Destroy components
      if (components.flightDropdown && components.flightDropdown.destroy) {
        components.flightDropdown.destroy();
      }
      if (components.variablesTable && components.variablesTable.destroy) {
        components.variablesTable.destroy();
      }

      console.log('[AboutPage] Page destroyed');
    }
  };
}

export default init;
