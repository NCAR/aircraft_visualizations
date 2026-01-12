/**
 * Logger Middleware
 * Logs actions and state changes for debugging
 * Should be last in middleware chain to log final actions
 */

/**
 * Logger middleware - logs actions and state changes
 * @param {Store} store - Store instance
 * @returns {Function} Middleware function
 */
export const loggerMiddleware = (store) => (next) => (action) => {
  // Skip logging for function actions (thunks)
  if (typeof action === 'function') {
    return next(action);
  }

  console.group(`%c Action: ${action.type}`, 'color: #4CAF50; font-weight: bold;');
  console.log('%c Previous State:', 'color: #9E9E9E; font-weight: bold;', store.getState());
  console.log('%c Action:', 'color: #03A9F4; font-weight: bold;', action);

  const result = next(action);

  console.log('%c Next State:', 'color: #4CAF50; font-weight: bold;', store.getState());
  console.groupEnd();

  return result;
};

/**
 * Production-safe logger that only logs in development
 * @param {Store} store - Store instance
 * @returns {Function} Middleware function
 */
export const devLoggerMiddleware = (store) => (next) => (action) => {
  // Only log in development (when not in production)
  const isDevelopment = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';

  if (!isDevelopment) {
    return next(action);
  }

  return loggerMiddleware(store)(next)(action);
};
