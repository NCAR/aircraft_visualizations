/**
 * Logger Middleware
 * Logs action types for debugging.
 * Avoids logging full state objects which is extremely expensive
 * when state contains large timeseries arrays.
 */

/**
 * Logger middleware - logs action types only
 */
export const loggerMiddleware = (store) => (next) => (action) => {
  if (typeof action === 'function') {
    return next(action);
  }

  console.log(`%c[Store] ${action.type}`, 'color: #4CAF50;', action.payload || '');
  return next(action);
};

/**
 * Production-safe logger that only logs in development
 */
export const devLoggerMiddleware = (store) => (next) => (action) => {
  const isDevelopment = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';
  if (!isDevelopment) {
    return next(action);
  }

  return loggerMiddleware(store)(next)(action);
};
