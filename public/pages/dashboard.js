/**
 * UnifiedPage.js - SPA Page Module
 * Unified page that supports both Visualization (Home) and Dashboard modes
 * with smooth animated transitions between them
 */

// Import actions
import {
  fetchProjects,
  fetchFlightsForProject,
  fetchVariables
} from '../store/actions/metadataActions.js';
import {
  selectFlight,
  selectChart,
  updateChartVariable
} from '../store/actions/selectionActions.js';
import {
  fetchFlightData
} from '../store/actions/dataActions.js';
import * as types from '../store/actions/actionTypes.js';

// Import selectors
import {
  getCurrentFlightId,
  getCurrentProject,
  getSelectedVariables,
  getProjects
} from '../store/selectors/selectors.js';

// Import visualization components
import FlightMapStore from '../modules/FlightMapStore.js';
import FlightMovieStore from '../modules/FlightMovieStore.js';
import TimelineControllerStore, { TimelineUI } from '../modules/TimeLineStore.js';
import SettingsOverlay from '../modules/components/SettingsOverlay.js';
import ChartContainerManager from '../modules/ChartContainerManager.js';

// Import dropdown components
import FlightDropdownStore from '../modules/components/flightDropdown.js';
import ProjectDropdownStore from '../modules/components/projectDropdown.js';

// Import dashboard-specific components
import VariablesListTable from '../modules/components/VariablesListTable.js';

/**
 * Flight Video Gap Configurations
 */
const flightGapConfigs = {
  'RF09': {
    gaps: [
      { start: "250805-212047", end: "250805-212140" },
      { start: "250806-003532", end: "250806-004847" },
      { start: "250806-004900", end: "250806-004906" },
      { start: "250806-004906", end: "250806-004921" },
      { start: "250806-005032", end: "250806-012104" },
      { start: "250806-012332", end: "250806-015702" },
      { start: "250806-020632", end: "250806-023213" },
      { start: "250806-023222", end: "250806-023230" },
      { start: "250806-023432", end: "250806-023551" },
      { start: "250806-023632", end: "250806-024347" },
      { start: "250806-024432", end: "250806-024537" },
      { start: "250806-024538", end: "250806-024544" },
      { start: "250806-024632", end: "250806-024801" },
      { start: "250806-024801", end: "250806-024811" }
    ],
    timeRange: {
      start: new Date(2025, 7, 5, 21, 20, 47),
      end: new Date(2025, 7, 6, 2, 54, 26)
    }
  }
};

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
 * Render the projects table with badges and sorting
 */
