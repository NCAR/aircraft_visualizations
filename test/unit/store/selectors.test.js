import {
  getCurrentFlightId,
  getCurrentFlightNumber,
  getCurrentProject,
  getCurrentProjectName,
  getSelectedChartIndex,
  getSelectedVariables,
  getChartVariable,
  getFlightData,
  getCurrentFlightData,
  getCurrentTimeseries,
  getCurrentTrack,
  getCurrentTimeRange,
  isVariableLoaded,
  isTimelinePlaying,
  isTimelineSeeking,
  getTimelineProgress,
  getCurrentTime,
  getChartConfig,
  getChartVariablesByAxis,
  getChartVariablesWithColors,
  getChartAxisLabel,
  getChartXAxisVariable,
  getChartZoomDomain,
  getVisibleChartCount,
  isRadarEnabled,
  getMapLayers,
  isLayerVisible,
  isLoadingFlightData,
  getErrors,
  getCurrentPath,
} from '../../../public/store/selectors/selectors.js';

// ---------------------------------------------------------------------------
// Minimal state factory
// ---------------------------------------------------------------------------

function makeState({
  projectName = 'GOTHAAM',
  flightId = null,
  flightNumber = null,
  selectedChartIndex = { dashboard: 0, realtime: 0 },
  selectedVariables = { dashboard: [['atx'], ['wic'], [], [], [], [], [], []], realtime: [[], [], [], [], [], [], [], []] },
  flightData = {},
  timeline = { isPlaying: false, isSeeking: false, progress: 0, currentTime: null },
  charts = {
    dashboard: { zoomDomains: {}, visibleCount: 4, configs: {} },
    realtime: { zoomDomains: {}, visibleCount: 4, configs: {} }
  },
  map = { showRadar: true, layers: { glm: false, mrms: false, goesVisible: false, goesIR: false, nexrad: true } },
  loading = { projects: false, flights: false, flightData: false, variables: false },
  errors = { projects: null, flights: null, flightData: null, variables: null },
  router = { currentPath: '/', query: {} }
} = {}) {
  return {
    selection: { projectName, flightId, flightNumber, selectedChartIndex, selectedVariables },
    data: { flightData },
    ui: { timeline, charts, map, loading, errors },
    metadata: { projects: [], flights: {}, variables: [] },
    router,
    realtime: { data: [], variables: [], variableMetadata: {} }
  };
}

// ---------------------------------------------------------------------------
// Selection selectors
// ---------------------------------------------------------------------------

