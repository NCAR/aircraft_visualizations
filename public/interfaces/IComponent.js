/**
 * IComponent - Base interface for all store-connected components
 * Provides store integration, subscription management, and lifecycle methods
 */

export class IComponent {
  /**
   * @param {Store} store - Store instance
   * @param {string|null} pageContext - Optional page context ('dashboard' or 'realtime')
   */
  constructor(store, pageContext = null) {
    if (!store) {
      throw new Error('Store is required for IComponent');
    }
    this.store = store;
    this.pageContext = pageContext;
    this.unsubscribe = null;
  }

  /**
   * Get page context for this component
   * @returns {string|null} Page context ('dashboard', 'realtime', or null)
   */
  getPageContext() {
    return this.pageContext;
  }

  /**
   * Subscribe to store changes
   * Subclasses should call this in constructor after initialization
   */
  connect() {
    if (this.unsubscribe) {
      console.warn('[IComponent] Already connected to store');
      return;
    }
    this.unsubscribe = this.store.subscribe(this.onStateChange.bind(this));
    console.log(`[${this.constructor.name}] Connected to store`);
  }

  /**
   * Unsubscribe from store
   */
  disconnect() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log(`[${this.constructor.name}] Disconnected from store`);
    }
  }

  /**
   * Called when store state changes
   * MUST be implemented by subclass
   * @param {Object} state - New state
   */
  onStateChange(state) {
    throw new Error(`${this.constructor.name} must implement onStateChange(state)`);
  }

  /**
   * Dispatch action to store
   * @param {Object|Function} action - Action object or thunk
   * @returns {*} Result of dispatch
   */
  dispatch(action) {
    return this.store.dispatch(action);
  }

  /**
   * Get current state from store
   * @returns {Object} Current state
   */
  getState() {
    return this.store.getState();
  }

  /**
   * Cleanup component
   * Subclasses should override and call super.destroy()
   */
  destroy() {
    this.disconnect();
  }
}
