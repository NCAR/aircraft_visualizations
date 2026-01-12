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
 * @param {number} chartIndex - Chart index (0-3)
 * @returns {Object} Action
 */
export const chartResetZoom = (chartIndex) => ({
  type: types.CHART_RESET_ZOOM,
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
