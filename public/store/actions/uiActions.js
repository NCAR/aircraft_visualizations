/**
 * UI action creators
 * Handle UI state for timeline, charts, and map
 */

import * as types from './actionTypes.js';

// ========================================
// Timeline Window Actions
// ========================================

/**
 * Set timeline window (range selection)
 * @param {number} start - Start progress (0-1)
 * @param {number} end - End progress (0-1)
 * @param {string|null} pageContext - Optional page context
 * @returns {Function} Thunk action
 */
export const setTimelineWindow = (start, end, pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.SET_TIMELINE_WINDOW,
    payload: { start, end, page }
  });
};
// Timeline Actions
// ========================================

/**
 * Start timeline playback
 * @returns {Object} Action
 */
export const timelinePlay = () => ({
  type: types.TIMELINE_PLAY
});

/**
 * Pause timeline playback
 * @returns {Object} Action
 */
export const timelinePause = () => ({
  type: types.TIMELINE_PAUSE
});

/**
 * Seek timeline to specific time
 * @param {number} progress - Progress from 0 to 1
 * @param {Date} currentTime - Current time
 * @returns {Object} Action
 */
export const timelineSeek = (progress, currentTime) => ({
  type: types.TIMELINE_SEEK,
  payload: { progress, currentTime }
});

/**
 * Update timeline progress (called during playback)
 * @param {number} progress - Progress from 0 to 1
 * @param {Date} currentTime - Current time
 * @returns {Object} Action
 */
export const timelineUpdateProgress = (progress, currentTime) => ({
  type: types.TIMELINE_UPDATE_PROGRESS,
  payload: { progress, currentTime }
});

// ========================================
// Chart Actions
// ========================================

/**
 * Get page context - uses explicit pageContext if provided, otherwise falls back to router state
 * @param {Function} getState - Redux getState function
 * @param {string|null} pageContext - Optional explicit page context
 * @returns {string} 'dashboard' or 'realtime'
 */
const getPageContext = (getState, pageContext = null) => {
  if (pageContext) return pageContext;
  const state = getState();
  const path = state.router?.currentPath || '/';
  return path === '/realtime' ? 'realtime' : 'dashboard';
};

/**
 * Zoom a chart to specific domain
 * @param {number} chartIndex - Chart index (0-7)
 * @param {Array<Date>} domain - [startDate, endDate]
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const chartZoom = (chartIndex, domain, pageContext = null) => (dispatch, getState) => {
  // Accept domain as { x, y, yRight } or [x0, x1] for backward compatibility
  const page = getPageContext(getState, pageContext);
  let xDomain, yDomain, yRightDomain;
  if (Array.isArray(domain)) {
    xDomain = domain;
    yDomain = null;
    yRightDomain = null;
  } else if (domain && typeof domain === 'object') {
    xDomain = domain.x || null;
    yDomain = domain.y || null;
    yRightDomain = domain.yRight || null;
  }
  dispatch({
    type: types.CHART_ZOOM,
    payload: { chartIndex, xDomain, yDomain, yRightDomain, page }
  });
};

/**
 * Reset chart zoom to initial domain
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const chartResetZoom = (chartIndex, pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.CHART_RESET_ZOOM,
    payload: { chartIndex, page }
  });
};

/**
 * Set the number of visible charts
 * @param {number} count - Number of charts to display (1-8)
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const setVisibleChartCount = (count, pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.SET_VISIBLE_CHART_COUNT,
    payload: { count: Math.min(8, Math.max(1, count)), page }
  });
};

// ===============================
// Customizable Chart Config Actions
// ===============================

/**
 * Add a variable to a chart
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string} variableKey - Variable key/name
 * @param {string} axis - 'left' or 'right'
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const addChartVariable = (chartIndex, variableKey, axis = 'left', pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.ADD_CHART_VARIABLE,
    payload: { chartIndex, variableKey, axis, page }
  });
};

/**
 * Remove a variable from a chart
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string} variableKey - Variable key/name
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const removeChartVariable = (chartIndex, variableKey, pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.REMOVE_CHART_VARIABLE,
    payload: { chartIndex, variableKey, page }
  });
};

/**
 * Move a chart variable to a different axis
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string} variableKey - Variable key/name
 * @param {string} axis - 'left' or 'right'
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const moveChartVariableAxis = (chartIndex, variableKey, axis, pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.MOVE_CHART_VARIABLE_AXIS,
    payload: { chartIndex, variableKey, axis, page }
  });
};

/**
 * Set a chart axis label
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string} axis - 'left' or 'right'
 * @param {string} label - Axis label text
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const setChartAxisLabel = (chartIndex, axis, label, pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.SET_CHART_AXIS_LABEL,
    payload: { chartIndex, axis, label, page }
  });
};

/**
 * Clear all configuration for a chart
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
 * @returns {Function} Thunk action
 */
export const clearChartConfig = (chartIndex, pageContext = null) => (dispatch, getState) => {
  const page = getPageContext(getState, pageContext);
  dispatch({
    type: types.CLEAR_CHART_CONFIG,
    payload: { chartIndex, page }
  });
};

// ========================================
// Map Actions
// ========================================

/**
 * Toggle radar overlay on map
 * @returns {Object} Action
 */
export const mapToggleRadar = () => ({
  type: types.MAP_TOGGLE_RADAR
});

/**
 * Set visibility for a specific map layer
 * @param {string} layerId - Layer identifier (glm, mrms, goesVisible, goesIR, nexrad)
 * @param {boolean} visible - Whether the layer should be visible
 * @returns {Object} Action
 */
export const setMapLayerVisibility = (layerId, visible) => ({
  type: types.MAP_SET_LAYER_VISIBILITY,
  payload: { layerId, visible }
});
