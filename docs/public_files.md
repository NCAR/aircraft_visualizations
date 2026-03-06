# Public Directory — File Reference

## Root

| File | Description |
|------|-------------|
| `.htaccess` | Apache rewrite rules serving `index.html` for all non-file routes to support client-side SPA routing |
| `app.js` | SPA entry point — bootstraps the Redux store, client-side router, URL sync, and page lifecycle |
| `main.js` | Legacy store-connected entry point (non-SPA); initializes store and mounts dashboard components directly |
| `navbar.js` | Mobile hamburger menu toggle, active link highlighting, and SPA navigation event wiring |
| `style.css` | Root stylesheet that `@import`s all modular CSS files in the correct cascade order |
| `index.html` | Application shell HTML — loaded for every route; contains the `<div id="app">` SPA mount point |
| `navbar.html` | Shared navbar HTML partial fetched and injected at runtime by `components.js` |
| `footer.html` | Shared footer HTML partial |

---

## pages/

| File | Description |
|------|-------------|
| `pages/index.js` | Re-exports page `init` functions and page config objects consumed by `PageManager` |
| `pages/dashboard.js` | Dashboard page module — initializes all store-connected visualization components (charts, map, timeline, video) |
| `pages/dashboard.html` | Dashboard page HTML template containing the chart grid, timeline scrubber, and control panels |
| `pages/realtime.html` | Realtime page HTML template |
| `pages/RealtimePage.js` | Realtime page module — manages live data polling, SSE connection, and realtime chart configuration |
| `pages/echarts.html` | Standalone ECharts prototype/experiment page |

---

## interfaces/

| File | Description |
|------|-------------|
| `interfaces/IComponent.js` | Base class for all store-connected components; enforces `onStateChange`/`destroy` lifecycle and provides `dispatch`/`getState` helpers |
| `interfaces/IChart.js` | `IComponent` subclass adding the chart contract: `updateData`, `updateProgress`, `updateZoom`, and `resetZoom` |
| `interfaces/ITimelineAware.js` | Mixin interface for components that need to respond to timeline playback via `updateFlightTime(progress, currentTime)` |
| `interfaces/README.md` | Architecture documentation explaining the interface hierarchy and component contract patterns |

---

## modules/

| File | Description |
|------|-------------|
| `modules/README.md` | Overview of the modules directory and its store-connected component classes |
| `modules/TimeLineStore.js` | Drives the timeline animation loop at 20× real-time and dispatches progress updates to the store |
| `modules/FlightMovieStore.js` | Syncs HTML5 video playback with timeline progress using a computed playback rate and gap-aware position mapping |
| `modules/FlightMapStore.js` | Mapbox GL map component rendering the flight track and an animated position marker |
| `modules/LineChartStore.js` | D3-based line chart component; subscribes to the store for variable, zoom, and progress changes |
| `modules/ChartContainerManager.js` | Creates and destroys chart DOM containers dynamically based on `visibleCount` from the store |
| `modules/FullscreenOverlay.js` | In-place card expansion that pushes surrounding content rather than using a modal overlay |

### modules/chart/

| File | Description |
|------|-------------|
| `modules/chart/ChartRenderer.js` | D3 SVG + canvas renderer: builds axes, lines, and visual elements for `LineChartStore` |
| `modules/chart/ChartState.js` | Manages `LineChartStore` data state: filtering, progress tracking, and time-based queries |
| `modules/chart/ChartInteractions.js` | Mouse event handlers, cross-chart tooltip syncing, and zoom brush interactions for D3 charts |


### modules/shared/

| File | Description |
|------|-------------|
| `modules/shared/StateChangeDetector.js` | Utility class for tracking previous state values to avoid redundant DOM/render updates in components |
| `modules/shared/gapUtils.js` | Pure math utilities for mapping data-timeline progress (with recording gaps) to video-timeline progress (without gaps) |
| `modules/shared/utils.js` | General-purpose helpers including `debounce` |
| `modules/shared/constants.js` | Shared constants: chart line colors, NCAR color palette, and map layer configuration |

### modules/components/

| File | Description |
|------|-------------|
| `modules/components/BaseDropdownStore.js` | Base class providing common dropdown rendering, open/close, and store-sync for all dropdown components |
| `modules/components/components.js` | Fetches and injects the shared `navbar.html` partial into the page on load |
| `modules/components/flightDropdown.js` | Flight selector dropdown that fetches flight data when a flight is chosen |
| `modules/components/projectDropdown.js` | Project selector dropdown that fetches the flight list when the project changes |
| `modules/components/SettingsOverlay.js` | Modal overlay for chart variable management, axis configuration, and map layer toggles |
| `modules/components/VariablesListTable.js` | Reusable table component for browsing, adding, and removing flight variables from charts |
| `modules/components/settings-overlay.html` | HTML template for the settings overlay modal injected by `SettingsOverlay.js` |

---

## router/

| File | Description |
|------|-------------|
| `router/Router.js` | Client-side History API router enabling SPA navigation with clean URLs and no page reloads |
| `router/PageManager.js` | Loads HTML page partials into the app container and manages page module init/destroy lifecycle |
| `router/URLStateSync.js` | Bidirectional synchronization between URL query parameters and Redux store state |
| `router/index.js` | Re-exports `Router`, `URLStateSync`, and `PageManager` as a single module |

