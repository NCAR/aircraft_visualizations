/**
 * Pages module exports
 * SPA page modules for RAF Flight Data Visualizer
 */

export { init as initDashboard } from './DashboardPage.js';
export { init as initAbout } from './AboutPage.js';
// export { init as initRealtime } from './RealtimePage.js';

// Home uses DashboardPage for now (can be customized later)
export { init as initHome } from './DashboardPage.js';

// Page configurations for PageManager
export const pageConfigs = {
  home: {
    html: '/pages/dashboard.html',
    module: '/pages/DashboardPage.js'
  },
  dashboard: {
    html: '/pages/dashboard.html',
    module: '/pages/DashboardPage.js'
  },
  about: {
    html: '/pages/about.html',
    module: '/pages/AboutPage.js'
  },
  // realtime: {
  //   html: '/pages/realtime.html',
  //   module: '/pages/RealtimePage.js'
  // }
};
