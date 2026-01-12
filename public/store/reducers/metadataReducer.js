/**
 * Metadata reducer
 * Manages projects, flights, and variables metadata
 */

import * as types from '../actions/actionTypes.js';

const initialState = {
  projects: [],
  flights: {},  // { [projectName]: [...flights] }
  variables: []
};

export function metadataReducer(state = initialState, action) {
  switch (action.type) {
    case types.FETCH_PROJECTS_SUCCESS:
      return {
        ...state,
        projects: action.payload.projects
      };

    case types.FETCH_FLIGHTS_SUCCESS:
      return {
        ...state,
        flights: {
          ...state.flights,
          [action.payload.projectName]: action.payload.flights
        }
      };

    case types.FETCH_VARIABLES_SUCCESS:
      return {
        ...state,
        variables: action.payload.variables
      };

    default:
      return state;
  }
}
