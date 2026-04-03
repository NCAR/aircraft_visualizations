/**
 * Metadata action creators
 * Handle fetching project, flight, and variable metadata
 */

import * as types from './actionTypes.js';

/**
 * Projects listed here are hidden from project dropdowns and the dashboard
 * projects table because they do not currently have usable data.
 */
export const EXCLUDED_PROJECT_NAMES = [ 'winter', 'cset','deepwave', 'mitts','mpex','sprite-ii','nomadss','ideas-4','contrast'
  // 'EXAMPLE_PROJECT'
];

function normalizeProjectName(name) {
  return String(name || '').trim().toLowerCase();
}

function getProjectName(project) {
  if (typeof project === 'string') return project;
  if (!project || typeof project !== 'object') return '';
  return project.project_name || project.name || '';
}

/**
 * Filter project list using the configured exclusion list.
 * Accepts both project objects and plain project-name strings.
 */
export const filterExcludedProjects = (
  projects = [],
  excludedProjectNames = EXCLUDED_PROJECT_NAMES
) => {
  if (!Array.isArray(projects) || projects.length === 0) {
    return [];
  }

  const excluded = new Set(
    (excludedProjectNames || [])
      .map(normalizeProjectName)
      .filter(Boolean)
  );

  if (excluded.size === 0) {
    return projects;
  }

  return projects.filter((project) => {
    const projectName = normalizeProjectName(getProjectName(project));
    return !excluded.has(projectName);
  });
};

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
      const filteredProjects = filterExcludedProjects(projects);

      if (Array.isArray(projects) && filteredProjects.length !== projects.length) {
        const excludedCount = projects.length - filteredProjects.length;
        console.info(`[fetchProjects] Excluded ${excludedCount} configured project(s)`);
      }

      dispatch(fetchProjectsSuccess(filteredProjects));
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
