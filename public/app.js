/**
 * app.js - SPA Entry Point
 * Single Page Application shell for RAF Flight Data Visualizer
 */

// Import store infrastructure
import { createStore } from './store/createStore.js';
import { rootReducer } from './store/reducers/rootReducer.js';
import { thunkMiddleware } from './store/middleware/apiMiddleware.js';
import { devLoggerMiddleware } from './store/middleware/loggerMiddleware.js';
import { realtimeDataBridge } from './store/middleware/realtimeDataBridge.js';

// Import router infrastructure
import { Router, URLStateSync, PageManager } from './router/index.js';

// Import actions for URL state sync
import {
  selectProject,
  selectFlight,
  selectChart,
  setSelectedVariables
} from './store/actions/selectionActions.js';
import {
  setTimelineWindow,
  setVisibleChartCount,
  restoreChartConfigs
} from './store/actions/uiActions.js';
import { urlStateRestored, navigate } from './store/actions/routerActions.js';

// ========================================
// Initialize Store
// ========================================

const initialState = {
  metadata: {
    projects: [],
    flights: {},
    variables: []
  },
  selection: {
    projectName: 'GOTHAAM',
    flightId: null,
    flightNumber: null,
    // Page-specific selected chart index
    selectedChartIndex: {
      dashboard: 0,
      realtime: 0
    },
    // Page-specific selected variables: array of arrays (per chart index)
    selectedVariables: {
      dashboard: [
        ['atx'], ['wic'], ['wdc'], ['dpxc'], ['psxc'], ['tasx'], ['palt'], ['thdg']
      ],
      realtime: [[], [], [], [], [], [], [], []]
    }
  },
  data: {
    flightData: {}
  },
  ui: {
    timeline: {
      isPlaying: false,
      progress: 0,
      currentTime: null
    },
    charts: {
      // Page-specific chart state
      dashboard: {
        visibleCount: 4,
        zoomDomains: {},
        configs: {}
      },
      realtime: {
        visibleCount: 4,
        zoomDomains: {},
        configs: {}
      }
    },
    map: {
      showRadar: true,
      layers: {}
    },
    loading: {
      projects: false,
      flights: false,
      flightData: false,
      variables: false
    },
    errors: {
      projects: null,
      flights: null,
      flightData: null,
      variables: null
    }
  },
  router: {
    currentPath: '/',
    query: {},
    urlStateRestored: false,
    lastRestoration: null
  }
};

const middleware = [thunkMiddleware, realtimeDataBridge, devLoggerMiddleware];
const store = createStore(rootReducer, initialState, middleware);

console.log('[app] Store created:', store.getState());

// Make store available globally
window.__store = store;
window.__STORE__ = store;

// ========================================
// Initialize Page Manager
// ========================================

const pageManager = new PageManager({
  container: '#content-area',
  store,
  pages: {
    home: {
      html: 'pages/dashboard.html',
      module: '/aircraft/pages/DashboardPage.js'
    },
    dashboard: {
      html: 'pages/dashboard.html',
      module: '/aircraft/pages/DashboardPage.js'
    },
    about: {
      html: 'pages/about.html',
      module: '/aircraft/pages/AboutPage.js'
    },
    realtime: {
      html: 'pages/realtime.html',
      module: '/aircraft/pages/RealtimePage.js'
    }
  }
});

window.__pageManager = pageManager;

// ========================================
// Initialize Router
// ========================================

/**
 * Map URL paths to page names
 */
function getPageNameFromPath(path) {
  const routes = {
    '/': 'home',
    '/home': 'home',
    '/dashboard': 'dashboard',
    '/about': 'about',
    '/realtime': 'realtime'
  };
  return routes[path] || 'home';
}

const baseTag = document.querySelector('base');
const basePath = baseTag ? new URL(baseTag.href, window.location.origin).pathname : '';

const router = new Router({
  basePath,
  routes: {
    '/': handleRoute,
    '/home': handleRoute,
    '/dashboard': handleRoute,
    '/about': handleRoute,
    '/realtime': handleRoute,
    '*': handleRoute  // Fallback
  },
  onNavigate: ({ path, query, isNavigation }) => {
    console.log('[app] Navigation:', path, query);
    store.dispatch(navigate(path, query));
  }
});

window.__router = router;

/**
 * Handle route changes
 */
async function handleRoute({ path, query, isNavigation }) {
  console.log('[app] Handling route:', path, 'isNavigation:', isNavigation);

  // Update router state in store BEFORE loading page
  // This ensures components know which page they're on
  store.dispatch({
    type: 'UPDATE_ROUTE',
    payload: { currentPath: path, query }
  });

  const pageName = getPageNameFromPath(path);

  // Load the page
  try {
    await pageManager.loadPage(pageName, { query, path });

    // Restore state from URL on initial load or navigation
    if (Object.keys(query).length > 0) {
      await urlStateSync.restoreFromURL(query);
    }

  } catch (error) {
    console.error('[app] Error loading page:', error);
  }
}

// ========================================
// Initialize URL State Sync
// ========================================

const urlStateSync = new URLStateSync({
  store,
  router,
  actions: {
    selectProject,
    selectFlight,
    selectChart,
    setSelectedVariables,
    setTimelineWindow,
    setVisibleChartCount,
    restoreChartConfigs,
    urlStateRestored
  },
  debounceDelay: 300
});

window.__urlStateSync = urlStateSync;

// ========================================
// Load CSS for Current Page
// ========================================

/**
 * Load page-specific CSS dynamically
 */
function loadPageCSS(pageName) {
  // Remove existing page-specific CSS
  document.querySelectorAll('link[data-page-css]').forEach(link => link.remove());

  // Page-specific CSS mapping
  const pageCSSMap = {
    about: ['css/about.css', 'css/dropdown.css'],
    dashboard: ['css/settings-overlay.css', 'css/fullscreen-overlay.css'],
    realtime: []
  };

  const cssFiles = pageCSSMap[pageName] || [];

  cssFiles.forEach(cssPath => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssPath;
    link.setAttribute('data-page-css', pageName);
    document.head.appendChild(link);
  });
}

// Subscribe to page changes to load CSS
store.subscribe((state) => {
  const path = state.router?.currentPath || '/';
  const pageName = getPageNameFromPath(path);
  loadPageCSS(pageName);
});

// ========================================
// Initialize Application
// ========================================

async function initApp() {
  console.log('[app] Initializing SPA');

  // Start URL state sync
  urlStateSync.init();

  // Initialize router (handles current URL)
  router.init();

  console.log('[app] SPA initialization complete');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ========================================
// Cleanup on Page Unload
// ========================================

window.addEventListener('beforeunload', () => {
  console.log('[app] Cleaning up SPA');
  pageManager.destroy();
  urlStateSync.destroy();
  router.destroy();
});

// ========================================
// Export for debugging
// ========================================

export { store, router, pageManager, urlStateSync };
