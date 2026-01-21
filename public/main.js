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
import SettingsOverlay from './modules/components/SettingsOverlay.js';
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
const settingsOverlay = new SettingsOverlay(store);

// Expose components globally for external access (e.g., FullscreenOverlay)
window.flightMap = flightMap;

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

    console.log('[main] Dispatching fetchFlightData:', flightId, state.selection.selectedVariables);
    store.dispatch(fetchFlightData(flightId, state.selection.selectedVariables));
  }
});

// Fetch initial flights for default project
store.dispatch(fetchFlightsForProject(initialState.selection.projectName));

console.log('[main] Initialization complete');
