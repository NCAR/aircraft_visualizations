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
  variables: []
};
 
function ensureChartConfig(state, chartIndex, page = 'dashboard') {
  const configs = state?.charts?.[page]?.configs;
  if (!configs || !configs[chartIndex]) {
    return { ...DEFAULT_CHART_CONFIG, variables: [], axes: { ...DEFAULT_CHART_CONFIG.axes } };
  }
  return configs[chartIndex];
}

/**
 * Migrate old state structure to new page-based structure
 * @param {Object} state - Current state
 * @returns {Object} Migrated state
 */
function migrateState(state) {
  // If state.charts doesn't have dashboard/realtime namespaces, migrate it
  if (state.charts && !state.charts.dashboard && !state.charts.realtime) {
    console.log('[uiReducer] Migrating old chart state to new page-based structure');
    return {
      ...state,
      charts: {
        dashboard: {
          zoomDomains: state.charts.zoomDomains || {},
          visibleCount: state.charts.visibleCount || 4,
          configs: state.charts.configs || {}
        },
        realtime: {
          zoomDomains: {},
          visibleCount: 4,
          configs: {}
        }
      }
    };
  }
  return state;
}

const initialState = {
  timeline: {
    isPlaying: false,
    progress: 0,
    currentTime: null
  },
  charts: {
    // Separate chart configs for dashboard and realtime pages
    dashboard: {
      zoomDomains: {},  // { [chartIndex]: [startDate, endDate] }
      visibleCount: 4,  // Number of visible charts (1-8)
      configs: {}       // Per-chart customization configs
    },
    realtime: {
      zoomDomains: {},
      visibleCount: 4,
      configs: {}
    }
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
  // Migrate old state structure if needed
  state = migrateState(state);

  switch (action.type) {

        case types.SET_TIMELINE_WINDOW: {
          const { start, end, page = 'dashboard' } = action.payload;
          const pageCharts = state.charts[page] || { zoomDomains: {}, visibleCount: 4, configs: {}, timelineWindow: null };
          return {
            ...state,
            charts: {
              ...state.charts,
              [page]: {
                ...pageCharts,
                timelineWindow: { start, end }
              }
            }
          };
        }
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
    case types.CHART_ZOOM: {
      const { chartIndex, xDomain, yDomain, page = 'dashboard' } = action.payload;
      const pageCharts = state.charts[page] || { zoomDomains: {}, visibleCount: 4, configs: {} };
      return {
        ...state,
        charts: {
          ...state.charts,
          [page]: {
            ...pageCharts,
            zoomDomains: {
              ...pageCharts.zoomDomains,
              [chartIndex]: { x: xDomain, y: yDomain }
            }
          }
        }
      };
    }

    case types.CHART_RESET_ZOOM: {
      const { chartIndex, page = 'dashboard' } = action.payload;
        // Guard against undefined state.charts[page]
        const pageCharts = state.charts[page] || { zoomDomains: {}, visibleCount: 4, configs: {} };
        return {
          ...state,
          charts: {
            ...state.charts,
            [page]: {
              ...pageCharts,
              zoomDomains: {
                ...pageCharts.zoomDomains,
                [chartIndex]: undefined
              }
            }
          }
        };
    }

    case types.SET_VISIBLE_CHART_COUNT: {
      const { count, page = 'dashboard' } = action.payload;
      return {
        ...state,
        charts: {
          ...state.charts,
          [page]: {
            ...state.charts[page],
            visibleCount: count
          }
        }
      };
    }

    // ===============================
    // Customizable Charts Configs
    // ===============================
    case types.ADD_CHART_VARIABLE: {
      const { chartIndex, variableKey, axis, page = 'dashboard' } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex, page);
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
          [page]: {
            ...state.charts[page],
            configs: {
              ...state.charts[page].configs,
              [chartIndex]: { ...prevConfig, variables: nextVars }
            }
          }
        }
      };

      console.log('[uiReducer] ADD_CHART_VARIABLE:', { page, chartIndex, variableKey, axis, nextVars });

      return newState;
    }

    case types.REMOVE_CHART_VARIABLE: {
      const { chartIndex, variableKey, page = 'dashboard' } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex, page);
      const nextVars = prevConfig.variables.filter(v => v.key !== variableKey);
      return {
        ...state,
        charts: {
          ...state.charts,
          [page]: {
            ...state.charts[page],
            configs: {
              ...state.charts[page].configs,
              [chartIndex]: { ...prevConfig, variables: nextVars }
            }
          }
        }
      };
    }

    case types.MOVE_CHART_VARIABLE_AXIS: {
      const { chartIndex, variableKey, axis, page = 'dashboard' } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex, page);
      const nextVars = prevConfig.variables.map(v => v.key === variableKey ? { ...v, axis } : v);
      return {
        ...state,
        charts: {
          ...state.charts,
          [page]: {
            ...state.charts[page],
            configs: {
              ...state.charts[page].configs,
              [chartIndex]: { ...prevConfig, variables: nextVars }
            }
          }
        }
      };
    }

    case types.SET_CHART_AXIS_LABEL: {
      const { chartIndex, axis, label, page = 'dashboard' } = action.payload;
      const prevConfig = ensureChartConfig(state, chartIndex, page);
      const nextAxes = { ...prevConfig.axes, [axis === 'right' ? 'rightLabel' : 'leftLabel']: label };
      return {
        ...state,
        charts: {
          ...state.charts,
          [page]: {
            ...state.charts[page],
            configs: {
              ...state.charts[page].configs,
              [chartIndex]: { ...prevConfig, axes: nextAxes }
            }
          }
        }
      };
    }

    case types.CLEAR_CHART_CONFIG: {
      const { chartIndex, page = 'dashboard' } = action.payload;
      return {
        ...state,
        charts: {
          ...state.charts,
          [page]: {
            ...state.charts[page],
            configs: {
              ...state.charts[page].configs,
              [chartIndex]: { ...DEFAULT_CHART_CONFIG, variables: [], axes: { ...DEFAULT_CHART_CONFIG.axes } }
            }
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
