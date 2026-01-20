// ========================================
// Metadata Selectors
// ========================================

/**
 * Get all projects
 * @param {Object} state - Redux state
 * @returns {Array} Projects array
 */
export const getProjects = (state) => state.metadata.projects;

/**
 * Get flights for a specific project
 * @param {Object} state - Redux state
 * @param {string} projectName - Project name
 * @returns {Array} Flights array
 */
export const getFlightsForProject = (state, projectName) =>
  state.metadata.flights[projectName] || [];

/**
 * Get all variables
 * @param {Object} state - Redux state
 * @returns {Array} Variables array
 */
export const getVariables = (state) => state.metadata.variables;

/**
 * Get variable metadata by clean name
 * @param {Object} state - Redux state
 * @param {string} cleanName - Variable clean name
 * @returns {Object|null} Variable metadata or null
 */
export const getVariableMetadata = (state, cleanName) => {
  return state.metadata.variables.find(v => v.clean_name === cleanName) || null;
};

// ========================================
// Selection Selectors
// ========================================

/**
 * Get current project name
 * @param {Object} state - Redux state
 * @returns {string} Project name
 */
export const getCurrentProject = (state) => state.selection.projectName;

/**
 * Alias for getCurrentProject
 * @param {Object} state - Redux state
 * @returns {string} Project name
 */
export const getCurrentProjectName = (state) => state.selection.projectName;

/**
 * Get current flight ID
 * @param {Object} state - Redux state
 * @returns {number|null} Flight ID
 */
export const getCurrentFlightId = (state) => state.selection.flightId;

/**
 * Get current flight number
 * @param {Object} state - Redux state
 * @returns {string|null} Flight number (e.g., 'RF01')
 */
export const getCurrentFlightNumber = (state) => state.selection.flightNumber;

/**
 * Get selected chart index
 * @param {Object} state - Redux state
 * @returns {number} Chart index (0-3)
 */
export const getSelectedChartIndex = (state) => state.selection.selectedChartIndex;

/**
 * Get selected variables for all charts
 * @param {Object} state - Redux state
 * @returns {Array<string>} Array of variable clean names
 */
export const getSelectedVariables = (state) => state.selection.selectedVariables;

/**
 * Get variable for a specific chart
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index (0-3)
 * @returns {string} Variable clean name
 */
export const getChartVariable = (state, chartIndex) =>
  state.selection.selectedVariables[chartIndex];

// ========================================
// Data Selectors
// ========================================

/**
 * Get flight data by ID
 * @param {Object} state - Redux state
 * @param {number} flightId - Flight ID
 * @returns {Object|null} Flight data or null
 */
export const getFlightData = (state, flightId) =>
  state.data.flightData[flightId] || null;

/**
 * Get current flight data
 * @param {Object} state - Redux state
 * @returns {Object|null} Flight data or null
 */
export const getCurrentFlightData = (state) => {
  const flightId = getCurrentFlightId(state);
  return flightId ? getFlightData(state, flightId) : null;
};

/**
 * Get timeseries data for current flight
 * @param {Object} state - Redux state
 * @returns {Array} Timeseries array
 */
export const getCurrentTimeseries = (state) => {
  const flightData = getCurrentFlightData(state);
  return flightData?.timeseries || [];
};

/**
 * Get track data for current flight
 * @param {Object} state - Redux state
 * @returns {Array} Track array
 */
export const getCurrentTrack = (state) => {
  const flightData = getCurrentFlightData(state);
  return flightData?.track || [];
};

/**
 * Get time range for current flight
 * @param {Object} state - Redux state
 * @returns {Object|null} Time range { start, end } or null
 */
export const getCurrentTimeRange = (state) => {
  const flightData = getCurrentFlightData(state);
  return flightData?.timeRange || null;
};

/**
 * Check if a variable is loaded for current flight
 * @param {Object} state - Redux state
 * @param {string} variableCleanName - Variable clean name
 * @returns {boolean} True if loaded
 */
export const isVariableLoaded = (state, variableCleanName) => {
  const flightData = getCurrentFlightData(state);
  return flightData?.loadedVariables?.has(variableCleanName) || false;
};

/**
 * Get timeseries data for a specific variable
 * @param {Object} state - Redux state
 * @param {string} variableCleanName - Variable clean name
 * @returns {Array} Array of { Time, value } objects
 */
export const getTimeseriesForVariable = (state, variableCleanName) => {
  const timeseries = getCurrentTimeseries(state);
  return timeseries.map(entry => ({
    Time: entry.Time,
    value: entry[variableCleanName]
  }));
};

