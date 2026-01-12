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

// Import selectors
import {
  getCurrentFlightId,
  getSelectedVariables,
  getVariableMetadata,
  isTimelinePlaying,
  getCurrentTime
} from './store/selectors/selectors.js';

// Import store-connected components
import LineChartStore from './modules/LineChartStore.js';
import FlightMapStore from './modules/FlightMapStore.js';
import FlightMovieStore from './modules/FlightMovieStore.js';
import TimelineControllerStore, { TimelineUI } from './modules/TimeLineStore.js';

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
    selectedVariables: ['atx', 'wic', 'wdc', 'dpxc']
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
      zoomDomains: {}
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

// Initialize timeline UI controls
const timelineUI = new TimelineUI(store, timelineController);

// Initialize charts
const charts = [];
const chartConfigs = [
  { selector: '#chart1', showXLabel: false },
  { selector: '#chart2', showXLabel: false },
  { selector: '#chart3', showXLabel: false },
  { selector: '#chart4', showXLabel: true }
];

chartConfigs.forEach((config, index) => {
  const chart = new LineChartStore(config.selector, store, index, config.showXLabel);
  charts.push(chart);
});

console.log('[main] Components initialized:', {
  charts: charts.length,
  flightMap: !!flightMap,
  flightMovie: !!flightMovie,
  timelineController: !!timelineController
});

// ========================================
// Fetch Initial Data
// ========================================

// Fetch projects and variables on page load
store.dispatch(fetchProjects());
store.dispatch(fetchVariables());

// Subscribe to metadata changes to populate dropdowns
store.subscribe((state) => {
  updateProjectDropdown(state);
  updateFlightDropdown(state);
  updateVariableDropdown(state);
});

// ========================================
// Update UI Dropdowns
// ========================================

function updateProjectDropdown(state) {
  const projectSelect = document.getElementById('project-select');
  if (!projectSelect || state.metadata.projects.length === 0) return;

  // Only update if projects changed
  const currentOptions = Array.from(projectSelect.options).map(o => o.value);
  const newProjects = state.metadata.projects.map(p => p.project_name);

  if (JSON.stringify(currentOptions) === JSON.stringify(newProjects)) {
    return;
  }

  projectSelect.innerHTML = '';
  state.metadata.projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.project_name;
    option.textContent = project.project_name;
    option.selected = project.project_name === state.selection.projectName;
    projectSelect.appendChild(option);
  });

  console.log('[main] Project dropdown updated');
}

function updateFlightDropdown(state) {
  const flightSelect = document.getElementById('flight-select');
  if (!flightSelect) return;

  const flights = state.metadata.flights[state.selection.projectName] || [];
  if (flights.length === 0) return;

  // Only update if flights changed
  const currentOptions = Array.from(flightSelect.options).map(o => parseInt(o.value));
  const newFlightIds = flights.map(f => f.id);

  if (JSON.stringify(currentOptions) === JSON.stringify(newFlightIds)) {
    return;
  }

  console.log('[main] Updating flight dropdown with flights:', flights);

  flightSelect.innerHTML = '';
  flights.forEach(flight => {
    const option = document.createElement('option');
    // API returns 'id', not 'flight_id'
    option.value = flight.id;
    option.textContent = flight.flight_number;
    option.selected = flight.id === state.selection.flightId;
    flightSelect.appendChild(option);
  });

  console.log('[main] Flight dropdown updated with', flights.length, 'flights');
}

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

// Project selection
const projectSelect = document.getElementById('project-select');
if (projectSelect) {
  projectSelect.addEventListener('change', function() {
    const projectName = this.value;
    console.log('[main] Project changed to:', projectName);

    store.dispatch(selectProject(projectName));
    store.dispatch(fetchFlightsForProject(projectName));
  });
} else {
  console.error('[main] project-select element not found');
}

// Flight selection
const flightSelect = document.getElementById('flight-select');
if (flightSelect) {
  flightSelect.addEventListener('change', function() {
    const flightId = parseInt(this.value, 10);
    const flightNumber = this.options[this.selectedIndex].text;
    console.log('[main] Flight changed to:', { flightId, flightNumber, rawValue: this.value });

    // Validate flight ID
    if (isNaN(flightId) || !flightId) {
      console.error('[main] Invalid flight ID:', this.value);
      return;
    }

    store.dispatch(selectFlight(flightId, flightNumber));

    // Fetch data for selected variables
    const state = store.getState();
    const variables = getSelectedVariables(state);
    store.dispatch(fetchFlightData(flightId, variables));
  });
} else {
  console.error('[main] flight-select element not found');
}

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
  charts.forEach(chart => chart.destroy());
  flightMap.destroy();
  flightMovie.destroy();
  timelineController.destroy();
});

// ========================================
// Auto-load first flight
// ========================================

// After projects and flights are loaded, auto-select first flight
let autoLoadAttempted = false;
store.subscribe((state) => {
  if (autoLoadAttempted) return;

  const projectName = state.selection.projectName;
  const flights = state.metadata.flights[projectName];

  if (flights && flights.length > 0 && !state.selection.flightId) {
    console.log('[main] Auto-loading first flight', flights[0]);
    autoLoadAttempted = true;

    const firstFlight = flights[0];
    // API returns 'id', not 'flight_id'
    const flightId = parseInt(firstFlight.id, 10);

    // Validate flight ID
    if (isNaN(flightId) || !flightId) {
      console.error('[main] Invalid first flight ID:', firstFlight);
      return;
    }

    console.log('[main] Dispatching selectFlight:', flightId, firstFlight.flight_number);
    store.dispatch(selectFlight(flightId, firstFlight.flight_number));

    console.log('[main] Dispatching fetchFlightData:', flightId, state.selection.selectedVariables);
    store.dispatch(fetchFlightData(flightId, state.selection.selectedVariables));
  }
});

// Fetch initial flights for default project
store.dispatch(fetchFlightsForProject(initialState.selection.projectName));

console.log('[main] Initialization complete');
