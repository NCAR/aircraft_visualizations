/**
 * UI reducer
 * Manages UI state for timeline, charts, and map
 */

import * as types from '../actions/actionTypes.js';

const initialState = {
  timeline: {
    isPlaying: false,
    progress: 0,
    currentTime: null
  },
  charts: {
    zoomDomains: {}  // { [chartIndex]: [startDate, endDate] }
  },
  map: {
    showRadar: true
  },
  loading: {
    projects: false,
    flights: false,
    flightData: false,
    variables: false
  },
  errors: {
    projects: null,
    flights: null,
    flightData: null,
    variables: null
  }
};

export function uiReducer(state = initialState, action) {
  switch (action.type) {
    // Timeline actions
    case types.TIMELINE_PLAY:
      return {
        ...state,
        timeline: {
          ...state.timeline,
          isPlaying: true
        }
      };

    case types.TIMELINE_PAUSE:
      return {
        ...state,
        timeline: {
          ...state.timeline,
          isPlaying: false
        }
      };

    case types.TIMELINE_SEEK:
      return {
        ...state,
        timeline: {
          ...state.timeline,
          progress: action.payload.progress,
          currentTime: action.payload.currentTime
        }
      };

    case types.TIMELINE_UPDATE_PROGRESS:
      return {
        ...state,
        timeline: {
          ...state.timeline,
          progress: action.payload.progress,
          currentTime: action.payload.currentTime
        }
      };

    // Chart actions
    case types.CHART_ZOOM:
      return {
        ...state,
        charts: {
          ...state.charts,
          zoomDomains: {
            ...state.charts.zoomDomains,
            [action.payload.chartIndex]: action.payload.domain
          }
        }
      };

    case types.CHART_RESET_ZOOM:
      return {
        ...state,
        charts: {
          ...state.charts,
          zoomDomains: {
            ...state.charts.zoomDomains,
            [action.payload.chartIndex]: null
          }
        }
      };

    // Map actions
    case types.MAP_TOGGLE_RADAR:
      return {
        ...state,
        map: {
          ...state.map,
          showRadar: !state.map.showRadar
        }
      };

    // Loading states
    case types.FETCH_PROJECTS_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, projects: true },
        errors: { ...state.errors, projects: null }
      };

    case types.FETCH_PROJECTS_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, projects: false },
        errors: { ...state.errors, projects: null }
      };

    case types.FETCH_PROJECTS_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, projects: false },
        errors: { ...state.errors, projects: action.payload.error }
      };

    case types.FETCH_FLIGHTS_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, flights: true },
        errors: { ...state.errors, flights: null }
      };

    case types.FETCH_FLIGHTS_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, flights: false },
        errors: { ...state.errors, flights: null }
      };

    case types.FETCH_FLIGHTS_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, flights: false },
        errors: { ...state.errors, flights: action.payload.error }
      };

    case types.FETCH_VARIABLES_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, variables: true },
        errors: { ...state.errors, variables: null }
      };

    case types.FETCH_VARIABLES_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, variables: false },
        errors: { ...state.errors, variables: null }
      };

    case types.FETCH_VARIABLES_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, variables: false },
        errors: { ...state.errors, variables: action.payload.error }
      };

    case types.FETCH_FLIGHT_DATA_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, flightData: true },
        errors: { ...state.errors, flightData: null }
      };

    case types.FETCH_FLIGHT_DATA_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, flightData: false },
        errors: { ...state.errors, flightData: null }
      };

    case types.FETCH_FLIGHT_DATA_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, flightData: false },
        errors: { ...state.errors, flightData: action.payload.error }
      };

    default:
      return state;
  }
}
