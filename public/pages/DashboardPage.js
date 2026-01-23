/**
 * DashboardPage.js - SPA Page Module
 * Refactored from main.js to support SPA lifecycle (init/destroy)
 */

// Import actions
import {
  fetchProjects,
  fetchFlightsForProject,
  fetchVariables
} from '../store/actions/metadataActions.js';
import {
  selectProject,
  selectFlight,
  selectChart,
  updateChartVariable
} from '../store/actions/selectionActions.js';
import {
  fetchFlightData
} from '../store/actions/dataActions.js';

// Import dropdown components
import FlightDropdownStore from '../modules/components/flightDropdown.js';
import ProjectDropdownStore from '../modules/components/projectDropdown.js';

// Import selectors
import {
  getCurrentFlightId,
  getSelectedVariables
} from '../store/selectors/selectors.js';

// Import store-connected components
import FlightMapStore from '../modules/FlightMapStore.js';
import FlightMovieStore from '../modules/FlightMovieStore.js';
import TimelineControllerStore, { TimelineUI } from '../modules/TimeLineStore.js';
import SettingsOverlay from '../modules/components/SettingsOverlay.js';
import ChartContainerManager from '../modules/ChartContainerManager.js';

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
 * Initialize the Dashboard page
 * @param {Object} store - Redux-like store instance
 * @param {Object} context - Context from PageManager (query params, etc.)
 * @returns {Object} Page instance with destroy method
 */
