/**
 * URLStateSync - Bidirectional URL-to-store synchronization
 * Syncs URL query parameters with Redux-like store state.
 *
 * URL format:
 *   ?project=GOTHAAM&flight=RF01&variables=atx:L|wic:R|wdc:L,dpxc:R|psxc:L&xa=||TEMP|&chart=0
 *
 * Variables use pipe (|) to delimit chart indices, commas for
 * multiple variables in the same chart:
 *   chart0=atx, chart1=wic, chart2=wdc+dpxc, chart3=psxc
 *
 * Axis suffixes: :L = left Y-axis, :R = right Y-axis
 * X-axis variable uses separate 'xa' param (pipe-delimited per chart)
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

      const { project, flight, variables, xa, chart, charts, tw } = query;

      // --- Project ---
      // Only dispatch if the project is actually different to avoid
      // resetting flightId/flightNumber unnecessarily.
      const targetProject = project || currentProject;
      if (project && project !== currentProject && this.actions.selectProject) {
        this.store.dispatch(this.actions.selectProject(project));
        // Also fetch flights for the new project so _waitForFlights can succeed
        if (this.actions.fetchFlightsForProject) {
          this.store.dispatch(this.actions.fetchFlightsForProject(project));
        }
      }

      // --- Variables with axis info ---
      // IMPORTANT: Restore variables BEFORE flight selection so that when
      // flight selection triggers data fetching, it uses the URL-specified
      // variables instead of defaults.
      // URL format: "atx:L|wic:R|wdc:L,dpxc:R"
      // Each pipe-delimited segment = one chart index,
      // commas within a segment = multiple variables on the same chart.
      // :L = left axis, :R = right axis, :X = x-axis (defaults to L if omitted)
      if (variables) {
        try {
          const parsed = this._parseVariablesFromURL(variables);
          console.log('[URLStateSync] Parsed variables from URL:', { raw: variables, parsed });
          if (parsed.length > 0) {
            // IMPORTANT: Order matters here!
            // 1. First dispatch setSelectedVariables (updates selection.selectedVariables
            //    AND ui.charts.configs with axis:'left')
            // 2. Then dispatch restoreChartConfigs (overwrites ui.charts.configs with
            //    correct axis info from URL)

            // Update selectedVariables first (for compatibility with other parts of the system)
            if (this.actions.setSelectedVariables) {
              const keysOnly = parsed.map(chartVars =>
                chartVars.map(v => v.key)
              );
              console.log('[URLStateSync] Dispatching setSelectedVariables:', keysOnly);
              this.store.dispatch(this.actions.setSelectedVariables(keysOnly, 'dashboard'));
            }

            // Parse separate xa (x-axis keys) param
            const xAxisKeys = xa ? this._parseXAxisKeysFromURL(xa) : [];

            // Then restore chart configs with axis info (this overwrites the configs
            // that setSelectedVariables created, preserving correct axis assignments)
            if (this.actions.restoreChartConfigs) {
              console.log('[URLStateSync] Dispatching restoreChartConfigs (with axis info)');
              this.store.dispatch(this.actions.restoreChartConfigs(parsed, 'dashboard', xAxisKeys));
            }

            // Verify state was updated
            const newState = this.store.getState();
            console.log('[URLStateSync] State after variable restoration:', {
              configs: newState.ui?.charts?.dashboard?.configs,
              selectedVars: newState.selection?.selectedVariables?.dashboard
            });
          }
        } catch (err) {
          console.warn('[URLStateSync] Variable restoration failed:', err.message);
        }
      }

      // --- Visible chart count ---
      if (charts !== undefined && this.actions.setVisibleChartCount) {
        const count = parseInt(charts, 10);
        if (!isNaN(count) && count >= 1 && count <= 8) {
          this.store.dispatch(this.actions.setVisibleChartCount(count, 'dashboard'));
        }
      }

      // --- Timeline window ---
      if (tw && this.actions.setTimelineWindow) {
        try {
          const window = this._parseTimelineWindowFromURL(tw);
          console.log('[URLStateSync] Parsed timeline window:', { raw: tw, parsed: window });
          if (window) {
            this.store.dispatch(this.actions.setTimelineWindow(window.start, window.end, 'dashboard'));
            const newState = this.store.getState();
            console.log('[URLStateSync] Timeline window after dispatch:', newState.ui?.charts?.dashboard?.timelineWindow);
          }
        } catch (err) {
          console.warn('[URLStateSync] Timeline window restoration failed:', err.message);
        }
      }

      // --- Chart index ---
      if (chart !== undefined && this.actions.selectChart) {
        const chartIndex = parseInt(chart, 10);
        if (!isNaN(chartIndex) && chartIndex >= 0 && chartIndex < 8) {
          this.store.dispatch(this.actions.selectChart(chartIndex, 'dashboard'));
        }
      }

      // --- Flight ---
      // IMPORTANT: Select flight AFTER variables are restored so that the
      // flight selection triggers data fetching with the correct variables.
      if (flight && flight !== currentFlightNumber && this.actions.selectFlight) {
        try {
          await this._waitForFlights(targetProject);
          await this._resolveAndSelectFlight(flight, targetProject);
        } catch (err) {
          console.warn('[URLStateSync] Flight restoration failed:', err.message);
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
   * Parse a single variable string with optional axis suffix.
   * "atx:L" → { key: 'atx', axis: 'left' }
   * "wic:R" → { key: 'wic', axis: 'right' }
   * "TEMP:X" → { key: 'TEMP', axis: 'x' }  (legacy, kept for backward compat)
   * "dpxc" → { key: 'dpxc', axis: 'left' } (backward compatible)
   * @param {string} varStr
   * @returns {Object|null} { key, axis } or null
   */
  _parseVariable(varStr) {
    const trimmed = varStr.trim();
    if (!trimmed) return null;

    // Check for axis suffix (:L, :R, or :X)
    const match = trimmed.match(/^(.+):([LRX])$/i);
    if (match) {
      const suffix = match[2].toUpperCase();
      const axis = suffix === 'R' ? 'right' : suffix === 'X' ? 'x' : 'left';
      return { key: match[1], axis };
    }
    // Default to left axis (backward compatible)
    return { key: trimmed, axis: 'left' };
  }

  /**
   * Parse variables from URL string into structured format with axis info.
   * "atx:L|wic:R|wdc:L,dpxc:R" →
   * [
   *   [{key: 'atx', axis: 'left'}],
   *   [{key: 'wic', axis: 'right'}],
   *   [{key: 'wdc', axis: 'left'}, {key: 'dpxc', axis: 'right'}]
   * ]
   *
   * Backward compatible: "atx|wic" → all left axis
   * Legacy comma-separated: "atx,wic,wdc" → each on separate chart, left axis
   * @param {string} str
   * @returns {Array<Array<{key: string, axis: string}>>}
   */
  _parseVariablesFromURL(str) {
    if (!str) return [];

    // New pipe-delimited format
    if (str.includes('|')) {
      return str.split('|').map(segment => {
        if (!segment) return [];
        return segment.split(',')
          .map(v => this._parseVariable(v))
          .filter(Boolean);
      });
    }

    // Legacy comma-separated: treat each variable as its own chart
    return str.split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => [this._parseVariable(v)]);
  }

  /**
   * Serialize chart configs to URL string with axis info.
   * Chart configs: { 0: { variables: [{key, axis, color}], xAxisKey } }
   * Result: "atx:L|wic:R|wdc:L,dpxc:R,TEMP:X"
   * @param {Object} chartConfigs - state.ui.charts[page].configs
   * @returns {string|null}
   */
  _serializeVariablesToURL(chartConfigs) {
    if (!chartConfigs || typeof chartConfigs !== 'object') return null;

    // Get chart indices and sort them
    const indices = Object.keys(chartConfigs)
      .map(Number)
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    if (indices.length === 0) return null;

    // Find last non-empty chart to avoid trailing pipes
    let lastNonEmpty = -1;
    for (let i = indices.length - 1; i >= 0; i--) {
      const idx = indices[i];
      const config = chartConfigs[idx];
      const vars = config?.variables;
      const hasVars = Array.isArray(vars) && vars.length > 0;
      const hasXAxis = !!config?.xAxisKey;
      if (hasVars || hasXAxis) {
        lastNonEmpty = idx;
        break;
      }
    }
    if (lastNonEmpty === -1) return null;

    const segments = [];
    for (let i = 0; i <= lastNonEmpty; i++) {
      const config = chartConfigs[i];
      const vars = config?.variables || [];
      const xAxisKey = config?.xAxisKey || null;

      // Format each Y-axis variable with axis suffix
      // X-axis is handled separately via the 'xa' param
      const varStrs = vars.map(v => {
        const axisSuffix = v.axis === 'right' ? ':R' : ':L';
        return `${v.key}${axisSuffix}`;
      });

      segments.push(varStrs.join(','));
    }

    return segments.join('|');
  }

  /**
   * Serialize xAxisKeys from chart configs to a pipe-delimited URL string.
   * Chart configs: { 0: { xAxisKey: null }, 1: { xAxisKey: 'TEMP' }, 2: { xAxisKey: null } }
   * Result: "|TEMP" (trailing empty segments trimmed)
   * Returns null if no charts have an xAxisKey.
   * @param {Object} chartConfigs
   * @returns {string|null}
   */
  _serializeXAxisKeysToURL(chartConfigs) {
    if (!chartConfigs || typeof chartConfigs !== 'object') return null;

    const indices = Object.keys(chartConfigs)
      .map(Number)
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    if (indices.length === 0) return null;

    // Find last chart with an xAxisKey
    let lastWithXAxis = -1;
    for (let i = indices.length - 1; i >= 0; i--) {
      if (chartConfigs[indices[i]]?.xAxisKey) {
        lastWithXAxis = indices[i];
        break;
      }
    }
    if (lastWithXAxis === -1) return null;

    const segments = [];
    for (let i = 0; i <= lastWithXAxis; i++) {
      segments.push(chartConfigs[i]?.xAxisKey || '');
    }
    return segments.join('|');
  }

  /**
   * Parse xAxisKeys from the 'xa' URL parameter.
   * "|TEMP" → [null, 'TEMP']
   * "||dpxc" → [null, null, 'dpxc']
   * @param {string} str
   * @returns {Array<string|null>}
   */
  _parseXAxisKeysFromURL(str) {
    if (!str) return [];
    return str.split('|').map(s => {
      const trimmed = s.trim();
      return trimmed || null;
    });
  }

  // ========================================
  // Timeline Window Serialization
  // ========================================

  /**
   * Parse timeline window from URL string.
   * "0.25-0.75" → { start: 0.25, end: 0.75 }
   * @param {string} str
   * @returns {Object|null} { start, end } or null
   */
  _parseTimelineWindowFromURL(str) {
    if (!str) return null;

    const match = str.match(/^([\d.]+)-([\d.]+)$/);
    if (!match) return null;

    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);

    // Validate: must be 0-1, start < end
    if (isNaN(start) || isNaN(end)) return null;
    if (start < 0 || start > 1 || end < 0 || end > 1) return null;
    if (start >= end) return null;

    return { start, end };
  }

  /**
   * Serialize timeline window to URL string.
   * { start: 0.25, end: 0.75 } → "0.25-0.75"
   * Returns null if full range (0-1) to keep URL clean.
   * @param {Object} window - { start, end }
   * @returns {string|null}
   */
  _serializeTimelineWindowToURL(window) {
    if (!window) return null;

    const { start, end } = window;
    if (start === undefined || end === undefined) return null;

    // Skip if full range (with tolerance)
    if (Math.abs(start - 0) < 0.01 && Math.abs(end - 1) < 0.01) {
      return null;
    }

    // Round to 2 decimal places
    return `${start.toFixed(2)}-${end.toFixed(2)}`;
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
    const page = 'dashboard';

    // Get chart configs (includes axis info)
    const chartConfigs = state.ui?.charts?.[page]?.configs || {};

    // Get timeline window
    const timelineWindow = state.ui?.charts?.[page]?.timelineWindow || null;

    // Get visible chart count
    const visibleCount = state.ui?.charts?.[page]?.visibleCount || 4;

    // Get dashboard chart index
    let chartIndex = selection.selectedChartIndex;
    if (typeof chartIndex === 'object' && chartIndex !== null) {
      chartIndex = chartIndex.dashboard || 0;
    }

    return {
      project: selection.projectName || null,
      flight: selection.flightNumber || null,
      variables: this._serializeVariablesToURL(chartConfigs),
      xa: this._serializeXAxisKeysToURL(chartConfigs),
      chart: chartIndex,
      visibleCount: visibleCount,
      timelineWindow: timelineWindow
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
    if (urlState.xa) query.xa = urlState.xa;
    if (urlState.chart !== undefined && urlState.chart !== null && urlState.chart !== 0) {
      query.chart = String(urlState.chart);
    }

    // Visible chart count (only include if not default 4)
    if (urlState.visibleCount && urlState.visibleCount !== 4) {
      query.charts = String(urlState.visibleCount);
    }

    // Timeline window
    const twStr = this._serializeTimelineWindowToURL(urlState.timelineWindow);
    if (twStr) {
      query.tw = twStr;
    }

    this.router.updateQuery(query, false);
  }

  /**
   * Check if two URL states are equal
   */
  _stateEquals(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;

    // Compare timeline windows
    const twEqual = (
      (a.timelineWindow?.start === b.timelineWindow?.start) &&
      (a.timelineWindow?.end === b.timelineWindow?.end)
    );

    return (
      a.project === b.project &&
      a.flight === b.flight &&
      a.variables === b.variables &&
      a.xa === b.xa &&
      a.chart === b.chart &&
      a.visibleCount === b.visibleCount &&
      twEqual
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
