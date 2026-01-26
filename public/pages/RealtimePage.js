/**
 * RealtimePage.js - SPA Page Module
 * Real-time flight data visualization with Redux state management
 */

// Import realtime actions
import {
  fetchRealtimeVariables,
  fetchRealtimeData,
  switchRealtimeDatabase,
  setRealtimeAutoUpdate,
  clearRealtimeData
} from '../store/actions/realtimeActions.js';

// Import UI actions for chart management
import { setVisibleChartCount, addChartVariable } from '../store/actions/uiActions.js';
import { setSelectedVariables } from '../store/actions/selectionActions.js';
import * as types from '../store/actions/actionTypes.js';

// Import store-connected components
import ChartContainerManager from '../modules/ChartContainerManager.js';
import RealtimeFlightMap from '../modules/RealtimeFlightMap.js';
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

  const components = {};
  const subscriptions = [];
  const eventListeners = [];
  let autoUpdateInterval = null;

  // State tracking for database switching and initial load
  let lastDataLength = 0;
  let lastVariables = null;
  let shouldPopulateCharts = false;

  // Ensure selection reflects realtime variables (set after fetch below)
  console.log('[RealtimePage] Preparing selection for realtime variables');

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
  // Initialize Chart Container (multi-chart)
  // ========================================

  components.chartManager = new ChartContainerManager('#realtime-chart-container', store);

  // ========================================
  // Initialize Map (store-connected)
  // ========================================

  components.map = new RealtimeFlightMap('realtime-map', store);

  // ========================================
  // Initialize Settings Overlay (shared)
  // ========================================

  components.settingsOverlay = new SettingsOverlay(store);

  // ========================================
  // Database Toggle
  // ========================================

  const dbToggle = document.getElementById('database-toggle');
  if (dbToggle) {
    const buttons = dbToggle.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
      const handler = () => {
        const db = btn.dataset.db;
        console.log('[RealtimePage] Switching to database:', db);

        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Set flag to trigger chart update when variables load
        shouldPopulateCharts = true;

        // Switch database (this will fetch new variables)
        store.dispatch(switchRealtimeDatabase(db));
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
  // Auto Update Toggle
  // ========================================

  const autoUpdateToggle = document.getElementById('auto-update-toggle');
  if (autoUpdateToggle) {
    const handler = (e) => {
      const enabled = e.target.checked;
      store.dispatch(setRealtimeAutoUpdate(enabled));

      if (enabled) {
        // Start auto-update
        autoUpdateInterval = setInterval(() => {
          const state = store.getState();
          const lastTime = state.realtime?.timeRange?.end;
          store.dispatch(fetchRealtimeData({
            after: lastTime ? lastTime.toISOString() : undefined
          }));
        }, 5000);
      } else {
        // Stop auto-update
        if (autoUpdateInterval) {
          clearInterval(autoUpdateInterval);
          autoUpdateInterval = null;
        }
      }
    };
    autoUpdateToggle.addEventListener('change', handler);
    eventListeners.push({ element: autoUpdateToggle, event: 'change', handler });
  }

  // ========================================
  // Store Subscription for UI Updates
  // ========================================

  const storeSub = store.subscribe((state) => {
    const rtState = state.realtime;
    if (!rtState) return;

    // When variables change (database switched or initial load), update charts
    if (rtState.variables !== lastVariables && rtState.variables.length > 0 && shouldPopulateCharts) {
      lastVariables = rtState.variables;
      shouldPopulateCharts = false;

      console.log('[RealtimePage] Populating charts with realtime variables:', rtState.variables.slice(0, 4));

      // Populate first 4 charts with new variables
      const vars = rtState.variables;
      const visibleCount = 4;

      // IMPORTANT: Use direct dispatch with explicit page='realtime' to avoid router timing issues
      store.dispatch({
        type: types.SET_VISIBLE_CHART_COUNT,
        payload: { count: visibleCount, page: 'realtime' }
      });

      vars.slice(0, visibleCount).forEach((variable, chartIndex) => {
        store.dispatch({
          type: types.ADD_CHART_VARIABLE,
          payload: { chartIndex, variableKey: variable, axis: 'left', page: 'realtime' }
        });
      });

      // Fetch data for new database
      store.dispatch(fetchRealtimeData());
    }

    // Update connection status
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      const statusDot = statusEl.querySelector('.status-dot');
      const statusText = statusEl.querySelector('.status-text');

      if (rtState.loading.data || rtState.loading.variables) {
        statusDot.style.background = '#f59e0b';
        statusText.textContent = 'Loading...';
      } else if (rtState.errors.data || rtState.errors.variables) {
        statusDot.style.background = '#ef4444';
        statusText.textContent = 'Error';
      } else if (rtState.data.length > 0) {
        statusDot.style.background = '#22c55e';
        statusText.textContent = `Connected (${rtState.currentDatabase})`;
      } else {
        statusDot.style.background = '#6b7280';
        statusText.textContent = 'No data';
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
        if (components.map) {
          components.map.invalidateSize();
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
    if (components.map) {
      components.map.invalidateSize();
    }
  };
  window.addEventListener('resize', resizeHandler);
  eventListeners.push({ element: window, event: 'resize', handler: resizeHandler });

  // ========================================
  // Initial Data Fetch
  // ========================================

  // Variables already fetched before chart initialization
  // Now populate charts with the first 4 variables
  const state = store.getState();
  const rtVars = state.realtime?.variables || [];
  if (rtVars.length > 0) {
    console.log('[RealtimePage] Populating charts with realtime variables:', rtVars.slice(0, 4));
    store.dispatch(setVisibleChartCount(4));
    // Set selection variables to match realtime charts to avoid dashboard defaults
    console.log('[RealtimePage] Setting selectedVariables for realtime charts');
    store.dispatch(setSelectedVariables(rtVars.slice(0, 4)));
    rtVars.slice(0, 4).forEach((variable, chartIndex) => {
      console.log(`[RealtimePage] Adding variable "${variable}" to chart ${chartIndex}`);
      store.dispatch(addChartVariable(chartIndex, variable, 'left'));
    });
    // Fetch data for selected variables
    store.dispatch(fetchRealtimeData());
  }

  // Invalidate map size after initial load
  setTimeout(() => {
    if (components.map) {
      components.map.invalidateSize();
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
      console.log('[RealtimePage] Destroying page');

      // Stop auto-update
      if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
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

      console.log('[RealtimePage] Page destroyed');
    }
  };
}

export default init;
