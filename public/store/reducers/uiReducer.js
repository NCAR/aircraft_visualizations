/**
 * UI reducer
 * Manages UI state for timeline, charts, and map
 */

import * as types from '../actions/actionTypes.js';
import { getLineColor } from '../../modules/shared/constants.js';

/**
 * Default chart configuration structure
 * Used when initializing or resetting chart configs
 * Variables structure: { key: string, axis: 'left'|'right', color: string }
 */
export const DEFAULT_CHART_CONFIG = {
  variables: [],
  axes: {
    leftLabel: null,
    rightLabel: null
  }
};

/**
 * Ensures a chart config exists for the given index
 * Returns existing config or default if not present
 * @param {Object} state - Current UI state
 * @param {number} chartIndex - Chart index to get config for
 * @returns {Object} Chart configuration
 */
function ensureChartConfig(state, chartIndex) {
  const configs = state?.charts?.configs;
  if (!configs || !configs[chartIndex]) {
    return { ...DEFAULT_CHART_CONFIG, variables: [], axes: { ...DEFAULT_CHART_CONFIG.axes } };
  }
  return configs[chartIndex];
}

const initialState = {
  timeline: {
    isPlaying: false,
    progress: 0,
    currentTime: null
  },
  charts: {
    zoomDomains: {},  // { [chartIndex]: [startDate, endDate] }
    visibleCount: 4,  // Number of visible charts (1-8)
    configs: {}       // Per-chart customization configs
  },
  map: {
    showRadar: true,
    layers: {
      glm: false,
      mrms: false,
      goesVisible: false,
      goesIR: false,
      nexrad: true
    }
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

    case types.SET_VISIBLE_CHART_COUNT:
      return {
        ...state,
        charts: {
          ...state.charts,
          visibleCount: action.payload.count
        }
      };

    // ===============================
    // Customizable Charts Configs
    // ===============================
    case types.ADD_CHART_VARIABLE: {
      const { chartIndex, variableKey, axis } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex);
      const existingIndex = prevConfig.variables.findIndex(v => v.key === variableKey);

      let nextVars;
      if (existingIndex >= 0) {
        // Variable exists - update axis but keep existing color
        nextVars = prevConfig.variables.map(v =>
          v.key === variableKey ? { ...v, axis } : v
        );
      } else {
        // New variable - assign color based on its position
        const newIndex = prevConfig.variables.length;
        const color = getLineColor(newIndex);
        nextVars = [...prevConfig.variables, { key: variableKey, axis, color }];
      }

      const newState = {
        ...state,
        charts: {
          ...state.charts,
          configs: {
            ...state.charts.configs,
            [chartIndex]: { ...prevConfig, variables: nextVars }
          }
        }
      };

      console.log('[uiReducer] ADD_CHART_VARIABLE:', { chartIndex, variableKey, axis, nextVars, newConfigs: newState.charts.configs });

      return newState;
    }

    case types.REMOVE_CHART_VARIABLE: {
      const { chartIndex, variableKey } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex);
      const nextVars = prevConfig.variables.filter(v => v.key !== variableKey);
      return {
        ...state,
        charts: {
          ...state.charts,
          configs: {
            ...state.charts.configs,
            [chartIndex]: { ...prevConfig, variables: nextVars }
          }
        }
      };
    }

    case types.MOVE_CHART_VARIABLE_AXIS: {
      const { chartIndex, variableKey, axis } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex);
      const nextVars = prevConfig.variables.map(v => v.key === variableKey ? { ...v, axis } : v);
      return {
        ...state,
        charts: {
          ...state.charts,
          configs: {
            ...state.charts.configs,
            [chartIndex]: { ...prevConfig, variables: nextVars }
          }
        }
      };
    }

    case types.SET_CHART_AXIS_LABEL: {
      const { chartIndex, axis, label } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex);
      const nextAxes = { ...prevConfig.axes, [axis === 'right' ? 'rightLabel' : 'leftLabel']: label };
      return {
        ...state,
        charts: {
          ...state.charts,
          configs: {
            ...state.charts.configs,
            [chartIndex]: { ...prevConfig, axes: nextAxes }
          }
        }
      };
    }

    case types.CLEAR_CHART_CONFIG: {
      const { chartIndex } = action.payload;
      return {
        ...state,
        charts: {
          ...state.charts,
          configs: {
            ...state.charts.configs,
            [chartIndex]: { ...DEFAULT_CHART_CONFIG, variables: [], axes: { ...DEFAULT_CHART_CONFIG.axes } }
          }
        }
      };
    }

    // Map actions
    case types.MAP_TOGGLE_RADAR:
      return {
        ...state,
        map: {
          ...state.map,
          showRadar: !state.map.showRadar
        }
      };

    case types.MAP_SET_LAYER_VISIBILITY:
      return {
        ...state,
        map: {
          ...state.map,
          layers: {
            ...state.map.layers,
            [action.payload.layerId]: action.payload.visible
          }
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
