/**
 * main.js - Store-connected version
 * Refactored to use Redux-like store for state management
 */

// Import store infrastructure
import { createStore } from './store/createStore.js';
import { rootReducer } from './store/reducers/rootReducer.js';
import { thunkMiddleware } from './store/middleware/apiMiddleware.js';
import { devLoggerMiddleware } from './store/middleware/loggerMiddleware.js';

// Import actions
import {
  fetchProjects,
  fetchFlightsForProject,
  fetchVariables
} from './store/actions/metadataActions.js';
import {
  selectProject,
  selectFlight,
  selectChart,
  updateChartVariable
} from './store/actions/selectionActions.js';
import {
  fetchFlightData
} from './store/actions/dataActions.js';
import {
  timelinePlay,
  timelinePause,
  timelineSeek
} from './store/actions/uiActions.js';

// Import dropdown components
import FlightDropdownStore from './modules/components/flightDropdown.js';
import ProjectDropdownStore from './modules/components/projectDropdown.js';

// Import selectors
import {
  getCurrentFlightId,
  getSelectedVariables,
  getVariableMetadata,
  isTimelinePlaying,
  getCurrentTime
} from './store/selectors/selectors.js';

// Import store-connected components
import FlightMapStore from './modules/FlightMapStore.js';
import FlightMovieStore from './modules/FlightMovieStore.js';
import TimelineControllerStore, { TimelineUI } from './modules/TimeLineStore.js';
import ChartContainerManager from './modules/ChartContainerManager.js';

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
    selectedVariables: ['atx', 'wic', 'wdc', 'dpxc', 'psxc', 'tasx', 'palt','thdg']
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
      showRadar: true,
      layers: {
        glm: false,
        mrms: false,
        goesVisible: false,
        goesIR: false,
        nexrad: true
      }
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

console.log('[main] Store created:', store.getState());

// Make store available globally for debugging
window.__STORE__ = store;

// ========================================
// Initialize Components
// ========================================

const flightMap = new FlightMapStore('map', store);
const flightMovie = new FlightMovieStore('myVideo', store);
const timelineController = new TimelineControllerStore(store);
const projectDropdown = new ProjectDropdownStore(store);
const flightDropdown = new FlightDropdownStore(store, { createDOM: false });

// Expose components globally for external access (e.g., FullscreenOverlay)
window.flightMap = flightMap;
window.flightMovie = flightMovie;

// ========================================
// Flight Video Gap Configurations
// ========================================

const flightGapConfigs = {
  'RF09': {
    gaps: [
      // Initial gap: data start to movie start
      { start: "250805-212047", end: "250805-212140" },
      // Video gaps (corrupt/dark sections removed)
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
    // Time range: Data start to flight end
    timeRange: {
      start: new Date(2025, 7, 5, 21, 20, 47),  // Aug 5, 2025 21:20:47
      end: new Date(2025, 7, 6, 2, 54, 26)      // Aug 6, 2025 02:54:26
    }
  }
};

// Track last flight number to detect changes for gap config
let lastFlightNumberForGaps = null;

// Subscribe to flight changes to apply gap configuration
store.subscribe((state) => {
  const flightNumber = state.selection.flightNumber;

  if (flightNumber !== lastFlightNumberForGaps) {
    lastFlightNumberForGaps = flightNumber;

    // Check if this flight has gap configuration (case-insensitive)
    const flightKey = flightNumber ? flightNumber.toUpperCase() : null;
    const gapConfig = flightKey ? flightGapConfigs[flightKey] : null;

    if (gapConfig) {
      console.log('[main] Applying gap config for flight:', flightNumber);
      flightMovie.setGapConfig(gapConfig.gaps, gapConfig.timeRange);
    } else {
      // Clear gap config for flights without gaps
      flightMovie.clearGapConfig();
    }
  }
});

// Connect settings button to open overlay
const settingsBtn = document.getElementById('open-settings-btn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    settingsOverlay.toggle();
  });
}

// Map settings button opens overlay on Map tab
const mapSettingsBtn = document.getElementById('open-map-settings-btn');
if (mapSettingsBtn) {
  mapSettingsBtn.addEventListener('click', () => {
    settingsOverlay.switchTab('map');
    settingsOverlay.open();
  });
}

// Initialize timeline UI controls
const timelineUI = new TimelineUI(store, timelineController);

// Initialize dynamic chart container manager
const chartManager = new ChartContainerManager('#graph-container', store);

console.log('[main] Components initialized:', {
  chartManager: !!chartManager,
  flightMap: !!flightMap,
  flightMovie: !!flightMovie,
  projectDropdown: !!projectDropdown,
  flightDropdown: !!flightDropdown,
  timelineController: !!timelineController
});

