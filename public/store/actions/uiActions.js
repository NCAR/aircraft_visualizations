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
 * Zoom a chart to specific domain
 * @param {number} chartIndex - Chart index (0-3)
 * @param {Array<Date>} domain - [startDate, endDate]
 * @returns {Object} Action
 */
export const chartZoom = (chartIndex, domain) => ({
  type: types.CHART_ZOOM,
  payload: { chartIndex, domain }
});

/**
 * Reset chart zoom to initial domain
 * @param {number} chartIndex - Chart index (0-7)
 * @returns {Object} Action
 */
export const chartResetZoom = (chartIndex) => ({
  type: types.CHART_RESET_ZOOM,
  payload: { chartIndex }
});

/**
 * Set the number of visible charts
 * @param {number} count - Number of charts to display (1-8)
 * @returns {Object} Action
 */
export const setVisibleChartCount = (count) => ({
  type: types.SET_VISIBLE_CHART_COUNT,
  payload: { count: Math.min(8, Math.max(1, count)) }
});

// ===============================
// Customizable Chart Config Actions
// ===============================

export const addChartVariable = (chartIndex, variableKey, axis = 'left') => ({
  type: types.ADD_CHART_VARIABLE,
  payload: { chartIndex, variableKey, axis }
});

export const removeChartVariable = (chartIndex, variableKey) => ({
  type: types.REMOVE_CHART_VARIABLE,
  payload: { chartIndex, variableKey }
});

export const moveChartVariableAxis = (chartIndex, variableKey, axis) => ({
  type: types.MOVE_CHART_VARIABLE_AXIS,
  payload: { chartIndex, variableKey, axis }
});

export const setChartAxisLabel = (chartIndex, axis, label) => ({
  type: types.SET_CHART_AXIS_LABEL,
  payload: { chartIndex, axis, label }
});

export const clearChartConfig = (chartIndex) => ({
  type: types.CLEAR_CHART_CONFIG,
  payload: { chartIndex }
});

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
