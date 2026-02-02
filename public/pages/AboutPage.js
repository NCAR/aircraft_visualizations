/**
 * AboutPage.js - SPA Page Module
 * Refactored to use about- prefixed classes to avoid conflicts with homepage/realtime
 */

// Import actions
import {
  fetchFlightsForProject,
  fetchVariables,
  fetchProjects
} from '../store/actions/metadataActions.js';

// Import selectors
import {
  getProjects
} from '../store/selectors/selectors.js';

// Import reusable components
import FlightDropdown from '../modules/components/flightDropdown.js';
import VariablesListTable from '../modules/components/VariablesListTable.js';
import ProjectDropdown from '../modules/components/projectDropdown.js';

/**
 * Get status badge class based on status string
 */
function getStatusClass(status) {
  if (!status) return '';
  const s = status.toLowerCase().replace(/\s+/g, '-');
  if (s === 'final' || s === 'completed') return 'about-status-complete';
  if (s === 'paused') return 'about-status-paused';
  if (s === 'preliminary' || s === 'review') return 'about-status-data-review';
  if (s === 'active') return 'about-status-pending';
  if (s === 'danger' || s === 'error') return 'about-status-danger';
  return 'about-status-paused';
}

/**
 * Format status text for display
 */
function formatStatus(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Render the projects table with badges, filters, and pagination
 */
function renderProjectsTable(projects, currentPage, rowsPerPage, sortColumn = null, sortDirection = 'asc') {
  if (!projects || projects.length === 0) {
    return `<div class="about-empty-table">No projects found.</div>`;
  }

  // Sort projects if sortColumn is specified
  let sortedProjects = [...projects];
  if (sortColumn) {
    sortedProjects.sort((a, b) => {
      let aVal, bVal;
      
      switch(sortColumn) {
        case 'year':
          aVal = parseInt(a.year) || 0;
          bVal = parseInt(b.year) || 0;
          break;
        case 'name':
          aVal = (a.project_name || a.name || '').toLowerCase();
          bVal = (b.project_name || b.name || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        case 'aircraft':
          aVal = (a.aircraft || '').toLowerCase();
          bVal = (b.aircraft || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(sortedProjects.length / rowsPerPage);
  const startIdx = (currentPage - 1) * rowsPerPage;
  const pageProjects = sortedProjects.slice(startIdx, startIdx + rowsPerPage);

  let rows = pageProjects.map(p => {
    const name = p.project_name || p.name || '';
    const year = p.year || '';
    const status = p.status || '';
    const aircraft = p.aircraft || '';
    const dataAccess = p.data_access || p.pi || '';

    const statusBadge = status
      ? `<span class="about-status-badge ${getStatusClass(status)}">${formatStatus(status)}</span>`
      : '';

    const aircraftBadge = aircraft
      ? `<span class="about-aircraft-badge">${aircraft}</span>`
      : '';

    return `
      <tr>
        <td>${year}</td>
        <td>${name}</td>
        <td>${statusBadge}</td>
        <td>${aircraftBadge}</td>
        <td>${dataAccess ? `<a href="${dataAccess}" target="_blank" rel="noopener noreferrer" title="View DOI">DOI <i class="fas fa-external-link-alt"></i></a>` : ''}</td>
        <td><button class="about-table-action-btn" title="Actions">&bull;&bull;&bull;</button></td>
      </tr>
    `;
  }).join('');

  const getSortIcon = (col) => {
    if (sortColumn !== col) return 'fas fa-sort';
    return sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  };

  return `
    <table class="about-projects-table">
      <thead>
        <tr>
          <th class="sortable" data-sort="year">Year <i class="about-sort-icon ${getSortIcon('year')}"></i></th>
          <th class="sortable" data-sort="name">Name <i class="about-sort-icon ${getSortIcon('name')}"></i></th>
          <th class="sortable" data-sort="status">Status <i class="about-sort-icon ${getSortIcon('status')}"></i></th>
          <th class="sortable" data-sort="aircraft">Aircraft <i class="about-sort-icon ${getSortIcon('aircraft')}"></i></th>
          <th>Data Access</th>
          <th>Dashboard</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

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
  
  // Sorting state
  let sortColumn = null;
  let sortDirection = 'asc';

  // ========================================
  // Welcome Card Switcher Logic
  // ========================================
  function setupCardSwitcher() {
    const panels = Array.from(document.querySelectorAll('.about-welcome-card .about-switcher-panel'));
    const prevBtn = document.getElementById('about-card-prev');
    const nextBtn = document.getElementById('about-card-next');
    const howtoLink = document.getElementById('about-howto-link');
    let currentIdx = 0;

    function updateDisplay() {
      panels.forEach((el, i) => {
        el.classList.toggle('active', i === currentIdx);
      });
      if (prevBtn) prevBtn.disabled = currentIdx === 0;
      if (nextBtn) nextBtn.disabled = currentIdx === panels.length - 1;
    }

    if (prevBtn) {
      const handler = () => {
        if (currentIdx > 0) {
          currentIdx--;
          updateDisplay();
        }
      };
      prevBtn.addEventListener('click', handler);
      eventListeners.push({ element: prevBtn, event: 'click', handler });
    }

    if (nextBtn) {
      const handler = () => {
        if (currentIdx < panels.length - 1) {
          currentIdx++;
          updateDisplay();
        }
      };
      nextBtn.addEventListener('click', handler);
      eventListeners.push({ element: nextBtn, event: 'click', handler });
    }

    // "How to use" link advances to next card
    if (howtoLink) {
      const handler = (e) => {
        e.preventDefault();
        if (currentIdx < panels.length - 1) {
          currentIdx++;
          updateDisplay();
        }
      };
      howtoLink.addEventListener('click', handler);
      eventListeners.push({ element: howtoLink, event: 'click', handler });
    }

    updateDisplay();
  }

  // ========================================
  // Initialize Reusable Components
  // ========================================

  components.flightDropdown = new FlightDropdown(store, {
    dropdownId: 'flight-dropdown',
    triggerId: 'flight-trigger',
    menuId: 'flight-menu',
    createDOM: false
  });

  components.projectDropdown = new ProjectDropdown(store, {
    dropdownId: 'project-dropdown',
    triggerId: 'project-trigger',
    menuId: 'project-menu',
    createDOM: false
  });

  components.variablesTable = new VariablesListTable(store, {
    containerId: 'variables-table-container',
    tableClass: 'variables-list-table',
    showCategory: true,
    showUnits: true,
    showActions: false,
    searchable: true,
    itemsPerPage: 10,
    scrollable: true
  });

  // ========================================
  // Projects Table Rendering
  // ========================================

  function renderProjects() {
    const state = store.getState();
    const projects = getProjects(state) || [];
    const container = document.getElementById('projects-table-container');
    if (container) {
      container.innerHTML = renderProjectsTable(projects, currentPage, rowsPerPage, sortColumn, sortDirection);
      setupPaginationListeners();
      setupTableSorting();
    }
  }

  function setupTableSorting() {
    const headers = document.querySelectorAll('.about-projects-table th.sortable');
    headers.forEach(header => {
      const handler = () => {
        const col = header.dataset.sort;
        if (sortColumn === col) {
          // Toggle direction if clicking same column
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          // New column, start with ascending
          sortColumn = col;
          sortDirection = 'asc';
        }
        currentPage = 1; // Reset to first page when sorting
        renderProjects();
      };
      header.addEventListener('click', handler);
      header.style.cursor = 'pointer';
      eventListeners.push({ element: header, event: 'click', handler });
    });
  }

  function setupPaginationListeners() {
    const prevBtn = document.getElementById('about-page-prev');
    const nextBtn = document.getElementById('about-page-next');
    const pageInput = document.getElementById('about-page-input');
    const rowsSelect = document.getElementById('about-rows-select');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderProjects();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const state = store.getState();
        const projects = getProjects(state) || [];
        const totalPages = Math.ceil(projects.length / rowsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderProjects();
        }
      });
    }
    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        const state = store.getState();
        const projects = getProjects(state) || [];
        const totalPages = Math.ceil(projects.length / rowsPerPage);
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > totalPages) val = totalPages;
        currentPage = val;
        renderProjects();
      });
    }
    if (rowsSelect) {
      rowsSelect.addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value, 10);
        currentPage = 1;
        renderProjects();
      });
    }
  }

  // ========================================
  // Expand Buttons
  // ========================================

  function setupExpandButtons() {
    const expandBtns = document.querySelectorAll('.about-card-expand-btn');
    expandBtns.forEach(btn => {
      const handler = () => {
        const card = btn.closest('.about-card');
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
    renderProjects();
  }

  const storeSub = store.subscribe(onStoreChange);
  subscriptions.push(storeSub);

  // ========================================
  // Initialize Page
  // ========================================

  console.log('[AboutPage] Setting up UI interactions');

  setupCardSwitcher();
  setupExpandButtons();

  // Fetch initial data
  store.dispatch(fetchVariables());
  store.dispatch(fetchProjects());
  const initialProject = store.getState().selection.projectName;
  store.dispatch(fetchFlightsForProject(initialProject));
  renderProjects();

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
      if (components.projectDropdown && components.projectDropdown.destroy) {
        components.projectDropdown.destroy();
      }
      if (components.variablesTable && components.variablesTable.destroy) {
        components.variablesTable.destroy();
      }

      console.log('[AboutPage] Page destroyed');
    }
  };
}

export default init;
