/**
 * Selection action creators
 * Handle user selections for project, flight, chart, and variables
 */

import * as types from './actionTypes.js';

/**
 * Select a project
 * @param {string} projectName - Project name
 * @returns {Object} Action
 */
export const selectProject = (projectName) => ({
  type: types.SELECT_PROJECT,
  payload: { projectName }
});

/**
 * Select a flight
 * @param {number} flightId - Flight ID
 * @param {string} flightNumber - Flight number (e.g., 'RF01')
 * @returns {Object} Action
 */
export const selectFlight = (flightId, flightNumber) => ({
  type: types.SELECT_FLIGHT,
  payload: { flightId, flightNumber }
});

/**
 * Select a chart (makes it the active chart for variable changes)
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string|null} page - Optional page context ('dashboard' or 'realtime')
 * @returns {Object} Action
 */
export const selectChart = (chartIndex, page = null) => ({
  type: types.SELECT_CHART,
  payload: { chartIndex, page }
});

/**
 * Update variable for a specific chart
 * @param {number} chartIndex - Chart index (0-7)
 * @param {string} variableCleanName - Variable clean name
 * @param {string|null} page - Optional page context ('dashboard' or 'realtime')
 * @returns {Object} Action
 */
export const updateChartVariable = (chartIndex, variableCleanName, page = null) => ({
  type: types.UPDATE_CHART_VARIABLE,
  payload: { chartIndex, variableCleanName, page }
});

/**
 * Set all selected variables at once (used for URL state restoration)
 * @param {Array<string>} variables - Array of variable clean names
 * @param {string} page - Page context ('dashboard' or 'realtime')
 * @returns {Object} Action
 */
export const setSelectedVariables = (variables, page = 'dashboard') => ({
  type: types.SET_SELECTED_VARIABLES,
  payload: { variables, page }
});
