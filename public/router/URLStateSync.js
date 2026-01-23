/**
 * URLStateSync - Bidirectional URL-to-store synchronization
 * Syncs URL query parameters with Redux-like store state
 */

/**
 * Debounce utility function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

export class URLStateSync {
  /**
   * @param {Object} options
   * @param {Object} options.store - Redux-like store instance
   * @param {Object} options.router - Router instance
   * @param {Object} options.actions - Action creators for dispatching
   * @param {number} [options.debounceDelay=300] - Debounce delay for URL updates
   */
  constructor(options) {
    this.store = options.store;
    this.router = options.router;
    this.actions = options.actions || {};
    this.debounceDelay = options.debounceDelay || 300;

    this.unsubscribe = null;
    this.isRestoringFromURL = false;
    this.lastSyncedState = null;

    // Debounced URL update function
    this._debouncedUpdateURL = debounce(
      this._updateURL.bind(this),
      this.debounceDelay
    );
  }

  /**
   * Start synchronization
   */
  init() {
    // Subscribe to store changes
    this.unsubscribe = this.store.subscribe(
      this._onStoreChange.bind(this)
    );

    console.log('[URLStateSync] Initialized');
  }

  /**
   * Restore state from URL query parameters
   * @param {Object} query - Parsed query parameters from router
   * @returns {Promise<void>}
   */
  async restoreFromURL(query) {
    console.log('[URLStateSync] Restoring from URL:', query);

    this.isRestoringFromURL = true;

    try {
      const { project, flight, variables, chart } = query;

      // Restore project if present
      if (project && this.actions.selectProject) {
        this.store.dispatch(this.actions.selectProject(project));

        // Wait for flights to load before selecting flight
        if (flight) {
          await this._waitForFlights(project);
          await this._resolveAndSelectFlight(flight, project);
        }
      }

      // Restore selected variables if present
      if (variables && this.actions.setSelectedVariables) {
        const variableList = variables.split(',').map(v => v.trim());
        this.store.dispatch(this.actions.setSelectedVariables(variableList));
      }

      // Restore selected chart if present
      if (chart !== undefined && this.actions.selectChart) {
        const chartIndex = parseInt(chart, 10);
        if (!isNaN(chartIndex)) {
          this.store.dispatch(this.actions.selectChart(chartIndex));
        }
      }

      // Dispatch restoration complete action if available
      if (this.actions.urlStateRestored) {
        this.store.dispatch(this.actions.urlStateRestored());
      }

    } finally {
      this.isRestoringFromURL = false;
      console.log('[URLStateSync] Restoration complete');
    }
  }

  /**
   * Wait for flights to be loaded for a project
   * @param {string} projectName - Project name
   * @returns {Promise<void>}
   * @private
   */
  _waitForFlights(projectName) {
    return new Promise((resolve) => {
      const checkFlights = () => {
        const state = this.store.getState();
        const flights = state.metadata?.flights?.[projectName];

        if (flights && flights.length > 0) {
          resolve();
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkFlights()) return;

      // Poll for flights
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      const interval = setInterval(() => {
        attempts++;
        if (checkFlights() || attempts >= maxAttempts) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Resolve flight number to flight ID and select it
   * @param {string} flightNumber - Flight number (e.g., 'RF01')
   * @param {string} projectName - Project name
   * @returns {Promise<void>}
   * @private
   */
  async _resolveAndSelectFlight(flightNumber, projectName) {
    const state = this.store.getState();
    const flights = state.metadata?.flights?.[projectName] || [];

    const flight = flights.find(f =>
      f.flight_number.toLowerCase() === flightNumber.toLowerCase()
    );

    if (flight && this.actions.selectFlight) {
      this.store.dispatch(
        this.actions.selectFlight(flight.id, flight.flight_number)
      );
      console.log('[URLStateSync] Resolved flight:', flight.flight_number, 'ID:', flight.id);
    } else {
      console.warn('[URLStateSync] Could not resolve flight:', flightNumber);
    }
  }

  /**
   * Handle store changes - update URL if state changed
   * @private
   */
  _onStoreChange(state) {
    // Don't update URL while we're restoring from URL
    if (this.isRestoringFromURL) return;

    // Only sync on dashboard route (or root)
    const currentPath = this.router.getPath();
    if (currentPath !== '/' && currentPath !== '/dashboard') return;

    // Get relevant state for URL
    const urlState = this._extractURLState(state);

    // Check if state actually changed
    if (this._stateEquals(urlState, this.lastSyncedState)) return;

    this.lastSyncedState = urlState;
    this._debouncedUpdateURL(urlState);
  }

  /**
   * Extract URL-relevant state from store state
   * @param {Object} state - Store state
   * @returns {Object} URL state
   * @private
   */
  _extractURLState(state) {
    const selection = state.selection || {};

    return {
      project: selection.projectName || null,
      flight: selection.flightNumber || null,
      variables: selection.selectedVariables?.join(',') || null,
      chart: selection.selectedChartIndex
    };
  }

  /**
   * Update URL with current state
   * @param {Object} urlState - State to sync to URL
   * @private
   */
  _updateURL(urlState) {
    // Build query object, excluding null/undefined values
    const query = {};

    if (urlState.project) query.project = urlState.project;
    if (urlState.flight) query.flight = urlState.flight;
    if (urlState.variables) query.variables = urlState.variables;
    if (urlState.chart !== undefined && urlState.chart !== null) {
      query.chart = String(urlState.chart);
    }

    // Update URL without adding to history
    this.router.updateQuery(query, false);

    console.log('[URLStateSync] URL updated:', query);
  }

  /**
   * Check if two URL states are equal
   * @param {Object} a - First state
   * @param {Object} b - Second state
   * @returns {boolean} True if equal
   * @private
   */
  _stateEquals(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;

    return (
      a.project === b.project &&
      a.flight === b.flight &&
      a.variables === b.variables &&
      a.chart === b.chart
    );
  }

  /**
   * Force sync current store state to URL
   */
  syncToURL() {
    const state = this.store.getState();
    const urlState = this._extractURLState(state);
    this.lastSyncedState = urlState;
    this._updateURL(urlState);
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

/**
 * Factory function to create URLStateSync
 * @param {Object} options
 * @returns {URLStateSync}
 */
export function createURLStateSync(options) {
  return new URLStateSync(options);
}
