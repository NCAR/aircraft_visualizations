/**
 * RealtimePage.js - SPA Page Module
 * Real-time flight data visualization with Redux state management
 */

// Import realtime actions
import {
  fetchRealtimeVariables,
  fetchRealtimeData,
  switchRealtimeDatabase,
  setSSEConnectionStatus,
  processSSEData,
  clearRealtimeData,
  setRealtimeTimeWindow
} from '../store/actions/realtimeActions.js';

// Import UI actions for chart management
import { setVisibleChartCount, addChartVariable } from '../store/actions/uiActions.js';
import * as types from '../store/actions/actionTypes.js';
import { SET_SELECTED_VARIABLES } from '../store/actions/actionTypes.js';
import { getPageVariables } from '../store/selectors/selectors.js';

// Import store-connected components
import ChartContainerManager from '../modules/ChartContainerManager.js';
import FlightMapStore from '../modules/FlightMapStore.js';
import SettingsOverlay from '../modules/components/SettingsOverlay.js';

// ========================================
// Initialize Page
// ========================================

/**
 * Initialize the Realtime page
 * @param {Object} store - Redux-like store instance
 * @param {Object} context - Context from PageManager
 * @returns {Object} Page instance with destroy method
 */
export async function init(store, context = {}) {
  console.log('[RealtimePage] Initializing');

  // Page context constant for proper state isolation
  const PAGE_CONTEXT = 'realtime';

  const components = {};
  const subscriptions = [];
  const eventListeners = [];
  let eventSource = null;
  let destroyed = false;

  // State tracking for database switching
  let lastDataLength = 0;
  let lastVariables = null;

  // Clear any existing realtime chart configs BEFORE creating charts
  // (in case of persisted state or previous navigation with dashboard variables)
  // IMPORTANT: Dispatch directly with page='realtime' to avoid router timing issues
  console.log('[RealtimePage] Clearing existing realtime chart configs before initialization');
  for (let i = 0; i < 8; i++) {
    store.dispatch({
      type: types.CLEAR_CHART_CONFIG,
      payload: { chartIndex: i, page: 'realtime' }
    });
  }

  // IMPORTANT: Fetch realtime variables BEFORE initializing chart manager
  // This ensures charts don't try to use dashboard variables
  console.log('[RealtimePage] Pre-fetching realtime variables before chart initialization');
  const urlDb = context.query?.db;
  if (urlDb && ['C130', 'GV'].includes(urlDb)) {
    await store.dispatch(switchRealtimeDatabase(urlDb));
  } else {
    await store.dispatch(fetchRealtimeVariables());
  }

  // ========================================
  // Set up chart variables BEFORE creating ChartContainerManager
  // This ensures getChartConfigs returns the correct charts to create
  // ========================================
  const initialState = store.getState();
  setInitialRealtimeVariables(store, initialState);
  const rtVars = initialState.realtime?.variables || [];
  if (rtVars.length > 0) {
    console.log('[RealtimePage] Setting up initial chart variables:', rtVars.slice(0, 4));
    store.dispatch(setVisibleChartCount(4, PAGE_CONTEXT));
    rtVars.slice(0, 4).forEach((variable, chartIndex) => {
      store.dispatch(addChartVariable(chartIndex, variable, 'left', PAGE_CONTEXT));
    });
    // Record that we've already handled these variables so the
    // subscription doesn't redundantly clear and re-populate
    lastVariables = initialState.realtime.variables;
  }

  // ========================================
  // Initialize Chart Container (multi-chart)
  // ========================================

  components.chartManager = new ChartContainerManager('#realtime-chart-container', store, PAGE_CONTEXT);

  // ========================================
  // Initialize Map (store-connected)
  // ========================================

  components.map = new FlightMapStore('realtime-map', store, PAGE_CONTEXT);

  // ========================================
  // Initialize Settings Overlay (shared)
  // ========================================

  components.settingsOverlay = new SettingsOverlay(store, PAGE_CONTEXT);

  // ========================================
  // Database Toggle
  // ========================================

  const dbToggle = document.getElementById('database-toggle');
  if (dbToggle) {
    const buttons = dbToggle.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
      const handler = async () => {
        const db = btn.dataset.db;
        console.log('[RealtimePage] Switching to database:', db);

        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Clear existing chart configs for realtime page.
        // The store subscription will re-populate when new variables arrive.
        for (let i = 0; i < 8; i++) {
          store.dispatch({
            type: types.CLEAR_CHART_CONFIG,
            payload: { chartIndex: i, page: PAGE_CONTEXT }
          });
        }

        // Switch database (this will fetch new variables, triggering re-population)
        await store.dispatch(switchRealtimeDatabase(db));

        // Reconnect SSE to new database
        connectSSE(db);
      };
      btn.addEventListener('click', handler);
      eventListeners.push({ element: btn, event: 'click', handler });
    });
  }

  // ========================================
  // Variable Management
  // Note: Variables are now managed through SettingsOverlay
  // using the unified ui.charts.configs Redux state
  // ========================================

  // ========================================
  // Fetch Data Button
  // ========================================

  const fetchDataBtn = document.getElementById('fetch-data-btn');
  if (fetchDataBtn) {
    const handler = () => {
      store.dispatch(fetchRealtimeData());
    };
    fetchDataBtn.addEventListener('click', handler);
    eventListeners.push({ element: fetchDataBtn, event: 'click', handler });
  }

  // ========================================
  // Reset Zoom Button
  // ========================================

  const resetZoomBtn = document.getElementById('reset-zoom-btn');
  if (resetZoomBtn) {
    const handler = () => {
      store.dispatch({ type: 'CHART_RESET_ZOOM_ALL' });
    };
    resetZoomBtn.addEventListener('click', handler);
    eventListeners.push({ element: resetZoomBtn, event: 'click', handler });
  }

  // ========================================
  // Settings Buttons for Chart and Map
  // ========================================

  const chartSettingsBtn = document.getElementById('realtime-chart-settings-btn');
  if (chartSettingsBtn) {
    const handler = () => {
      if (components.settingsOverlay) {
        components.settingsOverlay.open();
      }
    };
    chartSettingsBtn.addEventListener('click', handler);
    eventListeners.push({ element: chartSettingsBtn, event: 'click', handler });
  }

  // ========================================
  // Time Window Toggle
  // ========================================

  const timeWindowToggle = document.getElementById('time-window-toggle');
  if (timeWindowToggle) {
    const handler = (e) => {
      const btn = e.target.closest('.time-window-btn');
      if (!btn) return;
      const value = btn.dataset.window;
      const minutes = value === 'all' ? null : parseInt(value, 10);
      store.dispatch(setRealtimeTimeWindow(minutes));
      timeWindowToggle.querySelectorAll('.time-window-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    timeWindowToggle.addEventListener('click', handler);
    eventListeners.push({ element: timeWindowToggle, event: 'click', handler });
  }

  const mapSettingsBtn = document.getElementById('realtime-map-settings-btn');
  if (mapSettingsBtn) {
    const handler = () => {
      if (components.settingsOverlay) {
        components.settingsOverlay.switchTab?.('map');
        components.settingsOverlay.open();
      }
    };
    mapSettingsBtn.addEventListener('click', handler);
    eventListeners.push({ element: mapSettingsBtn, event: 'click', handler });
  }

  // ========================================
  // SSE Connection Setup
  // ========================================

  /**
   * Connect to SSE stream for realtime updates
   * @param {string} database - Database key ('C130' or 'GV')
   */
  function connectSSE(database) {
    // Close existing connection if any
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    const state = store.getState();
    const chartConfigs = state.ui?.charts?.realtime?.configs || {};
    const vars = new Set(['gglat', 'gglon', 'thdg']); // Always include position vars

    // Collect variables from chart configs
    Object.values(chartConfigs).forEach(config => {
      if (config?.variables) {
        config.variables.forEach(v => vars.add(v.key));
      }
    });

    const varsParam = Array.from(vars).join(',');
    const url = `/api/realtime/stream?db=${database}&vars=${varsParam}`;

    console.log('[RealtimePage] Connecting to SSE stream:', url);
    store.dispatch(setSSEConnectionStatus('connecting'));

    eventSource = new EventSource(url);

    eventSource.addEventListener('connected', (e) => {
      if (destroyed) return;
      const data = JSON.parse(e.data);
      console.log('[RealtimePage] SSE connected:', data);
      store.dispatch(setSSEConnectionStatus('connected'));
    });

    eventSource.addEventListener('data', (e) => {
      if (destroyed) return;
      try {
        const data = JSON.parse(e.data);
        if (data && data.length > 0) {
          store.dispatch(processSSEData(data));
        }
      } catch (err) {
        console.error('[RealtimePage] Error parsing SSE data:', err);
      }
    });

    eventSource.onerror = (err) => {
      if (destroyed) return;
      console.error('[RealtimePage] SSE error:', err);
      store.dispatch(setSSEConnectionStatus('error'));

      // EventSource will automatically reconnect, but update status
      if (eventSource.readyState === EventSource.CONNECTING) {
        store.dispatch(setSSEConnectionStatus('connecting'));
      }
    };
  }

  // ========================================
  // Store Subscription for UI Updates
  // ========================================

  const storeSub = store.subscribe((state) => {
    if (destroyed) return;
    const rtState = state.realtime;
    if (!rtState) return;

    // When variables change (database switch), re-populate chart configs.
    // Initial load is handled above before ChartContainerManager creation.
    if (rtState.variables !== lastVariables && rtState.variables.length > 0) {
      lastVariables = rtState.variables;

      console.log('[RealtimePage] Variables changed, re-populating charts:', rtState.variables.slice(0, 4));

      // Clear existing chart configs
      for (let i = 0; i < 8; i++) {
        store.dispatch({
          type: types.CLEAR_CHART_CONFIG,
          payload: { chartIndex: i, page: PAGE_CONTEXT }
        });
      }

      // Populate first 4 charts with new variables
      const vars = rtState.variables;
      const visibleCount = 4;
      store.dispatch({
        type: types.SET_VISIBLE_CHART_COUNT,
        payload: { count: visibleCount, page: PAGE_CONTEXT }
      });
      vars.slice(0, visibleCount).forEach((variable, chartIndex) => {
        store.dispatch({
          type: types.ADD_CHART_VARIABLE,
          payload: { chartIndex, variableKey: variable, axis: 'left', page: PAGE_CONTEXT }
        });
      });

      // Fetch data for the new variable set
      store.dispatch(fetchRealtimeData());
      lastDataLength = rtState.data.length;
    }

    // Update connection status based on SSE status
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      const statusDot = statusEl.querySelector('.status-dot');
      const statusText = statusEl.querySelector('.status-text');

      if (rtState.loading.variables) {
        statusDot.style.background = '#f59e0b';
        statusText.textContent = 'Loading variables...';
      } else if (rtState.errors.data || rtState.errors.variables) {
        statusDot.style.background = '#ef4444';
        statusText.textContent = 'Error';
      } else {
        // Show SSE connection status
        switch (rtState.sseStatus) {
          case 'connecting':
            statusDot.style.background = '#f59e0b';
            statusText.textContent = `Connecting (${rtState.currentDatabase})...`;
            break;
          case 'connected':
            statusDot.style.background = '#22c55e';
            statusText.textContent = `Live (${rtState.currentDatabase})`;
            break;
          case 'error':
            statusDot.style.background = '#ef4444';
            statusText.textContent = 'Connection error - reconnecting...';
            break;
          default:
            statusDot.style.background = '#6b7280';
            statusText.textContent = 'Disconnected';
        }
      }
    }

    // Update data info
    const dataInfo = document.getElementById('data-info');
    if (dataInfo) {
      if (rtState.data.length > 0) {
        dataInfo.textContent = `${rtState.data.length} records`;
      } else {
        dataInfo.textContent = 'No data loaded';
      }
    }

    // Invalidate map size if data loaded for first time
    if (rtState.data.length > 0 && lastDataLength === 0) {
      setTimeout(() => {
        if (components.map && components.map.resize) {
          components.map.resize();
        }
      }, 100);
    }
    lastDataLength = rtState.data.length;
  });
  subscriptions.push(storeSub);

  // ========================================
  // Window Resize Handler
  // ========================================

  const resizeHandler = () => {
    // Components handle their own resize via store subscription
    if (components.map && components.map.resize) {
      components.map.resize();
    }
  };
  window.addEventListener('resize', resizeHandler);
  eventListeners.push({ element: window, event: 'resize', handler: resizeHandler });

  // ========================================
  // Initial Data Fetch & SSE Connection
  // ========================================

  // Variables and chart configs were set up before ChartContainerManager creation
  // Now fetch the data for those variables and connect to SSE
  if (rtVars.length > 0) {
    console.log('[RealtimePage] Fetching initial data for realtime variables');
    await store.dispatch(fetchRealtimeData());

    // Connect to SSE for live updates
    const currentDb = store.getState().realtime?.currentDatabase || 'C130';
    connectSSE(currentDb);
  }

  // Invalidate map size after initial load
  setTimeout(() => {
    if (components.map && components.map.resize) {
      components.map.resize();
    }
  }, 500);

  console.log('[RealtimePage] Initialization complete');

  // ========================================
  // Return Page Instance
  // ========================================

  return {
    name: 'realtime',
    components,

    destroy() {
      destroyed = true;
      console.log('[RealtimePage] Destroying page');

      // Close SSE connection
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      // Destroy components FIRST (before any state changes that might trigger re-renders)
      if (components.chartManager) {
        components.chartManager.destroy();
      }
      if (components.map) {
        components.map.destroy();
      }
      if (components.settingsOverlay) {
        components.settingsOverlay.destroy();
      }

      // Unsubscribe from store
      subscriptions.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });

      // Remove event listeners
      eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });

      // Clear realtime flight selection to avoid leaking into dashboard
      // (Done last, after components are destroyed and unsubscribed)
      store.dispatch({
        type: 'SELECT_FLIGHT',
        payload: { flightId: null, flightNumber: null }
      });

      // Clear realtime data to free memory and ensure fresh data on next visit
      store.dispatch(clearRealtimeData());

      console.log('[RealtimePage] Page destroyed');
    }
  };
}

export default init;

function setInitialRealtimeVariables(store,initialState) {
  const variables = getPageVariables(initialState, 'realtime').slice(0, 4).map(v => [v.clean_name]);
  // Pad to 8 charts
  while (variables.length < 8) variables.push([]);
  store.dispatch({
    type: SET_SELECTED_VARIABLES,
    payload: { page: 'realtime', variables }
  });
}

// Call this function after realtime data loads or when switching database
// Example usage in your initialization logic:
// setInitialRealtimeVariables(store);