function renderProjectsTable(projects, currentPage, rowsPerPage, sortColumn = null, sortDirection = 'asc') {
  if (!projects || projects.length === 0) {
    return `<div class="about-empty-table">No projects found.</div>`;
  }

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

  const getSortIcon = (col) => {
    if (sortColumn !== col) return 'fas fa-sort';
    return sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  };

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
        <td><a href="./?project=${encodeURIComponent(name)}" class="about-table-action-btn" title="View">View</a></td>
      </tr>
    `;
  }).join('');

  return `
    <table class="about-projects-table">
      <thead>
        <tr>
          <th class="sortable" data-sort="year">Year <i class="about-sort-icon ${getSortIcon('year')}"></i></th>
          <th class="sortable" data-sort="name">Name <i class="about-sort-icon ${getSortIcon('name')}"></i></th>
          <th class="sortable" data-sort="status">Status <i class="about-sort-icon ${getSortIcon('status')}"></i></th>
          <th class="sortable" data-sort="aircraft">Aircraft <i class="about-sort-icon ${getSortIcon('aircraft')}"></i></th>
          <th>Data Access</th>
          <th>Home</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Initialize the Unified page
 * @param {Object} store - Redux-like store instance
 * @param {Object} context - Context from PageManager (query params, path, etc.)
 * @returns {Object} Page instance with destroy method and setMode function
 */
export async function init(store, context = {}) {
  console.log('[UnifiedPage] Initializing with context:', context);

  // Determine initial mode from path
  const initialPath = context.path || store.getState().router?.currentPath || '/';
  let currentMode = initialPath === '/dashboard' ? 'dashboard' : 'visualization';

  // Page context for chart state (always uses 'dashboard' for compatibility)
  const PAGE_CONTEXT = 'dashboard';

  // Track components and cleanup resources
  const components = {};
  const subscriptions = [];
  const eventListeners = [];

  // Dashboard-specific state
  let currentPage = 1;
  let rowsPerPage = 6;
  let sortColumn = null;
  let sortDirection = 'asc';
  let lastProjectsLength = -1;

  // Get page element
  const pageEl = document.querySelector('.unified-page');

  // Make store available globally
  window.__STORE__ = store;

  // ========================================
  // Set Mode Function (for transitions)
  // ========================================

  function setMode(mode) {
    if (mode !== 'visualization' && mode !== 'dashboard') {
      console.warn('[UnifiedPage] Invalid mode:', mode);
      return;
    }

    if (mode === currentMode) {
      return;
    }

    console.log('[UnifiedPage] Switching mode:', currentMode, '->', mode);
    currentMode = mode;

    if (pageEl) {
      // Add transitioning class for progress bar effect
      pageEl.classList.add('transitioning');

      // Update mode attribute (triggers CSS transitions)
      pageEl.setAttribute('data-mode', mode);

      // Remove transitioning class after animation
      setTimeout(() => {
        pageEl.classList.remove('transitioning');
      }, 500);
    }

    // Relocate footer timeline controls between footer and dashboard toolbar
    relocateTimelineControls(mode);

    // Resize map after transition completes
    setTimeout(() => {
      if (components.flightMap && components.flightMap.resize) {
        components.flightMap.resize();
      }
      if (components.chartManager) {
        components.chartManager.handleResize();
      }
    }, 550);
  }

  /**
   * Move the footer's inner controls into the dashboard toolbar (or back)
   * so the same DOM elements (with same IDs) keep working with TimelineUI.
   * Also moves the project/flight dropdowns into the toolbar-left area.
   */
  function relocateTimelineControls(mode) {
    const footer = document.getElementById('footer-controls');
    const toolbarHost = document.getElementById('dashboard-timeline-host');
    const toolbarLeft = pageEl?.querySelector('.about-toolbar-left');
    const timeHost = document.getElementById('dashboard-time-host');
    // footerInner may be inside footer OR toolbarHost depending on current mode
    const footerInner = footer?.querySelector('.footer-controls-inner')
                     || toolbarHost?.querySelector('.footer-controls-inner');
    const flightInfoGroup = document.querySelector('.flight-info-group');
    const timeDisplayGroup = document.querySelector('.time-display-group');
    if (!footer || !toolbarHost || !footerInner) return;

    if (mode === 'dashboard') {
      // Move project/flight dropdowns into toolbar-left
      if (flightInfoGroup && toolbarLeft) {
        toolbarLeft.appendChild(flightInfoGroup);
      }
      // Move time display into center header
      if (timeDisplayGroup && timeHost) {
        timeHost.appendChild(timeDisplayGroup);
      }
      // Move remaining footer controls (play, timeline) into toolbar timeline row
      toolbarHost.appendChild(footerInner);
      footer.style.display = 'none';
    } else {
      // Move flight info group back into footer-right
      const footerRight = footerInner.querySelector('.footer-right');
      if (flightInfoGroup && footerRight) {
        footerRight.insertBefore(flightInfoGroup, footerRight.firstChild);
      }
      // Move time display back into footer-right
      if (timeDisplayGroup && footerRight) {
        footerRight.appendChild(timeDisplayGroup);
      }
      // Move controls back into footer
      footer.appendChild(footerInner);
      footer.style.display = '';
    }
  }

  // Set initial mode
  if (pageEl) {
    pageEl.setAttribute('data-mode', currentMode);
    // Relocate timeline controls on initial load if starting in dashboard mode
    relocateTimelineControls(currentMode);
  }

  // ========================================
  // Initialize Visualization Components
  // ========================================

  components.flightMap = new FlightMapStore('map', store, PAGE_CONTEXT);
  components.flightMovie = new FlightMovieStore('myVideo', store);
  components.timelineController = new TimelineControllerStore(store);
  components.settingsOverlay = new SettingsOverlay(store, PAGE_CONTEXT);

  // Expose components globally
  window.flightMap = components.flightMap;
  window.flightMovie = components.flightMovie;

  // ========================================
  // Initialize Dropdown Components
  // ========================================

  components.projectDropdown = new ProjectDropdownStore(store);
  components.flightDropdown = new FlightDropdownStore(store, { createDOM: false }, PAGE_CONTEXT);

  // ========================================
  // Dashboard Toolbar Dropdowns
  // ========================================

  function setupDashboardToolbarDropdowns() {
    // Project dropdown
    const projectDropdown = document.getElementById('dashboard-project-dropdown');
    const projectTrigger = document.getElementById('dashboard-project-trigger');
    const projectMenu = document.getElementById('dashboard-project-menu');

    // Flight dropdown
    const flightDropdown = document.getElementById('dashboard-flight-dropdown');
    const flightTrigger = document.getElementById('dashboard-flight-trigger');
    const flightMenu = document.getElementById('dashboard-flight-menu');

    // Toggle dropdown handlers
    if (projectTrigger && projectDropdown) {
      const handler = (e) => {
        e.stopPropagation();
        projectDropdown.classList.toggle('open');
        flightDropdown?.classList.remove('open');
      };
      projectTrigger.addEventListener('click', handler);
      eventListeners.push({ element: projectTrigger, event: 'click', handler });
    }

    if (flightTrigger && flightDropdown) {
      const handler = (e) => {
        e.stopPropagation();
        flightDropdown.classList.toggle('open');
        projectDropdown?.classList.remove('open');
      };
      flightTrigger.addEventListener('click', handler);
      eventListeners.push({ element: flightTrigger, event: 'click', handler });
    }

    // Close dropdowns on outside click
    const outsideClickHandler = (e) => {
      if (projectDropdown && !projectDropdown.contains(e.target)) {
        projectDropdown.classList.remove('open');
      }
      if (flightDropdown && !flightDropdown.contains(e.target)) {
        flightDropdown.classList.remove('open');
      }
    };
    document.addEventListener('click', outsideClickHandler);
    eventListeners.push({ element: document, event: 'click', handler: outsideClickHandler });

    // Update project menu
    function updateProjectDropdown(state) {
      const projects = getProjects(state) || [];
      const currentProject = state.selection.projectName;

      // Update trigger text
      const triggerText = projectTrigger?.querySelector('.dropdown-text');
      if (triggerText) {
        triggerText.textContent = currentProject || 'Select Project';
      }

      if (projectMenu) {
        projectMenu.innerHTML = projects.map(p => {
          const name = p.project_name || p.name || '';
          const isActive = name === currentProject;
          return `<button class="project-dropdown-item ${isActive ? 'selected' : ''}" data-project="${name}">${name}</button>`;
        }).join('');

        // Add click handlers to options
        projectMenu.querySelectorAll('.project-dropdown-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const projectName = btn.dataset.project;
            store.dispatch({ type: types.SELECT_PROJECT, payload: { projectName } });
            store.dispatch(fetchFlightsForProject(projectName));
            projectDropdown?.classList.remove('open');
          });
        });
      }
    }

    // Update flight menu
    function updateFlightDropdown(state) {
      const projectName = state.selection.projectName;
      const flights = state.metadata.flights[projectName] || [];
      const currentFlightNumber = state.selection.flightNumber;

      // Update trigger text
      const triggerText = flightTrigger?.querySelector('.dropdown-text');
      if (triggerText) {
        triggerText.textContent = currentFlightNumber || 'Select Flight';
      }

      if (flightMenu) {
        // Sort flights: RF first, then TF, then FF
        const sortedFlights = [...flights].sort((a, b) => {
          const aPrefix = a.flight_number.substring(0, 2);
          const bPrefix = b.flight_number.substring(0, 2);
          const order = { 'rf': 1, 'tf': 2, 'ff': 3 };
          const aOrder = order[aPrefix.toLowerCase()] || 999;
          const bOrder = order[bPrefix.toLowerCase()] || 999;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.flight_number.localeCompare(b.flight_number);
        });

        flightMenu.innerHTML = sortedFlights.map(f => {
          const num = f.flight_number || f.id;
          const isActive = num === currentFlightNumber;
          return `<button class="custom-dropdown-item ${isActive ? 'selected' : ''}" data-flight-id="${f.id}" data-flight-num="${num}">${num}</button>`;
        }).join('');

        // Add click handlers to options
        flightMenu.querySelectorAll('.custom-dropdown-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const flightId = parseInt(btn.dataset.flightId, 10);
            const flightNum = btn.dataset.flightNum;
            store.dispatch(selectFlight(flightId, flightNum));
            const selectedVars = getSelectedVariables(store.getState(), PAGE_CONTEXT);
            const flatVars = [...new Set([...selectedVars.flat().filter(Boolean), 'ggalt'])];
            store.dispatch(fetchFlightData(flightId, flatVars));
            flightDropdown?.classList.remove('open');
          });
        });
      }
    }

    // Subscribe to store updates
    const dashboardDropdownSub = store.subscribe((state) => {
      updateProjectDropdown(state);
      updateFlightDropdown(state);
    });
    subscriptions.push(dashboardDropdownSub);

    // Initial update
    updateProjectDropdown(store.getState());
    updateFlightDropdown(store.getState());
  }

  setupDashboardToolbarDropdowns();

  // ========================================
  // Mobile Footer Controls (move dropdowns + toggle)
  // ========================================

  function setupMobileFooterControls() {
    const footerControls = document.getElementById('footer-controls');
    if (!footerControls) return;

    let retryCount = 0;

    const updatePlacement = () => {
      // In dashboard mode, elements are managed by relocateTimelineControls — skip mobile relocation
      if (currentMode === 'dashboard') return;

      const shouldMove = window.matchMedia('(max-width: 768px)').matches;
      const navbarControls = document.getElementById('navbar-flight-controls');
      // Search document since element may have been moved to navbar
      const flightInfoGroup = document.querySelector('.flight-info-group');
      const footerRight = footerControls.querySelector('.footer-right');
      const footerLeft = footerControls.querySelector('.footer-left');
      const timeDisplayGroup = document.querySelector('.time-display-group');
      const playButton = document.getElementById('play-pause-button');
      const speedDropdown = document.getElementById('speed-dropdown');

      if (shouldMove) {
        if (!navbarControls) {
          if (retryCount < 8) {
            retryCount += 1;
            setTimeout(updatePlacement, 250);
          }
          return;
        }

        if (flightInfoGroup && !navbarControls.contains(flightInfoGroup)) {
          navbarControls.appendChild(flightInfoGroup);
        }

        if (playButton && timeDisplayGroup && !timeDisplayGroup.contains(playButton)) {
          timeDisplayGroup.appendChild(playButton);
        }
      } else {
        if (flightInfoGroup && footerRight && !footerRight.contains(flightInfoGroup)) {
          footerRight.insertBefore(flightInfoGroup, footerRight.firstChild);
        }
        if (playButton && footerLeft && !footerLeft.contains(playButton)) {
          if (speedDropdown) {
            footerLeft.insertBefore(playButton, speedDropdown);
          } else {
            footerLeft.appendChild(playButton);
          }
        }
      }
    };

    const footerToggle = document.getElementById('footer-toggle');
    if (footerToggle) {
      const toggleHandler = () => {
        const isCollapsed = footerControls.classList.toggle('is-collapsed');
        footerToggle.setAttribute('aria-expanded', String(!isCollapsed));
        footerToggle.setAttribute(
          'aria-label',
          isCollapsed ? 'Show footer controls' : 'Hide footer controls'
        );
      };
      footerToggle.addEventListener('click', toggleHandler);
      eventListeners.push({ element: footerToggle, event: 'click', handler: toggleHandler });
    }

    updatePlacement();
    const resizeHandler = () => updatePlacement();
    window.addEventListener('resize', resizeHandler);
    eventListeners.push({ element: window, event: 'resize', handler: resizeHandler });
  }

  setupMobileFooterControls();

  // ========================================
  // Dashboard Share Button
  // ========================================

  const shareBtn = document.getElementById('dashboard-share-btn');
  if (shareBtn && currentMode === 'dashboard') {
    const shareHandler = () => {
      const state = store.getState();
      const projectName = getCurrentProject(state);
      const flightId = getCurrentFlightId(state);
      const selectedVars = getSelectedVariables(state, PAGE_CONTEXT);
      
      // Flatten the variables array
      const varsList = selectedVars.flat().filter(Boolean);
      
      // Build the shareable URL
      let shareURL = `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(projectName)}&flight=${encodeURIComponent(flightId)}`;
      
      if (varsList.length > 0) {
        shareURL += `&variables=${encodeURIComponent(varsList.join(','))}`;
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(shareURL).then(() => {
        // Show visual feedback
        const originalContent = shareBtn.innerHTML;
        shareBtn.innerHTML = 'COPIED!';
        shareBtn.style.opacity = '0.7';

        setTimeout(() => {
          shareBtn.innerHTML = originalContent;
          shareBtn.style.opacity = '1';
        }, 2000);

        console.log('[UnifiedPage] Share URL copied to clipboard:', shareURL);
      }).catch((err) => {
        console.error('[UnifiedPage] Failed to copy URL to clipboard:', err);
        alert('Failed to copy URL. Please try again.');
      });
    };
    
    shareBtn.addEventListener('click', shareHandler);
    eventListeners.push({ element: shareBtn, event: 'click', handler: shareHandler });
  }

  // ========================================
  // Flight Video Gap Configuration
  // ========================================

  let lastFlightNumberForGaps = null;
  const gapSubscription = store.subscribe((state) => {
    const flightNumber = state.selection.flightNumber;
    if (flightNumber !== lastFlightNumberForGaps) {
      lastFlightNumberForGaps = flightNumber;
      const flightKey = flightNumber ? flightNumber.toUpperCase() : null;
      const gapConfig = flightKey ? flightGapConfigs[flightKey] : null;
      if (gapConfig) {
        console.log('[UnifiedPage] Applying gap config for flight:', flightNumber);
        components.flightMovie.setGapConfig(gapConfig.gaps, gapConfig.timeRange);
      } else {
        components.flightMovie.clearGapConfig();
      }
    }
  });
  subscriptions.push(gapSubscription);

  // ========================================
  // Settings Button Handlers
  // ========================================

  const settingsBtn = document.getElementById('open-settings-btn');
  if (settingsBtn) {
    const handler = () => {
      if (components.settingsOverlay) {
        components.settingsOverlay.toggle();
      }
    };
    settingsBtn.addEventListener('click', handler);
    eventListeners.push({ element: settingsBtn, event: 'click', handler });
  }

  const mapSettingsBtn = document.getElementById('open-map-settings-btn');
  if (mapSettingsBtn) {
    const handler = () => {
      if (components.settingsOverlay) {
        components.settingsOverlay.switchTab('map');
        components.settingsOverlay.open();
      }
    };
    mapSettingsBtn.addEventListener('click', handler);
    eventListeners.push({ element: mapSettingsBtn, event: 'click', handler });
  }

  // ========================================
  // Timeline UI (Visualization mode)
  // ========================================

  components.timelineUI = new TimelineUI(store, components.timelineController);

  // ========================================
  // Speed Dropdown
  // ========================================

  const speedDropdown = document.getElementById('speed-dropdown');
  const speedTrigger = document.getElementById('speed-trigger');
  const speedMenu = document.getElementById('speed-menu');
  const speedValue = speedTrigger?.querySelector('.speed-value');

  if (speedDropdown && speedTrigger && speedMenu) {
    const speedTriggerHandler = (e) => {
      e.stopPropagation();
      speedDropdown.classList.toggle('open');
    };
    speedTrigger.addEventListener('click', speedTriggerHandler);
    eventListeners.push({ element: speedTrigger, event: 'click', handler: speedTriggerHandler });

    const speedOptions = speedMenu.querySelectorAll('.speed-option');
    speedOptions.forEach(option => {
      const handler = () => {
        const speed = parseFloat(option.dataset.speed);
        speedOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        if (speedValue) speedValue.textContent = option.textContent;
        const video = document.getElementById('myVideo');
        if (video) video.playbackRate = speed;
        speedDropdown.classList.remove('open');
      };
      option.addEventListener('click', handler);
      eventListeners.push({ element: option, event: 'click', handler });
    });

    const outsideClickHandler = (e) => {
      if (!speedDropdown.contains(e.target)) {
        speedDropdown.classList.remove('open');
      }
    };
    document.addEventListener('click', outsideClickHandler);
    eventListeners.push({ element: document, event: 'click', handler: outsideClickHandler });
  }

  // ========================================
  // Initialize Chart Configs
  // ========================================

  const hasURLVariables = context.query && context.query.variables;

  if (!hasURLVariables) {
    const initialState = store.getState();
    const defaultDashVars = initialState.selection.selectedVariables?.dashboard || [];
    const initialVisibleCount = initialState.ui?.charts?.dashboard?.visibleCount || 4;
    const existingConfigs = initialState.ui?.charts?.dashboard?.configs || {};
    const hasExistingConfigs = Object.keys(existingConfigs).some(
      idx => existingConfigs[idx]?.variables?.length > 0
    );

    if (!hasExistingConfigs) {
      defaultDashVars.slice(0, initialVisibleCount).forEach((vars, chartIndex) => {
        const varList = Array.isArray(vars) ? vars : [vars];
        varList.forEach(variable => {
          if (variable) {
            store.dispatch({
              type: types.ADD_CHART_VARIABLE,
              payload: { chartIndex, variableKey: variable, axis: 'left', page: PAGE_CONTEXT }
            });
          }
        });
      });
    }
  }

  // ========================================
  // Chart Container Manager
  // ========================================

  components.chartManager = new ChartContainerManager('#graph-container', store, PAGE_CONTEXT);

  // ========================================
  // Dashboard Components (Variables Table)
  // ========================================

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
  // Projects Table Rendering (Dashboard mode)
  // ========================================

  function renderProjects() {
    const state = store.getState();
    const projects = getProjects(state) || [];
    const container = document.getElementById('projects-table-container');
    if (container) {
      container.innerHTML = renderProjectsTable(projects, currentPage, rowsPerPage, sortColumn, sortDirection);
      setupTableSorting();
    }
  }

  function setupTableSorting() {
    const headers = document.querySelectorAll('.about-projects-table th.sortable');
    headers.forEach(header => {
      const handler = () => {
        const col = header.dataset.sort;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        currentPage = 1;
        renderProjects();
      };
      header.addEventListener('click', handler);
    });
  }

  // ========================================
  // Store Subscriptions
  // ========================================

  // Projects table update (only when projects change)
  const projectsSubscription = store.subscribe((state) => {
    const projects = getProjects(state) || [];
    if (projects.length !== lastProjectsLength) {
      lastProjectsLength = projects.length;
      renderProjects();
    }
  });
  subscriptions.push(projectsSubscription);

  // Auto-load first flight
  const isRestoringFromURL = context.query && (context.query.flight || context.query.variables);
  let lastProjectName = null;

  const autoLoadSub = store.subscribe((state) => {
    if (isRestoringFromURL) return;

    const projectName = state.selection.projectName;
    const flights = state.metadata.flights[projectName];
    const projectChanged = lastProjectName !== projectName;
    lastProjectName = projectName;

    if (flights && flights.length > 0 && (projectChanged || !state.selection.flightId)) {
      let selectedFlight = flights.find(f => f.flight_number && f.flight_number.toLowerCase() === 'rf01');
      if (!selectedFlight) selectedFlight = flights[0];
      if (selectedFlight) {
        const flightId = parseInt(selectedFlight.id, 10);
        if (!isNaN(flightId) && flightId) {
          console.log('[UnifiedPage] Auto-loading flight:', selectedFlight.flight_number);
          store.dispatch(selectFlight(flightId, selectedFlight.flight_number));
          const selectedVars = getSelectedVariables(state, PAGE_CONTEXT);
          const flatVars = [...new Set([...selectedVars.flat().filter(Boolean), 'ggalt'])];
          store.dispatch(fetchFlightData(flightId, flatVars));
        }
      }
    }
  });
  subscriptions.push(autoLoadSub);

  // Fetch data on flight change
  let lastFlightId = null;
  const flightChangeSub = store.subscribe((state) => {
    const flightId = state.selection.flightId;
    if (flightId && flightId !== lastFlightId) {
      lastFlightId = flightId;
      const existingData = state.data.flightData[flightId];
      if (!existingData || !existingData.timeseries) {
        console.log('[UnifiedPage] Flight changed, fetching data for:', flightId);
        const varsToFetch = [...new Set([...getSelectedVariables(state, PAGE_CONTEXT).flat().filter(Boolean), 'ggalt'])];
        store.dispatch(fetchFlightData(flightId, varsToFetch));
      }
    }
  });
  subscriptions.push(flightChangeSub);

  // Listen for route changes to update mode
  const routeSubscription = store.subscribe((state) => {
    const path = state.router?.currentPath || '/';
    const newMode = path === '/dashboard' ? 'dashboard' : 'visualization';
    if (newMode !== currentMode) {
      setMode(newMode);
    }
  });
  subscriptions.push(routeSubscription);

  // ========================================
  // Card Theme Detection
  // ========================================

  function getLuminanceFrom(el) {
    const bg = getComputedStyle(el).backgroundColor;
    const match = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d\.]+))?/i);
    if (!match) return null;
    const [r, g, b, a] = match.slice(1, 5).map(v => (v === undefined ? undefined : Number(v)));
    const alpha = a === undefined ? 1 : a;
    if (alpha === 0) return null;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function applyCardThemes() {
    const cards = document.querySelectorAll('.viz-card');
    cards.forEach(card => {
      const isMap = card.classList.contains('map-card');
      const isCamera = card.classList.contains('camera-card');

      if (isMap) {
        card.classList.add('is-dark');
        return;
      }

      if (isCamera && card.classList.contains('expansion-active')) {
        card.classList.add('is-dark');
        return;
      }
      if (isCamera && !card.classList.contains('expansion-active')) {
        card.classList.remove('is-dark');
        return;
      }

      let luminance = getLuminanceFrom(card);
      if (luminance === null) {
        const content = card.querySelector('.card-content');
        if (content) luminance = getLuminanceFrom(content);
      }

      if (luminance !== null && luminance < 0.5) {
        card.classList.add('is-dark');
      } else {
        card.classList.remove('is-dark');
      }
    });
  }

  requestAnimationFrame(applyCardThemes);
  const resizeHandler = () => requestAnimationFrame(applyCardThemes);
  window.addEventListener('resize', resizeHandler);
  eventListeners.push({ element: window, event: 'resize', handler: resizeHandler });
  window.applyCardThemes = applyCardThemes;

  // ========================================
  // Variable Selection Handler
  // ========================================

  const variableSelect = document.getElementById('variable-select');
  if (variableSelect) {
    const handler = function() {
      const variable = this.value;
      const state = store.getState();
      const chartIndex = state.selection.selectedChartIndex;
      const flightId = getCurrentFlightId(state);
      store.dispatch(updateChartVariable(chartIndex, variable));
      const flightData = state.data.flightData[flightId];
      if (!flightData || !flightData.loadedVariables.has(variable)) {
        store.dispatch(fetchFlightData(flightId, [variable]));
      }
    };
    variableSelect.addEventListener('change', handler);
    eventListeners.push({ element: variableSelect, event: 'change', handler });
  }

  // ========================================
  // Fetch Initial Data
  // ========================================

  store.dispatch(fetchProjects());
  store.dispatch(fetchVariables());
  const initialProject = store.getState().selection.projectName;
  store.dispatch(fetchFlightsForProject(initialProject));
  renderProjects();

  console.log('[UnifiedPage] Initialization complete, mode:', currentMode);

  // ========================================
  // Return Page Instance
  // ========================================

  return {
    name: 'unified',
    components,

    /**
     * Get current mode
     */
    getMode() {
      return currentMode;
    },

    /**
     * Set page mode with animation
     */
    setMode,

    /**
     * Destroy the page
     */
    destroy() {
      console.log('[UnifiedPage] Destroying page');

      // Move footer controls back before the container HTML is replaced
      relocateTimelineControls('visualization');

      subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });

      eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });

      if (components.chartManager) components.chartManager.destroy();
      if (components.flightMap) components.flightMap.destroy();
      if (components.flightMovie) components.flightMovie.destroy();
      if (components.projectDropdown) components.projectDropdown.destroy();
      if (components.flightDropdown) components.flightDropdown.destroy();
      if (components.timelineController) components.timelineController.destroy();
      if (components.settingsOverlay) components.settingsOverlay.destroy();
      if (components.variablesTable && components.variablesTable.destroy) {
        components.variablesTable.destroy();
      }

      delete window.flightMap;
      delete window.flightMovie;
      delete window.applyCardThemes;

      console.log('[UnifiedPage] Page destroyed');
    }
  };
}

export default init;