export async function init(store, context = {}) {
  console.log('[DashboardPage] Initializing with context:', context);

  // Track components for cleanup
  const components = {};
  const subscriptions = [];
  const eventListeners = [];

  // Make store available globally for debugging
  window.__STORE__ = store;

  // ========================================
  // Initialize Components
  // ========================================

  components.flightMap = new FlightMapStore('map', store);
  components.flightMovie = new FlightMovieStore('myVideo', store);
  components.timelineController = new TimelineControllerStore(store);
  components.projectDropdown = new ProjectDropdownStore(store);
  components.flightDropdown = new FlightDropdownStore(store, { createDOM: false });
  components.settingsOverlay = new SettingsOverlay(store);

  // Expose components globally for external access (e.g., FullscreenOverlay)
  window.flightMap = components.flightMap;
  window.flightMovie = components.flightMovie;

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
        console.log('[DashboardPage] Applying gap config for flight:', flightNumber);
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
    const handler = () => components.settingsOverlay.toggle();
    settingsBtn.addEventListener('click', handler);
    eventListeners.push({ element: settingsBtn, event: 'click', handler });
  }

  const mapSettingsBtn = document.getElementById('open-map-settings-btn');
  if (mapSettingsBtn) {
    const handler = () => {
      components.settingsOverlay.switchTab('map');
      components.settingsOverlay.open();
    };
    mapSettingsBtn.addEventListener('click', handler);
    eventListeners.push({ element: mapSettingsBtn, event: 'click', handler });
  }

  // ========================================
  // Timeline UI
  // ========================================

  components.timelineUI = new TimelineUI(store, components.timelineController);

  // ========================================
  // Chart Container Manager
  // ========================================

  components.chartManager = new ChartContainerManager('#graph-container', store);

  console.log('[DashboardPage] Components initialized:', Object.keys(components));

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
        if (content) {
          luminance = getLuminanceFrom(content);
        }
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
  // Fetch Initial Data
  // ========================================

  store.dispatch(fetchProjects());
  store.dispatch(fetchVariables());

  // ========================================
  // Variable Dropdown Updates
  // ========================================

  function updateVariableDropdown(state) {
    const variableSelect = document.getElementById('variable-select');
    if (!variableSelect || state.metadata.variables.length === 0) return;

    const currentOptions = Array.from(variableSelect.options).map(o => o.value);
    const newVariables = state.metadata.variables.map(v => v.clean_name);

    if (currentOptions.length === newVariables.length) {
      return;
    }

    variableSelect.innerHTML = '';
    state.metadata.variables.forEach(variable => {
      const option = document.createElement('option');
      option.value = variable.clean_name;
      option.textContent = `${variable.long_name} (${variable.clean_name})`;
      variableSelect.appendChild(option);
    });

    console.log('[DashboardPage] Variable dropdown updated');
  }

  const variableDropdownSub = store.subscribe(updateVariableDropdown);
  subscriptions.push(variableDropdownSub);

  // ========================================
  // Variable Selection Handler
  // ========================================

  const variableSelect = document.getElementById('variable-select');
  if (variableSelect) {
    const handler = function() {
      const variable = this.value;
      console.log('[DashboardPage] Variable changed to:', variable);

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
  // Chart Selection Handler
  // ========================================

  document.querySelectorAll('.line-chart').forEach((element, index) => {
    const handler = () => {
      console.log('[DashboardPage] Chart selected:', index);

      document.querySelectorAll('.line-chart').forEach(c => {
        c.classList.remove('selected');
      });
      element.classList.add('selected');

      store.dispatch(selectChart(index));
    };
    element.addEventListener('click', handler);
    eventListeners.push({ element, event: 'click', handler });
  });

  // ========================================
  // Auto-load First Flight
  // ========================================

  // Check if we're restoring from URL (has flight param) - skip auto-load if so
  const isRestoringFromURL = context.query && context.query.flight;

  let lastProjectName = null;
  let hasAutoLoaded = false;
  const autoLoadSub = store.subscribe((state) => {
    // Skip auto-load if restoring from URL with a specific flight
    if (isRestoringFromURL) {
      return;
    }

    // Only auto-load once per page load
    if (hasAutoLoaded) {
      return;
    }

    const projectName = state.selection.projectName;
    const flights = state.metadata.flights[projectName];

    const projectChanged = lastProjectName !== projectName;
    lastProjectName = projectName;

    if (flights && flights.length > 0 && (projectChanged || !state.selection.flightId)) {
      let selectedFlight = flights.find(f => f.flight_number.toLowerCase() === 'rf01');

      if (!selectedFlight) {
        selectedFlight = flights.find(f => f.flight_number.toLowerCase().startsWith('rf'));
      }

      if (!selectedFlight) {
        selectedFlight = flights[0];
      }

      console.log('[DashboardPage] Auto-loading flight:', selectedFlight.flight_number);

      const flightId = parseInt(selectedFlight.id, 10);

      if (isNaN(flightId) || !flightId) {
        console.error('[DashboardPage] Invalid flight ID:', selectedFlight);
        return;
      }

      hasAutoLoaded = true;
      store.dispatch(selectFlight(flightId, selectedFlight.flight_number));
      store.dispatch(fetchFlightData(flightId, state.selection.selectedVariables));
    }
  });
  subscriptions.push(autoLoadSub);

  // Fetch initial flights for default project
  const initialProject = store.getState().selection.projectName;
  store.dispatch(fetchFlightsForProject(initialProject));

  // ========================================
  // Fetch Data on Flight Change (for URL restoration)
  // ========================================

  let lastFlightId = null;
  const flightChangeSub = store.subscribe((state) => {
    const flightId = state.selection.flightId;

    // Only fetch if flightId changed and is valid
    if (flightId && flightId !== lastFlightId) {
      lastFlightId = flightId;

      // Check if data is already loaded for this flight
      const existingData = state.data.flightData[flightId];
      if (!existingData || !existingData.timeseries) {
        console.log('[DashboardPage] Flight changed, fetching data for:', flightId);
        store.dispatch(fetchFlightData(flightId, state.selection.selectedVariables));
      }
    }
  });
  subscriptions.push(flightChangeSub);

  console.log('[DashboardPage] Initialization complete');

  // ========================================
  // Return Page Instance with Destroy Method
  // ========================================

  return {
    name: 'dashboard',
    components,

    /**
     * Destroy the page - cleanup all resources
     */
    destroy() {
      console.log('[DashboardPage] Destroying page');

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

      // Destroy all components
      if (components.chartManager) components.chartManager.destroy();
      if (components.flightMap) components.flightMap.destroy();
      if (components.flightMovie) components.flightMovie.destroy();
      if (components.projectDropdown) components.projectDropdown.destroy();
      if (components.flightDropdown) components.flightDropdown.destroy();
      if (components.timelineController) components.timelineController.destroy();
      if (components.settingsOverlay) components.settingsOverlay.destroy();

      // Cleanup global references
      delete window.flightMap;
      delete window.flightMovie;
      delete window.applyCardThemes;

      console.log('[DashboardPage] Page destroyed');
    }
  };
}

export default init;
