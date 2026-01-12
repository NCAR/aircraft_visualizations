/**
 * API Middleware
 * Handles async actions (thunks) for API calls
 */

/**
 * Thunk middleware - allows action creators to return functions
 * instead of action objects for async operations
 *
 * Usage:
 *   dispatch((dispatch, getState) => {
 *     // Can make async calls here
 *     fetch('/api/data').then(data => {
 *       dispatch({ type: 'SUCCESS', payload: data });
 *     });
 *   });
 *
 * @param {Store} store - Store instance
 * @returns {Function} Middleware function
 */
export const thunkMiddleware = (store) => (next) => (action) => {
  // If action is a function (thunk), call it with dispatch and getState
  // IMPORTANT: Bind dispatch and getState to store to preserve 'this' context
  if (typeof action === 'function') {
    return action(store.dispatch.bind(store), store.getState.bind(store));
  }

  // Otherwise, pass the action along
  return next(action);
};
