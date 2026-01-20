/**
 * Action type constants
 * Following Redux naming convention: NOUN_VERB pattern
 */

// ========================================
// Metadata Actions
// ========================================

export const FETCH_PROJECTS_REQUEST = 'FETCH_PROJECTS_REQUEST';
export const FETCH_PROJECTS_SUCCESS = 'FETCH_PROJECTS_SUCCESS';
export const FETCH_PROJECTS_FAILURE = 'FETCH_PROJECTS_FAILURE';

export const FETCH_FLIGHTS_REQUEST = 'FETCH_FLIGHTS_REQUEST';
export const FETCH_FLIGHTS_SUCCESS = 'FETCH_FLIGHTS_SUCCESS';
export const FETCH_FLIGHTS_FAILURE = 'FETCH_FLIGHTS_FAILURE';

export const FETCH_VARIABLES_REQUEST = 'FETCH_VARIABLES_REQUEST';
export const FETCH_VARIABLES_SUCCESS = 'FETCH_VARIABLES_SUCCESS';
export const FETCH_VARIABLES_FAILURE = 'FETCH_VARIABLES_FAILURE';

// ========================================
// Selection Actions
// ========================================

export const SELECT_PROJECT = 'SELECT_PROJECT';
export const SELECT_FLIGHT = 'SELECT_FLIGHT';
export const SELECT_CHART = 'SELECT_CHART';
export const UPDATE_CHART_VARIABLE = 'UPDATE_CHART_VARIABLE';

// ========================================
// Data Actions
// ========================================

export const FETCH_FLIGHT_DATA_REQUEST = 'FETCH_FLIGHT_DATA_REQUEST';
export const FETCH_FLIGHT_DATA_SUCCESS = 'FETCH_FLIGHT_DATA_SUCCESS';
export const FETCH_FLIGHT_DATA_FAILURE = 'FETCH_FLIGHT_DATA_FAILURE';

// ========================================
// UI - Timeline Actions
// ========================================

export const TIMELINE_PLAY = 'TIMELINE_PLAY';
export const TIMELINE_PAUSE = 'TIMELINE_PAUSE';
export const TIMELINE_SEEK = 'TIMELINE_SEEK';
export const TIMELINE_UPDATE_PROGRESS = 'TIMELINE_UPDATE_PROGRESS';

// ========================================
// UI - Chart Actions
// ========================================

export const CHART_ZOOM = 'CHART_ZOOM';
export const CHART_RESET_ZOOM = 'CHART_RESET_ZOOM';
export const SET_VISIBLE_CHART_COUNT = 'SET_VISIBLE_CHART_COUNT';

// ========================================
// UI - Map Actions
// ========================================

export const MAP_TOGGLE_RADAR = 'MAP_TOGGLE_RADAR';
export const MAP_SET_LAYER_VISIBILITY = 'MAP_SET_LAYER_VISIBILITY';
