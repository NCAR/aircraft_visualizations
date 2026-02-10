// Get timeline window (range selection)
export const getTimelineWindow = (state, pageContext = null) => {
  const page = getPage(state, pageContext);
  if (!state.ui.charts[page]) return null;
  return state.ui.charts[page].timelineWindow || null;
};
/**
 * Get realtime variable metadata as array (for SettingsOverlay/VariablesListTable)
 * @param {Object} state - Redux state
 * @returns {Array} Array of variable metadata objects
 */
export const getRealtimeVariablesWithMetadata = (state) => {
  const names = state.realtime.variables || [];
  const metadata = state.realtime.variableMetadata || {};
  return names.map(name => {
    const meta = metadata[name.toUpperCase()] || {};
    return {
      name,
      clean_name: name,
      long_name: meta.long_name || name,
      units: meta.units || '-',
      category: meta.category || '-',
      ...meta
    };
  });
};
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
  if (!cleanName || typeof cleanName !== 'string') return null;

  // Check dashboard variable metadata first
  const dashboardVar = state.metadata.variables.find(v => v.clean_name === cleanName);
  if (dashboardVar) return dashboardVar;

  // Fallback to realtime variable metadata (keyed by name, may be uppercase)
  const rtMeta = state.realtime?.variableMetadata;
  if (rtMeta) {
    const meta = rtMeta[cleanName] || rtMeta[cleanName.toUpperCase()];
    if (meta) {
      return {
        name: cleanName,
        clean_name: cleanName,
        long_name: meta.long_name || cleanName,
        units: meta.units || '',
        category: meta.category || '',
        ...meta
      };
    }
  }

  return null;
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
 * Helper to determine page from explicit pageContext or fallback to router state
 * @param {Object} state - Redux state
 * @param {string|null} pageContext - Explicit page context ('dashboard' or 'realtime')
 * @returns {string} 'dashboard' or 'realtime'
 */
const getPage = (state, pageContext = null) => {
  if (pageContext) return pageContext;
  const path = getCurrentPath(state);
  return path === '/realtime' ? 'realtime' : 'dashboard';
};

/**
 * Get selected chart index
 * @param {Object} state - Redux state
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {number} Chart index (0-7)
 */
export const getSelectedChartIndex = (state, pageContext = null) => {
  const idx = state.selection.selectedChartIndex;
  // Handle both old (number) and new (object) formats for backward compatibility
  if (typeof idx === 'number') {
    return idx;
  }
  const page = getPage(state, pageContext);
  return idx[page] || 0;
};

/**
 * Get selected variables for all charts
 * @param {Object} state - Redux state
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Array<string>} Array of variable clean names
 */
// Always return array of arrays (per chart) for both dashboard and realtime
export const getSelectedVariables = (state, pageContext = null) => {
  const page = getPage(state, pageContext);
  const vars = state.selection.selectedVariables;

  // Backward compatibility: if flat array, wrap as array of arrays
  if (Array.isArray(vars)) {
    return vars.map(v => (v !== undefined && v !== null ? [v] : []));
  }
  // If already array of arrays, return as is
  if (Array.isArray(vars[page]) && Array.isArray(vars[page][0])) {
    return vars[page];
  }
  // If array of strings, wrap each as array
  if (Array.isArray(vars[page])) {
    return vars[page].map(v => (v !== undefined && v !== null ? [v] : []));
  }
  // Default: 8 empty arrays
  return [[], [], [], [], [], [], [], []];
};

/**
 * Get variable for a specific chart
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {string} Variable clean name
 */
export const getChartVariable = (state, chartIndex, pageContext = null) => {
  const page = getPage(state, pageContext);
  const vars = state.selection.selectedVariables;

  // Handle both old (array) and new (object) formats for backward compatibility
  if (Array.isArray(vars)) {
    const entry = vars[chartIndex];
    // If entry is an array (multi-variable per chart), return first
    return Array.isArray(entry) ? entry[0] || null : entry;
  }
  const entry = vars[page]?.[chartIndex];
  if (entry == null) return null;
  // If entry is an array (multi-variable per chart), return first
  return Array.isArray(entry) ? entry[0] || null : entry;
};

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
 * Check if user is actively seeking (dragging timeline)
 * @param {Object} state - Redux state
 * @returns {boolean} True if seeking
 */
export const isTimelineSeeking = (state) => state.ui.timeline.isSeeking;

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

// ===============================
// Chart Config Selectors
// ===============================

/**
 * Get chart configuration for a specific chart
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Object} Chart config { variables: [], axes: { leftLabel, rightLabel } }
 */
export const getChartConfig = (state, chartIndex, pageContext = null) => {
  const page = getPage(state, pageContext);
  // Ensure the page namespace exists
  if (!state.ui.charts[page]) {
    return { variables: [], axes: { leftLabel: null, rightLabel: null } };
  }
  const cfg = state.ui.charts[page]?.configs?.[chartIndex];
  return cfg || { variables: [], axes: { leftLabel: null, rightLabel: null } };
};

/**
 * Get chart variables grouped by axis (keys only, for backward compatibility)
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Object} { left: [keys], right: [keys] }
 */
export const getChartVariablesByAxis = (state, chartIndex, pageContext = null) => {
  const cfg = getChartConfig(state, chartIndex, pageContext);
  return {
    left: cfg.variables.filter(v => v.axis === 'left').map(v => v.key),
    right: cfg.variables.filter(v => v.axis === 'right').map(v => v.key)
  };
};

/**
 * Get full chart variable configs including colors
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Array} Array of { key, axis, color } objects
 */
