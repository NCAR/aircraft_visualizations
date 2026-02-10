/**
 * Realtime data reducer
 * Manages real-time flight data state
 */

import * as types from '../actions/actionTypes.js';

const initialState = {
  // Current database selection
  currentDatabase: 'C130', // 'C130' or 'GV'
  availableDatabases: ['C130', 'GV'],

  // Available variables
  variables: [],
  variableMetadata: {},

  // Realtime data
  // Note: Variable selection is now managed in ui.charts.configs
  data: [],
  timeRange: null,
  timeWindow: null, // null = all data, number = minutes (e.g. 5, 30, 60)

  // SSE connection status: 'disconnected' | 'connecting' | 'connected' | 'error'
  sseStatus: 'disconnected',
  lastFetchTime: null,

  // Loading states
  loading: {
    variables: false,
    data: false
  },

  // Errors
  errors: {
    variables: null,
    data: null
  }
};

export function realtimeReducer(state = initialState, action) {
  switch (action.type) {
    case types.REALTIME_SET_DATABASE:
      return {
        ...state,
        currentDatabase: action.payload.database
      };

    case types.REALTIME_FETCH_VARIABLES_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, variables: true },
        errors: { ...state.errors, variables: null }
      };

    case types.REALTIME_FETCH_VARIABLES_SUCCESS:
      return {
        ...state,
        variables: action.payload.variables,
        loading: { ...state.loading, variables: false }
      };

    case types.REALTIME_FETCH_VARIABLES_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, variables: false },
        errors: { ...state.errors, variables: action.payload.error }
      };

    case types.REALTIME_FETCH_METADATA_SUCCESS:
      return {
        ...state,
        variableMetadata: action.payload.metadata
      };

    case types.REALTIME_FETCH_DATA_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, data: true },
        errors: { ...state.errors, data: null }
      };

    case types.REALTIME_FETCH_DATA_SUCCESS:
      // If incremental update, append new data
      const newData = action.payload.isIncremental
        ? [...state.data, ...action.payload.data]
        : action.payload.data;

      return {
        ...state,
        data: newData,
        timeRange: action.payload.timeRange || state.timeRange,
        lastFetchTime: new Date().toISOString(),
        loading: { ...state.loading, data: false }
      };

    case types.REALTIME_FETCH_DATA_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, data: false },
        errors: { ...state.errors, data: action.payload.error }
      };

    case types.REALTIME_SET_AUTO_UPDATE:
      return {
        ...state,
        autoUpdate: action.payload.enabled
      };

    case types.REALTIME_SET_SSE_STATUS:
      return {
        ...state,
        sseStatus: action.payload.status
      };

    case types.REALTIME_SSE_DATA_RECEIVED: {
      // Append new data from SSE stream
      const sseData = [...state.data, ...action.payload.data];
      // Update time range to include new data
      const sseTimeRange = action.payload.timeRange
        ? {
            start: state.timeRange?.start || action.payload.timeRange.start,
            end: action.payload.timeRange.end
          }
        : state.timeRange;

      return {
        ...state,
        data: sseData,
        timeRange: sseTimeRange,
        lastFetchTime: new Date().toISOString()
      };
    }

    case types.REALTIME_SET_TIME_WINDOW:
      return {
        ...state,
        timeWindow: action.payload
      };

    case types.REALTIME_CLEAR_DATA:
      return {
        ...state,
        data: [],
        timeRange: null,
        timeWindow: null,
        lastFetchTime: null,
        sseStatus: 'disconnected'
      };

    default:
      return state;
  }
}
