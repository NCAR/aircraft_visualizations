/**
 * Router reducer
 * Manages current route and URL state restoration status
 */

import * as types from '../actions/actionTypes.js';

const initialState = {
  currentPath: '/',
  query: {},
  urlStateRestored: false,
  lastRestoration: null
};

export function routerReducer(state = initialState, action) {
  switch (action.type) {
    case types.UPDATE_ROUTE:
      return {
        ...state,
        currentPath: action.payload.currentPath,
        query: action.payload.query || {}
      };

    case types.NAVIGATE:
      return {
        ...state,
        currentPath: action.payload.path,
        query: action.payload.query || {}
      };

    case types.URL_STATE_RESTORED:
      return {
        ...state,
        urlStateRestored: true,
        lastRestoration: action.payload.timestamp
      };

    default:
      return state;
  }
}
