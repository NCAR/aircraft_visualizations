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
import { setVisibleChartCount, addChartVariable, timelineUpdateProgress, restoreChartConfigs } from '../store/actions/uiActions.js';
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

  // Stale data tracking
  let lastDataWallClockTime = null;
  let stalenessInterval = null;

  // Review mode state
  let reviewMode = false;
  let prevTimeWindow = null;

  // Sync pause state (debug)
  let syncPaused = false;

  function setActiveDatabaseToggle(database) {
    const dbToggleEl = document.getElementById('database-toggle');
    if (!dbToggleEl) return;
    dbToggleEl.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.db === database);
    });
  }

  async function pickPreferredRealtimeDatabase(defaultDb = 'C130') {
    try {
      const response = await fetch('/api/realtime/status');
      if (!response.ok) return defaultDb;

      const payload = await response.json();
      const statuses = payload?.statuses || {};

      const c130State = statuses.C130?.state;
      const gvState = statuses.GV?.state;

      // Prefer the only airborne aircraft when exactly one is airborne.
      if (c130State === 'airborne' && gvState !== 'airborne') return 'C130';
      if (gvState === 'airborne' && c130State !== 'airborne') return 'GV';

      return defaultDb;
    } catch (error) {
      console.warn('[RealtimePage] Unable to fetch realtime status, using default DB:', error);
      return defaultDb;
    }
  }

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
    await store.dispatch(fetchRealtimeVariables());
    setActiveDatabaseToggle(urlDb);
  } else {
    const preferredDb = await pickPreferredRealtimeDatabase(store.getState().realtime?.currentDatabase || 'C130');
    await store.dispatch(switchRealtimeDatabase(preferredDb));
    await store.dispatch(fetchRealtimeVariables());
    setActiveDatabaseToggle(preferredDb);
  }

  // ========================================
  // Set up chart variables BEFORE creating ChartContainerManager
  // This ensures getChartConfigs returns the correct charts to create
  // ========================================
  const initialState = store.getState();
  const urlVars = context.query?.variables;
  const urlCharts = context.query?.charts;

  if (urlVars) {
    const parsed = parseVarsFromURL(urlVars);
    // Populate selection.selectedVariables (used by getChartVariable → LineChartStore)
    const keysOnly = parsed.map(chartVars => chartVars.map(v => v.key));
    while (keysOnly.length < 8) keysOnly.push([]);
    store.dispatch({ type: SET_SELECTED_VARIABLES, payload: { page: PAGE_CONTEXT, variables: keysOnly } });
    // Overwrite chart configs with full axis info from URL
    store.dispatch(restoreChartConfigs(parsed, PAGE_CONTEXT, []));
    const count = urlCharts ? Math.max(1, parseInt(urlCharts, 10)) : Math.max(1, parsed.length);
    store.dispatch(setVisibleChartCount(count, PAGE_CONTEXT));
    lastVariables = initialState.realtime.variables;
  } else {
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
        setActiveDatabaseToggle(db);

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
  // Pause Sync Button (debug)
  // ========================================

  const pauseSyncBtn = document.getElementById('pause-sync-btn');
  if (pauseSyncBtn) {
    const handler = () => {
      syncPaused = !syncPaused;
      pauseSyncBtn.classList.toggle('btn-paused', syncPaused);
      pauseSyncBtn.innerHTML = syncPaused
        ? '<i class="fas fa-play"></i> Resume Sync'
        : '<i class="fas fa-pause"></i> Pause Sync';
      console.log(`[RealtimePage] Sync ${syncPaused ? 'paused' : 'resumed'}`);
    };
    pauseSyncBtn.addEventListener('click', handler);
    eventListeners.push({ element: pauseSyncBtn, event: 'click', handler });
  }

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

  // ========================================
  // Review Mode Buttons & Scrubber
  // ========================================

  const reviewModeBtn = document.getElementById('review-mode-btn');
  if (reviewModeBtn) {
    const handler = () => enterReviewMode();
    reviewModeBtn.addEventListener('click', handler);
    eventListeners.push({ element: reviewModeBtn, event: 'click', handler });
  }

  const exitReviewBtn = document.getElementById('exit-review-btn');
  if (exitReviewBtn) {
    const handler = () => exitReviewMode();
    exitReviewBtn.addEventListener('click', handler);
    eventListeners.push({ element: exitReviewBtn, event: 'click', handler });
  }

  const reviewScrubber = document.getElementById('review-scrubber');
  if (reviewScrubber) {
    const handler = () => {
      if (!reviewMode) return;
      const timeRange = store.getState().realtime.timeRange;
      if (!timeRange) return;

      const progress = parseInt(reviewScrubber.value, 10) / 1000;
      const reviewTime = new Date(
        timeRange.start.getTime() + progress * (timeRange.end.getTime() - timeRange.start.getTime())
      );

      const timeDisplay = document.getElementById('review-current-time');
      if (timeDisplay) timeDisplay.textContent = reviewTime.toLocaleTimeString();

      store.dispatch(timelineUpdateProgress(progress, reviewTime));
    };
    reviewScrubber.addEventListener('input', handler);
    eventListeners.push({ element: reviewScrubber, event: 'input', handler });
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
  // Flight Status Badge
  // ========================================

  function updateFlightStatus() {
    const badge = document.getElementById('flight-status-badge');
    if (!badge) return;

    const rtState = store.getState().realtime;
    if (!rtState.data || rtState.data.length === 0) {
      badge.style.display = 'none';
      return;
    }

    badge.style.display = 'inline-flex';

    // Use the data's own timestamp to judge activity — wall-clock receipt time
    // (lastDataWallClockTime) is set the moment SSE fires, even for old records,
    // so it can't distinguish "live flight" from "historical data just loaded".
    const latestDataTime = rtState.timeRange?.end;
    const dataAgeSeconds = latestDataTime
      ? Math.floor((Date.now() - latestDataTime.getTime()) / 1000)
      : Infinity;

    if (dataAgeSeconds > 900) {
      badge.textContent = 'Inactive';
      badge.className = 'flight-status-badge inactive';
      return;
    }

    const latest = rtState.data[rtState.data.length - 1];
    const alt = latest?.ggalt;

    if (alt == null) {
      badge.textContent = 'Active';
      badge.className = 'flight-status-badge airborne';
      return;
    }

    if (alt > 100) {
      badge.textContent = 'Airborne';
      badge.className = 'flight-status-badge airborne';
    } else {
      badge.textContent = 'On ground';
      badge.className = 'flight-status-badge ground';
    }
  }

  // ========================================
  // Review Mode
  // ========================================

  function formatTime(date) {
    if (!date) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function updateReviewScrubberLabels() {
    const timeRange = store.getState().realtime.timeRange;
    if (!timeRange) return;
    const startLabel = document.getElementById('review-start-label');
    const endLabel = document.getElementById('review-end-label');
    if (startLabel) startLabel.textContent = formatTime(timeRange.start);
    if (endLabel) endLabel.textContent = formatTime(timeRange.end);
  }

  function enterReviewMode() {
    reviewMode = true;
    const panel = document.getElementById('review-panel');
    const btn = document.getElementById('review-mode-btn');
    if (panel) panel.style.display = 'flex';
    if (btn) btn.style.display = 'none';

    // Save and clear the time window so all session data is visible
    prevTimeWindow = store.getState().realtime.timeWindow;
    store.dispatch(setRealtimeTimeWindow(null));
    document.querySelectorAll('.time-window-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.time-window-btn[data-window="all"]')?.classList.add('active');

    // Position scrubber at the live end
    const scrubber = document.getElementById('review-scrubber');
    if (scrubber) scrubber.value = 1000;

    updateReviewScrubberLabels();

    const timeDisplay = document.getElementById('review-current-time');
    const timeRange = store.getState().realtime.timeRange;
    if (timeDisplay && timeRange) timeDisplay.textContent = timeRange.end.toLocaleTimeString();
  }

  function exitReviewMode() {
    reviewMode = false;
    const panel = document.getElementById('review-panel');
    const btn = document.getElementById('review-mode-btn');
    if (panel) panel.style.display = 'none';
    if (btn) btn.style.display = '';

    // Restore previous time window
    store.dispatch(setRealtimeTimeWindow(prevTimeWindow));
    const windowVal = prevTimeWindow === null ? 'all' : String(prevTimeWindow);
    document.querySelectorAll('.time-window-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.time-window-btn[data-window="${windowVal}"]`)?.classList.add('active');

    // Reset timeline progress to live end
    const lastTime = store.getState().realtime.timeRange?.end || null;
    store.dispatch(timelineUpdateProgress(1.0, lastTime));
    prevTimeWindow = null;
  }

  // ========================================
  // Stale Data Banner
  // ========================================

  function updateStaleBanner() {
    const banner = document.getElementById('stale-data-banner');
    const bannerText = document.getElementById('stale-banner-text');
    if (!banner || !bannerText) return;

    if (!lastDataWallClockTime) {
      banner.style.display = 'none';
      return;
    }

    const secondsSince = Math.floor((Date.now() - lastDataWallClockTime) / 1000);

    if (secondsSince < 30) {
      banner.style.display = 'none';
      banner.className = 'stale-banner';
    } else if (secondsSince < 300) {
      const mins = Math.floor(secondsSince / 60);
      const secs = secondsSince % 60;
      const elapsed = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      bannerText.textContent = `Data may be delayed — last update ${elapsed} ago`;
      banner.className = 'stale-banner stale';
      banner.style.display = 'flex';
    } else {
      const lastTime = new Date(lastDataWallClockTime).toLocaleTimeString();
      bannerText.textContent = `No new data received — last update at ${lastTime}`;
      banner.className = 'stale-banner dead';
      banner.style.display = 'flex';
    }
  }

  stalenessInterval = setInterval(() => {
    updateStaleBanner();
    updateFlightStatus();
  }, 10000);

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
    const vars = new Set(['gglat', 'gglon', 'thdg', 'ggalt']); // Always include position vars

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
      if (syncPaused) return;
      try {
        const data = JSON.parse(e.data);
        if (data && data.length > 0) {
          store.dispatch(processSSEData(data));
          lastDataWallClockTime = Date.now();
          updateStaleBanner();
          updateFlightStatus();
          if (reviewMode) updateReviewScrubberLabels();
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

    // Update data date from timeRange
    const dataDate = document.getElementById('data-date');
    if (dataDate) {
      const start = rtState.timeRange?.start;
      dataDate.textContent = start
        ? start.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '';
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
    updateFlightStatus();
  });
  subscriptions.push(storeSub);

  // ========================================
  // URL State Sync (state → URL)
  // ========================================

  let lastUrlState = null;
  let urlUpdateTimer = null;

  const urlSub = store.subscribe((state) => {
    if (destroyed) return;
    clearTimeout(urlUpdateTimer);
    urlUpdateTimer = setTimeout(() => {
      const db = state.realtime?.currentDatabase;
      const configs = state.ui?.charts?.realtime?.configs || {};
      const count = state.ui?.charts?.realtime?.visibleCount;
      const vars = serializeVarsToURL(configs);

      const next = JSON.stringify({ db, vars, count });
      if (next === lastUrlState) return;
      lastUrlState = next;

      const query = {};
      if (db) query.db = db;
      if (vars) query.variables = vars;
      if (count && count !== 4) query.charts = String(count);
      window.__router?.updateQuery(query, false);
    }, 500);
  });
  subscriptions.push(urlSub);

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
  if ((initialState.realtime?.variables?.length ?? 0) > 0) {
    console.log('[RealtimePage] Fetching initial data for realtime variables');
    await store.dispatch(fetchRealtimeData());
  }

  // Connect to SSE for live updates even if variables are not yet populated.
  // This keeps connection status accurate and allows incoming data to bootstrap UI.
  const currentDb = store.getState().realtime?.currentDatabase || 'C130';
  connectSSE(currentDb);

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

      // Clear staleness interval
      if (stalenessInterval) {
        clearInterval(stalenessInterval);
        stalenessInterval = null;
      }

      // Reset timeline progress if leaving while in review mode
      if (reviewMode) {
        const lastTime = store.getState().realtime.timeRange?.end || null;
        store.dispatch(timelineUpdateProgress(1.0, lastTime));
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

function parseVarsFromURL(str) {
  return str.split('|').map(seg =>
    seg.split(',').filter(Boolean).map(v => {
      const [key, axisCode] = v.split(':');
      return { key, axis: axisCode === 'R' ? 'right' : 'left' };
    })
  );
}

function serializeVarsToURL(configs) {
  const indices = Object.keys(configs).map(Number).filter(n => !isNaN(n));
  if (!indices.length) return '';
  const maxIndex = Math.max(...indices);
  const segments = [];
  for (let i = 0; i <= maxIndex; i++) {
    const vars = configs[i]?.variables || [];
    segments.push(vars.map(v => `${v.key}:${v.axis === 'right' ? 'R' : 'L'}`).join(','));
  }
  while (segments.length > 0 && segments[segments.length - 1] === '') segments.pop();
  return segments.join('|');
}
