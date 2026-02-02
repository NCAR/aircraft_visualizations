/**
 * URLStateSync - Bidirectional URL-to-store synchronization
 * Syncs URL query parameters with Redux-like store state.
 *
 * URL format:
 *   ?project=GOTHAAM&flight=RF01&variables=atx|wic|wdc,dpxc|psxc&chart=0
 *
 * Variables use pipe (|) to delimit chart indices, commas for
 * multiple variables in the same chart:
 *   chart0=atx, chart1=wic, chart2=wdc+dpxc, chart3=psxc
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

    this._debouncedUpdateURL = debounce(
      this._updateURL.bind(this),
      this.debounceDelay
    );
  }

  /**
   * Start synchronization
   */
  init() {
    this.unsubscribe = this.store.subscribe(
      this._onStoreChange.bind(this)
    );
    console.log('[URLStateSync] Initialized');
  }

  /**
   * Restore state from URL query parameters.
   * Only dispatches actions for values that differ from current state
   * to avoid unnecessary resets (e.g., selectProject resets flightId).
   * @param {Object} query - Parsed query parameters from router
   */
  async restoreFromURL(query) {
    if (!query || Object.keys(query).length === 0) return;

    console.log('[URLStateSync] Restoring from URL:', query);
    this.isRestoringFromURL = true;

    try {
      const state = this.store.getState();
      const currentProject = state.selection?.projectName;
      const currentFlightNumber = state.selection?.flightNumber;

      const { project, flight, variables, chart } = query;

      // --- Project ---
      // Only dispatch if the project is actually different to avoid
      // resetting flightId/flightNumber unnecessarily.
      const targetProject = project || currentProject;
      if (project && project !== currentProject && this.actions.selectProject) {
        this.store.dispatch(this.actions.selectProject(project));
      }

      // --- Flight ---
      if (flight && flight !== currentFlightNumber && this.actions.selectFlight) {
        try {
          await this._waitForFlights(targetProject);
          await this._resolveAndSelectFlight(flight, targetProject);
        } catch (err) {
          console.warn('[URLStateSync] Flight restoration failed:', err.message);
        }
      }

      // --- Variables ---
      // URL format: "atx|wic|wdc,dpxc|psxc"
      // Each pipe-delimited segment = one chart index,
      // commas within a segment = multiple variables on the same chart.
      if (variables && this.actions.setSelectedVariables) {
        try {
          const parsed = this._parseVariablesFromURL(variables);
          if (parsed.length > 0) {
            this.store.dispatch(this.actions.setSelectedVariables(parsed, 'dashboard'));
          }
        } catch (err) {
          console.warn('[URLStateSync] Variable restoration failed:', err.message);
        }
      }

      // --- Chart index ---
      if (chart !== undefined && this.actions.selectChart) {
        const chartIndex = parseInt(chart, 10);
        if (!isNaN(chartIndex) && chartIndex >= 0 && chartIndex < 8) {
          this.store.dispatch(this.actions.selectChart(chartIndex, 'dashboard'));
        }
      }

      if (this.actions.urlStateRestored) {
        this.store.dispatch(this.actions.urlStateRestored());
      }
    } catch (err) {
      console.error('[URLStateSync] Restoration error:', err);
    } finally {
      this.isRestoringFromURL = false;
      console.log('[URLStateSync] Restoration complete');
    }
  }

  // ========================================
  // URL Variable Serialization
  // ========================================

  /**
   * Parse variables from URL string into array-of-arrays.
   * "atx|wic|wdc,dpxc|psxc" → [['atx'], ['wic'], ['wdc','dpxc'], ['psxc']]
   *
   * Falls back to treating plain comma-separated values as one-per-chart
   * for backwards compatibility: "atx,wic,wdc" → [['atx'], ['wic'], ['wdc']]
   * @param {string} str
   * @returns {Array<Array<string>>}
   */
  _parseVariablesFromURL(str) {
    if (!str) return [];

    // New pipe-delimited format
    if (str.includes('|')) {
      return str.split('|').map(segment =>
        segment ? segment.split(',').map(v => v.trim()).filter(Boolean) : []
      );
    }

    // Legacy comma-separated: treat each variable as its own chart
    return str.split(',').map(v => v.trim()).filter(Boolean).map(v => [v]);
  }

  /**
   * Serialize array-of-arrays of variables to URL string.
   * [['atx'], ['wic'], ['wdc','dpxc']] → "atx|wic|wdc,dpxc"
   * Trailing empty charts are trimmed.
   * @param {Array} varsArray - array-of-arrays
   * @returns {string|null}
   */
  _serializeVariablesToURL(varsArray) {
    if (!Array.isArray(varsArray) || varsArray.length === 0) return null;

    // Find last non-empty chart to avoid trailing pipes
    let lastNonEmpty = -1;
    for (let i = varsArray.length - 1; i >= 0; i--) {
      const v = varsArray[i];
      if (Array.isArray(v) && v.length > 0) {
        lastNonEmpty = i;
        break;
      }
    }
    if (lastNonEmpty === -1) return null;

    const segments = [];
    for (let i = 0; i <= lastNonEmpty; i++) {
      const v = varsArray[i];
      segments.push(Array.isArray(v) ? v.join(',') : '');
    }
    return segments.join('|');
  }

  // ========================================
  // Flight Resolution
  // ========================================

  /**
   * Wait for flights to be loaded for a project.
   * Uses a store subscription for reliability instead of polling.
   * @param {string} projectName
   * @returns {Promise<void>}
   */
  _waitForFlights(projectName) {
    return new Promise((resolve, reject) => {
      // Check immediately
      const flights = this.store.getState().metadata?.flights?.[projectName];
      if (flights && flights.length > 0) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        unsub();
        // Resolve anyway so the rest of restoration can proceed
        console.warn('[URLStateSync] Timed out waiting for flights, continuing without flight');
        resolve();
      }, 8000);

      const unsub = this.store.subscribe((state) => {
        const f = state.metadata?.flights?.[projectName];
        if (f && f.length > 0) {
          clearTimeout(timeout);
          unsub();
          resolve();
        }
      });
    });
  }

  /**
   * Resolve flight number to flight ID and select it.
   * Tries case-insensitive match first, then partial match as fallback.
   * @param {string} flightNumber - e.g. 'RF01'
   * @param {string} projectName
   */
  async _resolveAndSelectFlight(flightNumber, projectName) {
    const flights = this.store.getState().metadata?.flights?.[projectName] || [];

    if (flights.length === 0) {
      console.warn('[URLStateSync] No flights available for project:', projectName);
      return;
    }

    // Exact match (case-insensitive)
    let flight = flights.find(f =>
      f.flight_number.toLowerCase() === flightNumber.toLowerCase()
    );

    // Fallback: partial match (e.g. "01" matches "RF01")
    if (!flight) {
      flight = flights.find(f =>
        f.flight_number.toLowerCase().includes(flightNumber.toLowerCase())
      );
    }

    if (flight && this.actions.selectFlight) {
      this.store.dispatch(
        this.actions.selectFlight(flight.id, flight.flight_number)
      );
      console.log('[URLStateSync] Resolved flight:', flight.flight_number, 'ID:', flight.id);
    } else {
      console.warn('[URLStateSync] Could not resolve flight:', flightNumber,
        'Available:', flights.map(f => f.flight_number).join(', '));
    }
  }

  // ========================================
  // Store → URL
  // ========================================

  /**
   * Handle store changes - update URL if state changed
   */
  _onStoreChange(state) {
    if (this.isRestoringFromURL) return;

    const currentPath = this.router.getPath();
    if (currentPath !== '/' && currentPath !== '/dashboard') return;

    const urlState = this._extractURLState(state);

    if (this._stateEquals(urlState, this.lastSyncedState)) return;

    this.lastSyncedState = urlState;
    this._debouncedUpdateURL(urlState);
  }

  /**
   * Extract URL-relevant state from store state
   */
  _extractURLState(state) {
    const selection = state.selection || {};

    // Get dashboard variables (array-of-arrays)
    let dashVars = selection.selectedVariables;
    if (dashVars && typeof dashVars === 'object' && !Array.isArray(dashVars)) {
      dashVars = dashVars.dashboard || [];
    }

    // Get dashboard chart index
    let chartIndex = selection.selectedChartIndex;
    if (typeof chartIndex === 'object' && chartIndex !== null) {
      chartIndex = chartIndex.dashboard || 0;
    }

    return {
      project: selection.projectName || null,
      flight: selection.flightNumber || null,
      variables: this._serializeVariablesToURL(dashVars),
      chart: chartIndex
    };
  }

  /**
   * Update URL with current state
   */
  _updateURL(urlState) {
    const query = {};

    if (urlState.project) query.project = urlState.project;
    if (urlState.flight) query.flight = urlState.flight;
    if (urlState.variables) query.variables = urlState.variables;
    if (urlState.chart !== undefined && urlState.chart !== null && urlState.chart !== 0) {
      query.chart = String(urlState.chart);
    }

    this.router.updateQuery(query, false);
  }

  /**
   * Check if two URL states are equal
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
 */
export function createURLStateSync(options) {
  return new URLStateSync(options);
}
