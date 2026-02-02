import { Store } from './Store.js';

/**
 * Factory function to create a store instance
 * @param {Function} rootReducer - Root reducer function
 * @param {Object} initialState - Initial state object
 * @param {Array} middleware - Array of middleware functions
 * @returns {Store} Store instance
 */
export function createStore(rootReducer, initialState = {}, middleware = []) {
  if (typeof rootReducer !== 'function') {
    throw new Error('Root reducer must be a function');
  }

  return new Store(rootReducer, initialState, middleware);
}