---

## store/

| File | Description |
|------|-------------|
| `store/Store.js` | Core Redux-like store: `subscribe`, `dispatch`, `getState`, and middleware chain |
| `store/createStore.js` | Factory function to instantiate a `Store` with a root reducer and middleware array |
| `store/diagnostics.js` | Browser-console diagnostic tool for inspecting store shape and health |
| `store/gapTests.js` | Browser-console test runner for gap utility functions (written before the Jest suite) |
| `store/testStore.js` | Browser-console test runner for verifying basic store behavior |
| `store/test.html` | HTML page for running store tests in the browser |
| `store/README.md` | Architecture documentation for the Redux-like store design |

### store/actions/

| File | Description |
|------|-------------|
| `store/actions/actionTypes.js` | All Redux action type string constants used across the entire store |
| `store/actions/metadataActions.js` | Thunk action creators for fetching projects, flights, and variable definitions from the API |
| `store/actions/dataActions.js` | Thunk action creators for fetching and caching flight timeseries and track data |
| `store/actions/uiActions.js` | Action creators for timeline play/pause/seek, chart zoom, chart config, and map layer visibility |
| `store/actions/selectionActions.js` | Action creators for selecting projects, flights, charts, and per-chart variables |
| `store/actions/realtimeActions.js` | Thunk action creators for live C130/GV data polling, SSE connection management, and realtime state |
| `store/actions/realtimeMetadataActions.js` | Thunk action creators for fetching realtime variable names and metadata |
| `store/actions/routerActions.js` | Action creators for SPA route navigation and URL state restoration |

### store/middleware/

| File | Description |
|------|-------------|
| `store/middleware/apiMiddleware.js` | Thunk middleware that allows action creators to return async functions instead of plain action objects |
| `store/middleware/loggerMiddleware.js` | Dev middleware logging dispatched action type names (skips full state to avoid logging large timeseries) |
| `store/middleware/realtimeDataBridge.js` | Middleware that transforms incoming realtime data into the same format used by dashboard charts |

### store/reducers/

| File | Description |
|------|-------------|
| `store/reducers/rootReducer.js` | Combines all slice reducers (`ui`, `selection`, `data`, `metadata`, `router`, `realtime`) into one |
| `store/reducers/uiReducer.js` | UI state: timeline play/seek/progress, per-page chart configs and zoom domains, map layers, loading flags |
| `store/reducers/selectionReducer.js` | Selection state: active project, flight, selected chart index, and per-chart variable arrays |
| `store/reducers/dataReducer.js` | Data cache: flight timeseries, track, time range, and loaded variable `Set`s keyed by flight ID |
| `store/reducers/metadataReducer.js` | Metadata state: projects list, flights per project, and variable definitions |
| `store/reducers/routerReducer.js` | Router state: current path, query parameters, and URL-state-restored flag |
| `store/reducers/realtimeReducer.js` | Realtime state: live data buffer, variable list, SSE connection status, and time window |

### store/selectors/

| File | Description |
|------|-------------|
| `store/selectors/selectors.js` | All selector functions for computing derived values from store state (flight data, UI flags, chart config, etc.) |

---

## css/

| File | Description |
|------|-------------|
| `css/design-tokens.css` | NSF NCAR design system CSS custom properties — single source of truth for colors, spacing, and typography |
| `css/layout.css` | Page-level layout, grid structure, and card containers |
| `css/navbar.css` | Navbar, hamburger menu, and mobile navigation styles |
| `css/homepage.css` | Landing/home page hero and section styles |
| `css/charts.css` | Chart card and chart container styles |
| `css/controls.css` | Timeline scrubber, playback buttons, and speed controls |
| `css/components.css` | Shared reusable component styles (buttons, badges, etc.) |
| `css/dropdown.css` | Project and flight dropdown menu styles |
| `css/forms.css` | Form input and label styles |
| `css/fullscreen-overlay.css` | In-place card expansion animation styles |
| `css/media.css` | Responsive breakpoint and media query overrides |
| `css/realtime.css` | Realtime page-specific styles |
| `css/settings-overlay.css` | Settings modal overlay styles |
| `css/unified.css` | Shared styles applied to both dashboard and realtime pages |
| `css/variables-table.css` | Variables list table and add/remove button styles |
| `css/about.css` | About page styles |

---

## icons/

| File | Description |
|------|-------------|
| `icons/plane.png` | Airplane icon (PNG raster) |
| `icons/plane.svg` | Airplane icon (SVG vector, used for crisp display at any size) |
| `icons/c130_icon.png` | C-130 aircraft silhouette icon |
| `icons/quote_icon.svg` | Quote/testimonial decorative icon |
| `icons/NSF-NCAR_Logo_Color-White_RGB.png` | Official NSF NCAR logo with white text for use on dark backgrounds |

---

## images/

| File | Description |
|------|-------------|
| `images/c130.jpg` | Photo of the NSF/NCAR C-130 research aircraft |
| `images/gv.JPG` | Photo of the NSF/NCAR GV (Gulfstream V) research aircraft |
| `images/hero-aircraft.png` | Hero/banner aircraft image used on the home page |
| `images/NCAR-Waves_Fills-A-Color-5_RGB.png` | NCAR branded decorative waves graphic |