describe('selection selectors', () => {
  test('getCurrentProject returns projectName', () => {
    expect(getCurrentProject(makeState({ projectName: 'SOCRATES' }))).toBe('SOCRATES');
  });

  test('getCurrentProjectName is alias for getCurrentProject', () => {
    const s = makeState({ projectName: 'TEST' });
    expect(getCurrentProjectName(s)).toBe(getCurrentProject(s));
  });

  test('getCurrentFlightId returns flightId', () => {
    expect(getCurrentFlightId(makeState({ flightId: 7 }))).toBe(7);
    expect(getCurrentFlightId(makeState())).toBeNull();
  });

  test('getCurrentFlightNumber returns flightNumber', () => {
    expect(getCurrentFlightNumber(makeState({ flightNumber: 'RF03' }))).toBe('RF03');
  });

  test('getSelectedChartIndex returns page-specific index', () => {
    const s = makeState({ selectedChartIndex: { dashboard: 2, realtime: 5 } });
    expect(getSelectedChartIndex(s, 'dashboard')).toBe(2);
    expect(getSelectedChartIndex(s, 'realtime')).toBe(5);
  });

  test('getSelectedVariables returns per-page variable arrays', () => {
    const vars = getSelectedVariables(makeState(), 'dashboard');
    expect(Array.isArray(vars)).toBe(true);
    expect(vars[0]).toEqual(['atx']);
  });

  test('getChartVariable returns first variable for chart index', () => {
    const s = makeState();
    expect(getChartVariable(s, 0, 'dashboard')).toBe('atx');
    expect(getChartVariable(s, 1, 'dashboard')).toBe('wic');
  });

  test('getChartVariable returns null for empty chart', () => {
    const s = makeState();
    expect(getChartVariable(s, 2, 'dashboard')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Data selectors
// ---------------------------------------------------------------------------

describe('data selectors', () => {
  const timeRange = { start: new Date(2025, 0, 15, 8, 0, 0), end: new Date(2025, 0, 15, 10, 0, 0) };
  const timeseries = [{ Time: new Date(2025, 0, 15, 9, 0, 0), atx: 22 }];
  const track = [{ lat: 40, lon: -105 }];
  const loadedVars = new Set(['atx', 'wic']);

  const state = makeState({
    flightId: 5,
    flightData: {
      5: { timeseries, track, timeRange, loadedVariables: loadedVars }
    }
  });

  test('getFlightData returns data for given flightId', () => {
    expect(getFlightData(state, 5)).toBeDefined();
    expect(getFlightData(state, 99)).toBeNull();
  });

  test('getCurrentFlightData returns data for current flight', () => {
    expect(getCurrentFlightData(state)).toBeDefined();
  });

  test('getCurrentFlightData returns null when no flight selected', () => {
    expect(getCurrentFlightData(makeState())).toBeNull();
  });

  test('getCurrentTimeseries returns timeseries array', () => {
    expect(getCurrentTimeseries(state)).toBe(timeseries);
  });

  test('getCurrentTimeseries returns [] when no data', () => {
    expect(getCurrentTimeseries(makeState())).toEqual([]);
  });

  test('getCurrentTrack returns track array', () => {
    expect(getCurrentTrack(state)).toBe(track);
  });

  test('getCurrentTimeRange returns timeRange', () => {
    expect(getCurrentTimeRange(state)).toBe(timeRange);
  });

  test('isVariableLoaded returns true for loaded variable', () => {
    expect(isVariableLoaded(state, 'atx')).toBe(true);
    expect(isVariableLoaded(state, 'dpxc')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UI / Timeline selectors
// ---------------------------------------------------------------------------

describe('timeline selectors', () => {
  const ts = new Date(2025, 0, 15, 9, 0, 0);

  test('isTimelinePlaying', () => {
    expect(isTimelinePlaying(makeState({ timeline: { isPlaying: true, isSeeking: false, progress: 0, currentTime: null } }))).toBe(true);
    expect(isTimelinePlaying(makeState())).toBe(false);
  });

  test('isTimelineSeeking', () => {
    expect(isTimelineSeeking(makeState({ timeline: { isPlaying: false, isSeeking: true, progress: 0, currentTime: null } }))).toBe(true);
  });

  test('getTimelineProgress', () => {
    expect(getTimelineProgress(makeState({ timeline: { isPlaying: false, isSeeking: false, progress: 0.42, currentTime: null } }))).toBe(0.42);
  });

  test('getCurrentTime', () => {
    expect(getCurrentTime(makeState({ timeline: { isPlaying: false, isSeeking: false, progress: 0, currentTime: ts } }))).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// Chart config selectors
// ---------------------------------------------------------------------------

describe('chart config selectors', () => {
  const varConfigs = [
    { key: 'atx', axis: 'left', color: '#e74c3c' },
    { key: 'wic', axis: 'right', color: '#3498db' }
  ];
  const chartCfg = { variables: varConfigs, axes: { leftLabel: 'Temp', rightLabel: 'Wind' }, xAxisKey: 'psxc' };
  const state = makeState({
    charts: {
      dashboard: { zoomDomains: {}, visibleCount: 4, configs: { 0: chartCfg } },
      realtime: { zoomDomains: {}, visibleCount: 4, configs: {} }
    }
  });

  test('getChartConfig returns config for chart index', () => {
    const cfg = getChartConfig(state, 0, 'dashboard');
    expect(cfg.variables).toHaveLength(2);
    expect(cfg.axes.leftLabel).toBe('Temp');
  });

  test('getChartConfig returns default when no config set', () => {
    const cfg = getChartConfig(state, 3, 'dashboard');
    expect(cfg.variables).toEqual([]);
    expect(cfg.axes.leftLabel).toBeNull();
  });

  test('getChartVariablesByAxis splits variables by axis', () => {
    const byAxis = getChartVariablesByAxis(state, 0, 'dashboard');
    expect(byAxis.left).toEqual(['atx']);
    expect(byAxis.right).toEqual(['wic']);
  });

  test('getChartVariablesWithColors returns full config objects', () => {
    const vars = getChartVariablesWithColors(state, 0, 'dashboard');
    expect(vars[0]).toMatchObject({ key: 'atx', axis: 'left' });
  });

  test('getChartAxisLabel returns labels', () => {
    expect(getChartAxisLabel(state, 0, 'left', 'dashboard')).toBe('Temp');
    expect(getChartAxisLabel(state, 0, 'right', 'dashboard')).toBe('Wind');
  });

  test('getChartXAxisVariable returns xAxisKey', () => {
    expect(getChartXAxisVariable(state, 0, 'dashboard')).toBe('psxc');
    expect(getChartXAxisVariable(state, 3, 'dashboard')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Zoom domain selectors
// ---------------------------------------------------------------------------

describe('getChartZoomDomain', () => {
  const start = new Date(2025, 0, 15, 9, 0);
  const end = new Date(2025, 0, 15, 9, 30);
  const state = makeState({
    charts: {
      dashboard: { zoomDomains: { 2: { x: [start, end] } }, visibleCount: 4, configs: {} },
      realtime: { zoomDomains: {}, visibleCount: 4, configs: {} }
    }
  });

  test('returns zoom domain for chart with zoom set', () => {
    const domain = getChartZoomDomain(state, 2, 'dashboard');
    expect(domain).toBeDefined();
    expect(domain.x).toEqual([start, end]);
  });

  test('returns null for chart without zoom', () => {
    expect(getChartZoomDomain(state, 0, 'dashboard')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Visible chart count
// ---------------------------------------------------------------------------

describe('getVisibleChartCount', () => {
  test('returns visibleCount for page', () => {
    const state = makeState({
      charts: {
        dashboard: { zoomDomains: {}, visibleCount: 6, configs: {} },
        realtime: { zoomDomains: {}, visibleCount: 2, configs: {} }
      }
    });
    expect(getVisibleChartCount(state, 'dashboard')).toBe(6);
    expect(getVisibleChartCount(state, 'realtime')).toBe(2);
  });

  test('defaults to 4 when not set', () => {
    expect(getVisibleChartCount(makeState())).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Map selectors
// ---------------------------------------------------------------------------

describe('map selectors', () => {
  test('isRadarEnabled returns showRadar', () => {
    expect(isRadarEnabled(makeState())).toBe(true);
    expect(isRadarEnabled(makeState({ map: { showRadar: false, layers: { glm: false, mrms: false, goesVisible: false, goesIR: false, nexrad: true } } }))).toBe(false);
  });

  test('getMapLayers returns layers object', () => {
    const layers = getMapLayers(makeState());
    expect(layers.nexrad).toBe(true);
    expect(layers.glm).toBe(false);
  });

  test('isLayerVisible checks specific layer', () => {
    expect(isLayerVisible(makeState(), 'nexrad')).toBe(true);
    expect(isLayerVisible(makeState(), 'glm')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Loading / error selectors
// ---------------------------------------------------------------------------

describe('loading and error selectors', () => {
  test('isLoadingFlightData', () => {
    expect(isLoadingFlightData(makeState())).toBe(false);
    const loading = makeState({ loading: { projects: false, flights: false, flightData: true, variables: false } });
    expect(isLoadingFlightData(loading)).toBe(true);
  });

  test('getErrors returns errors object', () => {
    const state = makeState({ errors: { projects: 'oops', flights: null, flightData: null, variables: null } });
    expect(getErrors(state).projects).toBe('oops');
  });
});

// ---------------------------------------------------------------------------
// Router selectors
// ---------------------------------------------------------------------------

describe('router selectors', () => {
  test('getCurrentPath returns current path', () => {
    expect(getCurrentPath(makeState({ router: { currentPath: '/realtime', query: {} } }))).toBe('/realtime');
  });

  test('getCurrentPath defaults to / when no router state', () => {
    const s = makeState();
    s.router = undefined;
    expect(getCurrentPath(s)).toBe('/');
  });
});