export const getChartVariablesWithColors = (state, chartIndex, pageContext = null) => {
  const cfg = getChartConfig(state, chartIndex, pageContext);
  return cfg.variables || [];
};

/**
 * Get chart variables grouped by axis with full config (including colors)
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Object} { left: [{key, axis, color}], right: [{key, axis, color}] }
 */
export const getChartVariablesByAxisWithColors = (state, chartIndex, pageContext = null) => {
  const cfg = getChartConfig(state, chartIndex, pageContext);
  return {
    left: cfg.variables.filter(v => v.axis === 'left'),
    right: cfg.variables.filter(v => v.axis === 'right')
  };
};

/**
 * Get chart axis label
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index
 * @param {string} axis - 'left' or 'right'
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {string|null} Axis label
 */
export const getChartAxisLabel = (state, chartIndex, axis, pageContext = null) => {
  const cfg = getChartConfig(state, chartIndex, pageContext);
  return axis === 'right' ? cfg.axes.rightLabel : cfg.axes.leftLabel;
};

/**
 * Get zoom domain for a specific chart
 * @param {Object} state - Redux state
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Array<Date>|null} [startDate, endDate] or null
 */
export const getChartZoomDomain = (state, chartIndex, pageContext = null) => {
  const page = getPage(state, pageContext);
  if (!state.ui.charts[page]) return null;
  const domainObj = state.ui.charts[page].zoomDomains?.[chartIndex];
  if (!domainObj) return null;
  return domainObj;
};

/**
 * Get number of visible charts
 * @param {Object} state - Redux state
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {number} Visible chart count (1-8)
 */
export const getVisibleChartCount = (state, pageContext = null) => {
  const page = getPage(state, pageContext);
  // Ensure the page namespace exists
  if (!state.ui.charts[page]) {
    return 4;
  }
  return state.ui.charts[page].visibleCount || 4;
};

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
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Array} Array of chart config objects for visible charts
 */
export const getChartConfigs = (state, pageContext = null) => {
  const variables = getSelectedVariables(state, pageContext);
  const allVariables = getVariables(state);
  const visibleCount = getVisibleChartCount(state, pageContext);

  return variables.slice(0, visibleCount).map((cleanName, index) => {
    const metadata = allVariables.find(v => v.clean_name === cleanName);
    return {
      index,
      cleanName,
      longName: metadata?.long_name || cleanName,
      units: metadata?.units || '',
      showXLabel: true  // Always show X labels on all charts
    };
  });
};

/**
 * Check if we have all necessary data loaded for current view
 * @param {Object} state - Redux state
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {boolean} True if all data loaded
 */
export const isCurrentViewReady = (state, pageContext = null) => {
  const flightId = getCurrentFlightId(state);
  if (!flightId) return false;

  const flightData = getFlightData(state, flightId);
  if (!flightData) return false;

  const selectedVars = getSelectedVariables(state, pageContext);
  const loadedVars = flightData.loadedVariables || new Set();

  // Check if all selected variables are loaded
  return selectedVars.every(v => loadedVars.has(v));
};

// ========================================
// Router Selectors
// ========================================

/**
 * Get current route path
 * @param {Object} state - Redux state
 * @returns {string} Current path
 */
export const getCurrentPath = (state) => state.router?.currentPath || '/';

/**
 * Get current route query parameters
 * @param {Object} state - Redux state
 * @returns {Object} Query parameters
 */
export const getRouteQuery = (state) => state.router?.query || {};

/**
 * Check if URL state has been restored
 * @param {Object} state - Redux state
 * @returns {boolean} True if URL state was restored
 */
export const isURLStateRestored = (state) => state.router?.urlStateRestored || false;

// ========================================
// Page-Aware Selectors (Unified Dashboard/Realtime)
// ========================================

/**
 * Get data source based on current page
 * Returns flight data for dashboard, realtime data for realtime page
 * @param {Object} state - Redux state
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Object|null} Flight data object or null
 */
export const getCurrentPageData = (state, pageContext = null) => {
  const page = getPage(state, pageContext);

  if (page === 'realtime') {
    const rt = state.realtime;
    if (!rt.data || rt.data.length === 0) return null;

    let data = rt.data;
    let timeRange = rt.timeRange;

    // Filter to time window if set
    if (rt.timeWindow && rt.timeRange?.end) {
      const cutoff = new Date(rt.timeRange.end.getTime() - rt.timeWindow * 60 * 1000);
      data = data.filter(row => new Date(row.datetime) >= cutoff);
      if (data.length > 0) {
        timeRange = { start: new Date(data[0].datetime), end: rt.timeRange.end };
      }
    }

    // Transform realtime format to dashboard format
    return {
      timeseries: data.map(row => ({
        Time: new Date(row.datetime),
        ...row
      })),
      timeRange,
      track: [],
      loadedVariables: new Set(rt.variables)
    };
  } else {
    return getCurrentFlightData(state);
  }
};

/**
 * Get available variables for current page
 * @param {Object} state - Redux state
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Array} Variables array
 */
export const getPageVariables = (state, pageContext = null) => {
  const page = getPage(state, pageContext);

  if (page === 'realtime') {
    const metadata = state.realtime.variableMetadata;
    return state.realtime.variables.map(name => ({
      name,
      clean_name: name,
      long_name: metadata[name.toUpperCase()]?.long_name || name,
      units: metadata[name.toUpperCase()]?.units || '-',
      category: metadata[name.toUpperCase()]?.category || '-'
    }));
  } else {
    return getVariables(state);
  }
};
