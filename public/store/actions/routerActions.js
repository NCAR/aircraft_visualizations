/**
 * Router action creators
 * Handle navigation and URL state management
 */

import * as types from './actionTypes.js';

/**
 * Navigate to a new route
 * @param {string} path - Route path (e.g., '/', '/about', '/realtime')
 * @param {Object} [query={}] - Query parameters
 * @returns {Object} Action
 */
export const navigate = (path, query = {}) => ({
  type: types.NAVIGATE,
  payload: { path, query }
});

/**
 * Signal that URL state has been restored
 * Used to coordinate components after initial URL parsing
 * @param {Object} [restoredState={}] - The state that was restored
 * @returns {Object} Action
 */
export const urlStateRestored = (restoredState = {}) => ({
  type: types.URL_STATE_RESTORED,
  payload: { restoredState, timestamp: Date.now() }
});
