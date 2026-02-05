/**
 * Selection reducer
 * Manages current user selections (project, flight, chart, variables)
 */

import * as types from '../actions/actionTypes.js';

const initialState = {
  projectName: 'GOTHAAM',
  flightId: null,
  flightNumber: null,
  // Page-specific selected chart index
  selectedChartIndex: {
    dashboard: 0,
    realtime: 0
  },
  // Page-specific selected variables: array of arrays (per chart index)
  selectedVariables: {
    dashboard: [
      ['atx'], ['wic'], ['wdc'], ['dpxc'], ['psxc'], ['tasx'], ['palt'], ['thdg']
    ],
    realtime: [[], [], [], [], [], [], [], []] // 8 charts, empty by default
  }
};

export function selectionReducer(state = initialState, action) {
  switch (action.type) {
    case types.REMOVE_CHART_VARIABLE: {
      const { chartIndex, variableKey, page = 'dashboard' } = action.payload;
      const currentVars = state.selectedVariables[page] || [[], [], [], [], [], [], [], []];
      const chartVars = Array.isArray(currentVars[chartIndex]) ? [...currentVars[chartIndex]] : [];
      const filtered = chartVars.filter(v => v !== variableKey);
      const newVariables = [...currentVars];
      newVariables[chartIndex] = filtered;
      return {
        ...state,
        selectedVariables: {
          ...state.selectedVariables,
          [page]: newVariables
        }
      };
    }

    case types.SELECT_PROJECT:
      return {
        ...state,
        projectName: action.payload.projectName,
        // Reset flight when project changes
        flightId: null,
        flightNumber: null
      };

    case types.SELECT_FLIGHT:
      return {
        ...state,
        flightId: action.payload.flightId,
        flightNumber: action.payload.flightNumber
      };

    case types.SELECT_CHART: {
      const chartPage = action.payload.page || 'dashboard';
      // Handle both old (number) and new (object) formats
      const currentIdx = typeof state.selectedChartIndex === 'number'
        ? { dashboard: state.selectedChartIndex, realtime: 0 }
        : state.selectedChartIndex;
      return {
        ...state,
        selectedChartIndex: {
          ...currentIdx,
          [chartPage]: action.payload.chartIndex
        }
      };
    }

    case types.UPDATE_CHART_VARIABLE: {
      const page = action.payload.page || 'dashboard';
      const currentVars = state.selectedVariables[page] || [[], [], [], [], [], [], [], []];
      const chartVars = Array.isArray(currentVars[action.payload.chartIndex]) ? [...currentVars[action.payload.chartIndex]] : [];
      // Only add if not already present
      if (!chartVars.includes(action.payload.variableCleanName)) {
        chartVars.push(action.payload.variableCleanName);
      }
      const newVariables = [...currentVars];
      newVariables[action.payload.chartIndex] = chartVars;
      return {
        ...state,
        selectedVariables: {
          ...state.selectedVariables,
          [page]: newVariables
        }
      };
    }

    case types.SET_SELECTED_VARIABLES: {
      const targetPage = action.payload.page || 'dashboard';
      // providedVars: array of arrays (per chart index)
      // Replace (not merge) to allow URL restoration to set exact variables
      const providedVars = action.payload.variables || [[], [], [], [], [], [], [], []];
      // Ensure we have 8 chart slots, padding with empty arrays if needed
      const newVariables = [];
      for (let i = 0; i < 8; i++) {
        newVariables[i] = Array.isArray(providedVars[i]) ? [...providedVars[i]] : [];
      }
      return {
        ...state,
        selectedVariables: {
          ...state.selectedVariables,
          [targetPage]: newVariables
        }
      };
    }

    default:
      return state;
  }
}