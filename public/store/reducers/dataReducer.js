/**
 * Data reducer
 * Manages cached flight data (timeseries and track)
 * Implements smart caching to avoid redundant fetches
 */

import * as types from '../actions/actionTypes.js';

const initialState = {
  flightData: {}  // { [flightId]: { timeseries, track, timeRange, loadedVariables } }
};

export function dataReducer(state = initialState, action) {
  switch (action.type) {
    case types.FETCH_FLIGHT_DATA_SUCCESS: {
      const { flightId, timeseries, track, timeRange, variables } = action.payload;

      // Get existing flight data if present
      const existingFlight = state.flightData[flightId] || {};
      const existingVariables = existingFlight.loadedVariables || new Set();

      // Merge new variables with existing
      const updatedVariables = new Set([...existingVariables, ...variables]);

      return {
        ...state,
        flightData: {
          ...state.flightData,
          [flightId]: {
            timeseries: timeseries || existingFlight.timeseries || [],
            track: track || existingFlight.track || [],
            timeRange: timeRange || existingFlight.timeRange || null,
            loadedVariables: updatedVariables
          }
        }
      };
    }

    default:
      return state;
  }
}
