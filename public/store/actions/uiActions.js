/**
 * UI action creators
 * Handle UI state for timeline, charts, and map
 */

import * as types from './actionTypes.js';

// ========================================
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
 * Get current page context from router state
 * @param {Function} getState - Redux getState function
 * @returns {string} 'dashboard' or 'realtime'
 */
const getCurrentPage = (getState) => {
  const state = getState();
  const path = state.router?.currentPath || '/';
  return path === '/realtime' ? 'realtime' : 'dashboard';
};

/**
 * Zoom a chart to specific domain
 * @param {number} chartIndex - Chart index (0-3)
 * @param {Array<Date>} domain - [startDate, endDate]
 * @returns {Function} Thunk action
 */
export const chartZoom = (chartIndex, domain) => (dispatch, getState) => {
  const page = getCurrentPage(getState);
  dispatch({
    type: types.CHART_ZOOM,
    payload: { chartIndex, domain, page }
  });
};

/**
 * Reset chart zoom to initial domain
 * @param {number} chartIndex - Chart index (0-7)
 * @returns {Function} Thunk action
 */
export const chartResetZoom = (chartIndex) => (dispatch, getState) => {
  const page = getCurrentPage(getState);
  dispatch({
    type: types.CHART_RESET_ZOOM,
    payload: { chartIndex, page }
  });
};

/**
 * Set the number of visible charts
 * @param {number} count - Number of charts to display (1-8)
 * @returns {Function} Thunk action
 */
export const setVisibleChartCount = (count) => (dispatch, getState) => {
  const page = getCurrentPage(getState);
  dispatch({
    type: types.SET_VISIBLE_CHART_COUNT,
    payload: { count: Math.min(8, Math.max(1, count)), page }
  });
};

// ===============================
// Customizable Chart Config Actions
// ===============================

export const addChartVariable = (chartIndex, variableKey, axis = 'left') => (dispatch, getState) => {
  const page = getCurrentPage(getState);
  dispatch({
    type: types.ADD_CHART_VARIABLE,
    payload: { chartIndex, variableKey, axis, page }
  });
};

export const removeChartVariable = (chartIndex, variableKey) => (dispatch, getState) => {
  const page = getCurrentPage(getState);
  dispatch({
    type: types.REMOVE_CHART_VARIABLE,
    payload: { chartIndex, variableKey, page }
  });
};

export const moveChartVariableAxis = (chartIndex, variableKey, axis) => (dispatch, getState) => {
  const page = getCurrentPage(getState);
  dispatch({
    type: types.MOVE_CHART_VARIABLE_AXIS,
    payload: { chartIndex, variableKey, axis, page }
  });
};

export const setChartAxisLabel = (chartIndex, axis, label) => (dispatch, getState) => {
  const page = getCurrentPage(getState);
  dispatch({
    type: types.SET_CHART_AXIS_LABEL,
    payload: { chartIndex, axis, label, page }
  });
};

export const clearChartConfig = (chartIndex) => (dispatch, getState) => {
  const page = getCurrentPage(getState);
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
