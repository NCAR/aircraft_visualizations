/**
 * Root reducer
 * Combines all reducers into a single reducer function
 */

import { metadataReducer } from './metadataReducer.js';
import { selectionReducer } from './selectionReducer.js';
import { dataReducer } from './dataReducer.js';
import { uiReducer } from './uiReducer.js';
import { routerReducer } from './routerReducer.js';

/**
 * Combine multiple reducers into one
 * @param {Object} reducers - Object mapping state keys to reducer functions
 * @returns {Function} Combined reducer function
 */
export function combineReducers(reducers) {
  return (state = {}, action) => {
    const nextState = {};
    let hasChanged = false;

    Object.keys(reducers).forEach(key => {
      const previousStateForKey = state[key];
      const nextStateForKey = reducers[key](previousStateForKey, action);
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    });

    return hasChanged ? nextState : state;
  };
}

/**
 * Root reducer combining all domain reducers
 */
export const rootReducer = combineReducers({
  metadata: metadataReducer,
  selection: selectionReducer,
  data: dataReducer,
  ui: uiReducer,
  router: routerReducer
});
