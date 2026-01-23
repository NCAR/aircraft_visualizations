/**
 * Selection reducer
 * Manages current user selections (project, flight, chart, variables)
 */

import * as types from '../actions/actionTypes.js';

const initialState = {
  projectName: 'GOTHAAM',
  flightId: null,
  flightNumber: null,
  selectedChartIndex: 0,
  selectedVariables: ['atx', 'wic', 'wdc', 'dpxc', 'psxc', 'tasx', 'palt','thdg']  // Default variables for 8 charts
};

export function selectionReducer(state = initialState, action) {
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

    case types.SELECT_CHART:
      return {
        ...state,
        selectedChartIndex: action.payload.chartIndex
      };

    case types.UPDATE_CHART_VARIABLE:
      const newVariables = [...state.selectedVariables];
      newVariables[action.payload.chartIndex] = action.payload.variableCleanName;
      return {
        ...state,
        selectedVariables: newVariables
      };

    case types.SET_SELECTED_VARIABLES:
      // Merge provided variables with existing ones (to preserve unspecified slots)
      const providedVars = action.payload.variables || [];
      const mergedVariables = [...state.selectedVariables];
      providedVars.forEach((varName, index) => {
        if (varName && index < mergedVariables.length) {
          mergedVariables[index] = varName;
        }
      });
      return {
        ...state,
        selectedVariables: mergedVariables
      };

    default:
      return state;
  }
}
