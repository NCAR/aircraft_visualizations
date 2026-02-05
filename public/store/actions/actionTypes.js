export const SET_TIMELINE_WINDOW = 'SET_TIMELINE_WINDOW';
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
export const SET_SELECTED_VARIABLES = 'SET_SELECTED_VARIABLES';

// ========================================
// Router Actions
// ========================================

export const NAVIGATE = 'NAVIGATE';
export const URL_STATE_RESTORED = 'URL_STATE_RESTORED';

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
export const TIMELINE_SEEK_START = 'TIMELINE_SEEK_START';
export const TIMELINE_SEEK_END = 'TIMELINE_SEEK_END';

// ========================================
// UI - Chart Actions
// ========================================

export const CHART_ZOOM = 'CHART_ZOOM';
export const CHART_RESET_ZOOM = 'CHART_RESET_ZOOM';
export const SET_VISIBLE_CHART_COUNT = 'SET_VISIBLE_CHART_COUNT';

// Chart configuration (customizable plots)
export const ADD_CHART_VARIABLE = 'ADD_CHART_VARIABLE';
export const REMOVE_CHART_VARIABLE = 'REMOVE_CHART_VARIABLE';
export const MOVE_CHART_VARIABLE_AXIS = 'MOVE_CHART_VARIABLE_AXIS';
export const SET_CHART_AXIS_LABEL = 'SET_CHART_AXIS_LABEL';
export const CLEAR_CHART_CONFIG = 'CLEAR_CHART_CONFIG';
export const RESTORE_CHART_CONFIGS = 'RESTORE_CHART_CONFIGS';

// ========================================
// UI - Map Actions
// ========================================

export const MAP_TOGGLE_RADAR = 'MAP_TOGGLE_RADAR';
export const MAP_SET_LAYER_VISIBILITY = 'MAP_SET_LAYER_VISIBILITY';

// ========================================
// Realtime Actions
// ========================================

export const REALTIME_SET_DATABASE = 'REALTIME_SET_DATABASE';
export const REALTIME_FETCH_VARIABLES_REQUEST = 'REALTIME_FETCH_VARIABLES_REQUEST';
export const REALTIME_FETCH_VARIABLES_SUCCESS = 'REALTIME_FETCH_VARIABLES_SUCCESS';
export const REALTIME_FETCH_VARIABLES_FAILURE = 'REALTIME_FETCH_VARIABLES_FAILURE';
export const REALTIME_FETCH_METADATA_SUCCESS = 'REALTIME_FETCH_METADATA_SUCCESS';
export const REALTIME_FETCH_DATA_REQUEST = 'REALTIME_FETCH_DATA_REQUEST';
export const REALTIME_FETCH_DATA_SUCCESS = 'REALTIME_FETCH_DATA_SUCCESS';
export const REALTIME_FETCH_DATA_FAILURE = 'REALTIME_FETCH_DATA_FAILURE';
export const REALTIME_SET_SELECTED_VARIABLES = 'REALTIME_SET_SELECTED_VARIABLES';
export const REALTIME_ADD_VARIABLE = 'REALTIME_ADD_VARIABLE';
export const REALTIME_REMOVE_VARIABLE = 'REALTIME_REMOVE_VARIABLE';
export const REALTIME_SET_AUTO_UPDATE = 'REALTIME_SET_AUTO_UPDATE';
export const REALTIME_CLEAR_DATA = 'REALTIME_CLEAR_DATA';
export const REALTIME_SET_SSE_STATUS = 'REALTIME_SET_SSE_STATUS';
export const REALTIME_SSE_DATA_RECEIVED = 'REALTIME_SSE_DATA_RECEIVED';
