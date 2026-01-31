/**
 * Core Store class for state management
 * Implements a Redux-like pattern with subscribe/dispatch
 */
export class Store {
  constructor(rootReducer, initialState = {}, middleware = []) {
    this.state = initialState;
    this.reducer = rootReducer;
    this.listeners = new Set();
    this.middleware = middleware;
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Dispatch an action to update state
   * @param {Object|Function} action - Action object or thunk function
   * @returns {*} Result of dispatch
   */
  dispatch(action) {
    // Apply middleware chain
    let dispatch = this._dispatchToReducer.bind(this);

    // Middleware is applied in reverse order so first middleware wraps inner dispatches
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      dispatch = this.middleware[i](this)(dispatch);
    }

    return dispatch(action);
  }

  /**
   * Internal method to dispatch to reducer
   * @private
   */
  _dispatchToReducer(action) {
    const prevState = this.state;
    this.state = this.reducer(this.state, action);

    // Only notify if state actually changed
    if (this.state !== prevState) {
      this.notify();
    }

    return action;
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function called when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    this.listeners.add(listener);

    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   * @private
   */
  notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[Store] Listener error:', error);
      }
    });
  }
}