// ========================================
// UI Selectors
// ========================================

/**
 * Check if timeline is playing
 * @param {Object} state - Redux state
 * @returns {boolean} True if playing
 */
export const isTimelinePlaying = (state) => state.ui.timeline.isPlaying;

/**
 * Get timeline progress (0 to 1)
 * @param {Object} state - Redux state
 * @returns {number} Progress value
 */
export const getTimelineProgress = (state) => state.ui.timeline.progress;

/**
 * Get current time in timeline
 * @param {Object} state - Redux state
 * @returns {Date|null} Current time
 */
export const getCurrentTime = (state) => state.ui.timeline.currentTime;

/**
 * Get zoom domain for a specific chart
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index (0-7)
 * @returns {Array<Date>|null} [startDate, endDate] or null
 */
export const getChartZoomDomain = (state, chartIndex) =>
  state.ui.charts.zoomDomains[chartIndex] || null;

/**
 * Get number of visible charts
 * @param {Object} state - Redux state
 * @returns {number} Visible chart count (1-8)
 */
export const getVisibleChartCount = (state) => state.ui.charts.visibleCount;

/**
 * Check if radar is enabled on map
 * @param {Object} state - Redux state
 * @returns {boolean} True if radar enabled
 */
export const isRadarEnabled = (state) => state.ui.map.showRadar;

/**
 * Get all map layer visibility states
 * @param {Object} state - Redux state
 * @returns {Object} Map of layerId to visibility boolean
 */
export const getMapLayers = (state) => state.ui.map.layers || {
  glm: false,
  mrms: false,
  goesVisible: false,
  goesIR: false,
  nexrad: true
};

/**
 * Check if a specific map layer is visible
 * @param {Object} state - Redux state
 * @param {string} layerId - Layer identifier
 * @returns {boolean} True if layer is visible
 */
export const isLayerVisible = (state, layerId) => state.ui.map.layers[layerId] || false;

/**
 * Check if something is loading
 * @param {Object} state - Redux state
 * @returns {Object} Loading states
 */
export const getLoadingStates = (state) => state.ui.loading;

/**
 * Check if flight data is loading
 * @param {Object} state - Redux state
 * @returns {boolean} True if loading
 */
export const isLoadingFlightData = (state) => state.ui.loading.flightData;

/**
 * Get errors
 * @param {Object} state - Redux state
 * @returns {Object} Error states
 */
export const getErrors = (state) => state.ui.errors;

/**
 * Get flight data error
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export const getFlightDataError = (state) => state.ui.errors.flightData;

/**
 * Check if specific data is loading
 * @param {Object} state - Redux state
 * @param {string} key - Loading key (projects, flights, flightData, variables)
 * @returns {boolean} True if loading
 */
export const isLoading = (state, key) => state.ui.loading[key] || false;

/**
 * Get error for specific key
 * @param {Object} state - Redux state
 * @param {string} key - Error key (projects, flights, flightData, variables)
 * @returns {string|null} Error message or null
 */
export const getError = (state, key) => state.ui.errors[key];

// ========================================
// Derived/Memoized Selectors
// ========================================

/**
 * Get chart configurations for visible charts
 * Combines variable selection with metadata and visibility
 * @param {Object} state - Redux state
 * @returns {Array} Array of chart config objects for visible charts
 */
export const getChartConfigs = (state) => {
  const variables = getSelectedVariables(state);
  const allVariables = getVariables(state);
  const visibleCount = getVisibleChartCount(state);

  return variables.slice(0, visibleCount).map((cleanName, index) => {
    const metadata = allVariables.find(v => v.clean_name === cleanName);
    return {
      index,
      cleanName,
      longName: metadata?.long_name || cleanName,
      units: metadata?.units || '',
      showXLabel: index === visibleCount - 1  // Last visible chart shows X labels
    };
  });
};

/**
 * Check if we have all necessary data loaded for current view
 * @param {Object} state - Redux state
 * @returns {boolean} True if all data loaded
 */
export const isCurrentViewReady = (state) => {
  const flightId = getCurrentFlightId(state);
  if (!flightId) return false;

  const flightData = getFlightData(state, flightId);
  if (!flightData) return false;

  const selectedVars = getSelectedVariables(state);
  const loadedVars = flightData.loadedVariables || new Set();

  // Check if all selected variables are loaded
  return selectedVars.every(v => loadedVars.has(v));
};
