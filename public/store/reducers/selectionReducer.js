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
  // Page-specific selected variables
  selectedVariables: {
    dashboard: ['atx', 'wic', 'wdc', 'dpxc', 'psxc', 'tasx', 'palt', 'thdg'],  // Default variables for 8 charts
    realtime: []  // Will be populated when realtime variables are fetched
  }
};

export function selectionReducer(state = initialState, action) {
  switch (action.type) {
    case types.REMOVE_CHART_VARIABLE: {
      const { chartIndex, variableKey, page = 'dashboard' } = action.payload;
      const currentVars = state.selectedVariables[page] || [];
      // Remove variable at chartIndex if it matches variableKey
      const newVariables = [...currentVars];
      if (newVariables[chartIndex] === variableKey) {
        newVariables[chartIndex] = null;
      }
      return {
        ...state,
        selectedVariables: {
          ...state.selectedVariables,
          [page]: newVariables
        }
      };
    }
  }
  switch (action.type) {
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

    case types.UPDATE_CHART_VARIABLE:
      const page = action.payload.page || 'dashboard';
      const currentVars = state.selectedVariables[page] || [];
      const newVariables = [...currentVars];
      newVariables[action.payload.chartIndex] = action.payload.variableCleanName;
      return {
        ...state,
        selectedVariables: {
          ...state.selectedVariables,
          [page]: newVariables
        }
      };

    case types.SET_SELECTED_VARIABLES:
      const targetPage = action.payload.page || 'dashboard';
      // Merge provided variables with existing ones (to preserve unspecified slots)
      const providedVars = action.payload.variables || [];
      const existingVars = state.selectedVariables[targetPage] || [];
      const mergedVariables = [...existingVars];
      providedVars.forEach((varName, index) => {
        if (varName && index < mergedVariables.length) {
          mergedVariables[index] = varName;
        } else if (varName) {
          mergedVariables[index] = varName;
        }
      });
      return {
        ...state,
        selectedVariables: {
          ...state.selectedVariables,
          [targetPage]: mergedVariables
        }
      };

    default:
      return state;
  }
}