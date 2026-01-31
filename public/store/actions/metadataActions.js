/**
 * Metadata action creators
 * Handle fetching project, flight, and variable metadata
 */

import * as types from './actionTypes.js';

// ========================================
// Projects Actions
// ========================================

export const fetchProjectsRequest = () => ({
  type: types.FETCH_PROJECTS_REQUEST
});

export const fetchProjectsSuccess = (projects) => ({
  type: types.FETCH_PROJECTS_SUCCESS,
  payload: { projects }
});

export const fetchProjectsFailure = (error) => ({
  type: types.FETCH_PROJECTS_FAILURE,
  payload: { error }
});

/**
 * Async action to fetch all projects
 * @returns {Function} Thunk function
 */
export const fetchProjects = () => {
  return async (dispatch) => {
    dispatch(fetchProjectsRequest());

    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const projects = await response.json();
      dispatch(fetchProjectsSuccess(projects));
    } catch (error) {
      console.error('[fetchProjects] Error:', error);
      dispatch(fetchProjectsFailure(error.message));
    }
  };
};

// ========================================
// Flights Actions
// ========================================

export const fetchFlightsRequest = (projectName) => ({
  type: types.FETCH_FLIGHTS_REQUEST,
  payload: { projectName }
});

export const fetchFlightsSuccess = (projectName, flights) => ({
  type: types.FETCH_FLIGHTS_SUCCESS,
  payload: { projectName, flights }
});

export const fetchFlightsFailure = (projectName, error) => ({
  type: types.FETCH_FLIGHTS_FAILURE,
  payload: { projectName, error }
});

/**
 * Async action to fetch flights for a project
 * @param {string} projectName - Project name
 * @returns {Function} Thunk function
 */
export const fetchFlightsForProject = (projectName) => {
  return async (dispatch) => {
    dispatch(fetchFlightsRequest(projectName));

    try {
      const response = await fetch(`/api/projects/${projectName}/flights`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const flights = await response.json();
      dispatch(fetchFlightsSuccess(projectName, flights));
    } catch (error) {
      console.error('[fetchFlightsForProject] Error:', error);
      dispatch(fetchFlightsFailure(projectName, error.message));
    }
  };
};

// ========================================
// Variables Actions
// ========================================

// Fetch variables for a specific project
// Usage: fetchVariablesForProject('PROJECT_NAME')
export const fetchVariablesForProject = (projectName) => {
  return async (dispatch) => {
    dispatch(fetchVariablesRequest());
    try {
      const response = await fetch(`/api/variables?project=${encodeURIComponent(projectName)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const variables = await response.json();
      dispatch(fetchVariablesSuccess(variables));
    } catch (error) {
      console.error('[fetchVariablesForProject] Error:', error);
      dispatch(fetchVariablesFailure(error.message));
    }
  };
};

export const fetchVariablesRequest = () => ({
  type: types.FETCH_VARIABLES_REQUEST
});

export const fetchVariablesSuccess = (variables) => ({
  type: types.FETCH_VARIABLES_SUCCESS,
  payload: { variables }
});

export const fetchVariablesFailure = (error) => ({
  type: types.FETCH_VARIABLES_FAILURE,
  payload: { error }
});

/**
 * Async action to fetch all variables
 * @returns {Function} Thunk function
 */
export const fetchVariables = () => {
  return async (dispatch) => {
    dispatch(fetchVariablesRequest());

    try {
      const response = await fetch('/api/variables');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const variables = await response.json();
      dispatch(fetchVariablesSuccess(variables));
    } catch (error) {
      console.error('[fetchVariables] Error:', error);
      dispatch(fetchVariablesFailure(error.message));
    }
  };
};