// Auto-detect card theme based on background lightness
function getLuminanceFrom(el) {
  const bg = getComputedStyle(el).backgroundColor;
  const match = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d\.]+))?/i);
  if (!match) return null;
  const [r, g, b, a] = match.slice(1, 5).map(v => (v === undefined ? undefined : Number(v)));
  const alpha = a === undefined ? 1 : a;
  // If fully transparent, treat as null so caller can fallback
  if (alpha === 0) return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function applyCardThemes() {
  const cards = document.querySelectorAll('.viz-card');
  cards.forEach(card => {
    const isMap = card.classList.contains('map-card');
    const isCamera = card.classList.contains('camera-card');

    // Map is always dark
    if (isMap) {
      card.classList.add('is-dark');
      return;
    }

    // Camera: only dark when expanded full screen
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

// Run after layout paints
requestAnimationFrame(applyCardThemes);
window.addEventListener('resize', () => requestAnimationFrame(applyCardThemes));

// Expose to window for FullscreenExpansion to call
window.applyCardThemes = applyCardThemes;

// ========================================
// Fetch Initial Data
// ========================================

// Fetch projects and variables on page load
store.dispatch(fetchProjects());
store.dispatch(fetchVariables());

// Subscribe to metadata changes to populate dropdowns
store.subscribe((state) => {
  updateVariableDropdown(state);
});

// ========================================
// Update UI Dropdowns
// ========================================


function updateVariableDropdown(state) {
  const variableSelect = document.getElementById('variable-select');
  if (!variableSelect || state.metadata.variables.length === 0) return;

  // Only update if variables changed
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

  console.log('[main] Variable dropdown updated');
}

// ========================================
// Event Listeners
// ========================================

// Variable selection
const variableSelect = document.getElementById('variable-select');
if (variableSelect) {
  variableSelect.addEventListener('change', function() {
    const variable = this.value;
    console.log('[main] Variable changed to:', variable);

    const state = store.getState();
    const chartIndex = state.selection.selectedChartIndex;
    const flightId = getCurrentFlightId(state);

    // Update chart variable in store
    store.dispatch(updateChartVariable(chartIndex, variable));

    // Fetch data if not already loaded
    const flightData = state.data.flightData[flightId];
    if (!flightData || !flightData.loadedVariables.has(variable)) {
      store.dispatch(fetchFlightData(flightId, [variable]));
    }
  });
} else {
  console.warn('[main] variable-select element not found');
}

// Chart selection
document.querySelectorAll('.line-chart').forEach((element, index) => {
  element.addEventListener('click', () => {
    console.log('[main] Chart selected:', index);

    // Update visual selection
    document.querySelectorAll('.line-chart').forEach(c => {
      c.classList.remove('selected');
    });
    element.classList.add('selected');

    // Update store
    store.dispatch(selectChart(index));
  });
});

// ========================================
// Cleanup on page unload
// ========================================

window.addEventListener('beforeunload', () => {
  console.log('[main] Cleaning up components');
  chartManager.destroy();
  flightMap.destroy();
  flightMovie.destroy();
  projectDropdown.destroy();
  flightDropdown.destroy();
  timelineController.destroy();
});

// ========================================
// Auto-load first flight
// ========================================

// After projects and flights are loaded, auto-select RF01 or first flight
let lastProjectName = null;
store.subscribe((state) => {
  const projectName = state.selection.projectName;
  const flights = state.metadata.flights[projectName];

  // Reset auto-load when project changes
  const projectChanged = lastProjectName !== projectName;
  lastProjectName = projectName;

  // Auto-load flight when: flights exist, project changed or no flight selected yet, and no flight is currently selected
  if (flights && flights.length > 0 && (projectChanged || !state.selection.flightId)) {
    // Try to find RF01 first, then any RF, then first flight
    let selectedFlight = flights.find(f => f.flight_number.toLowerCase() === 'rf01');
    
    if (!selectedFlight) {
      selectedFlight = flights.find(f => f.flight_number.toLowerCase().startsWith('rf'));
    }
    
    if (!selectedFlight) {
      selectedFlight = flights[0];
    }

    console.log('[main] Auto-loading flight:', selectedFlight.flight_number, 'ID:', selectedFlight.id);

    const flightId = parseInt(selectedFlight.id, 10);

    // Validate flight ID
    if (isNaN(flightId) || !flightId) {
      console.error('[main] Invalid flight ID:', selectedFlight);
      return;
    }

    console.log('[main] Dispatching selectFlight:', flightId, selectedFlight.flight_number);
    store.dispatch(selectFlight(flightId, selectedFlight.flight_number));

    console.log('[main] Dispatching fetchFlightData:', flightId, getSelectedVariables(state));
    store.dispatch(fetchFlightData(flightId, getSelectedVariables(state)));
  }
});

// Fetch initial flights for default project
store.dispatch(fetchFlightsForProject(initialState.selection.projectName));

console.log('[main] Initialization complete');
