import { uiReducer, DEFAULT_CHART_CONFIG } from '../../../../public/store/reducers/uiReducer.js';
import * as types from '../../../../public/store/actions/actionTypes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run the reducer from a clean initial state */
const reduce = (action, state = undefined) => uiReducer(state, action);

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('uiReducer initial state', () => {
  test('returns initial state for unknown action', () => {
    const state = reduce({ type: '@@INIT' });
    expect(state.timeline.isPlaying).toBe(false);
    expect(state.timeline.isSeeking).toBe(false);
    expect(state.timeline.progress).toBe(0);
    expect(state.charts.dashboard).toBeDefined();
    expect(state.charts.realtime).toBeDefined();
    expect(state.map.showRadar).toBe(true);
    expect(state.loading.projects).toBe(false);
    expect(state.errors.projects).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Timeline actions
// ---------------------------------------------------------------------------

describe('timeline actions', () => {
  test('TIMELINE_PLAY sets isPlaying to true', () => {
    const state = reduce({ type: types.TIMELINE_PLAY });
    expect(state.timeline.isPlaying).toBe(true);
  });

  test('TIMELINE_PAUSE sets isPlaying to false', () => {
    const playing = reduce({ type: types.TIMELINE_PLAY });
    const paused = reduce({ type: types.TIMELINE_PAUSE }, playing);
    expect(paused.timeline.isPlaying).toBe(false);
  });

  test('TIMELINE_SEEK_START sets isSeeking to true', () => {
    const state = reduce({ type: types.TIMELINE_SEEK_START });
    expect(state.timeline.isSeeking).toBe(true);
  });

  test('TIMELINE_SEEK_END sets isSeeking to false', () => {
    const seeking = reduce({ type: types.TIMELINE_SEEK_START });
    const done = reduce({ type: types.TIMELINE_SEEK_END }, seeking);
    expect(done.timeline.isSeeking).toBe(false);
  });

  test('TIMELINE_SEEK updates progress and currentTime', () => {
    const ts = new Date(2025, 0, 15, 9, 0, 0);
    const state = reduce({
      type: types.TIMELINE_SEEK,
      payload: { progress: 0.42, currentTime: ts }
    });
    expect(state.timeline.progress).toBe(0.42);
    expect(state.timeline.currentTime).toBe(ts);
  });

  test('TIMELINE_UPDATE_PROGRESS updates progress and currentTime', () => {
    const ts = new Date(2025, 0, 15, 10, 0, 0);
    const state = reduce({
      type: types.TIMELINE_UPDATE_PROGRESS,
      payload: { progress: 0.75, currentTime: ts }
    });
    expect(state.timeline.progress).toBe(0.75);
    expect(state.timeline.currentTime).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// Chart zoom actions
// ---------------------------------------------------------------------------

describe('chart zoom actions', () => {
  test('CHART_ZOOM stores domain for given chart index', () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 0, 2);
    const state = reduce({
      type: types.CHART_ZOOM,
      payload: { chartIndex: 2, xDomain: [start, end], page: 'dashboard' }
    });
    expect(state.charts.dashboard.zoomDomains[2].x).toEqual([start, end]);
  });

  test('CHART_RESET_ZOOM removes zoom domain for chart', () => {
    const start = new Date();
    const withZoom = reduce({
      type: types.CHART_ZOOM,
      payload: { chartIndex: 0, xDomain: [start, start], page: 'dashboard' }
    });
    const reset = reduce({
      type: types.CHART_RESET_ZOOM,
      payload: { chartIndex: 0, page: 'dashboard' }
    }, withZoom);
    expect(reset.charts.dashboard.zoomDomains[0]).toBeUndefined();
  });

  test('CHART_ZOOM defaults to dashboard page', () => {
    const state = reduce({
      type: types.CHART_ZOOM,
      payload: { chartIndex: 1, xDomain: [new Date(), new Date()] }
    });
    expect(state.charts.dashboard.zoomDomains[1]).toBeDefined();
    expect(state.charts.realtime.zoomDomains[1]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SET_VISIBLE_CHART_COUNT
// ---------------------------------------------------------------------------

describe('SET_VISIBLE_CHART_COUNT', () => {
  test('sets visible count for dashboard page', () => {
    const state = reduce({
      type: types.SET_VISIBLE_CHART_COUNT,
      payload: { count: 6, page: 'dashboard' }
    });
    expect(state.charts.dashboard.visibleCount).toBe(6);
  });

  test('sets visible count for realtime page independently', () => {
    const state = reduce({
      type: types.SET_VISIBLE_CHART_COUNT,
      payload: { count: 2, page: 'realtime' }
    });
    expect(state.charts.realtime.visibleCount).toBe(2);
    expect(state.charts.dashboard.visibleCount).toBe(4); // default unchanged
  });
});

// ---------------------------------------------------------------------------
// Chart config actions
// ---------------------------------------------------------------------------

describe('ADD_CHART_VARIABLE', () => {
  test('adds a new variable with color assigned', () => {
    const state = reduce({
      type: types.ADD_CHART_VARIABLE,
      payload: { chartIndex: 0, variableKey: 'atx', axis: 'left', page: 'dashboard' }
    });
    const vars = state.charts.dashboard.configs[0].variables;
    expect(vars).toHaveLength(1);
    expect(vars[0].key).toBe('atx');
    expect(vars[0].axis).toBe('left');
    expect(vars[0].color).toBeDefined();
  });

  test('updates axis of existing variable without changing color', () => {
    const first = reduce({
      type: types.ADD_CHART_VARIABLE,
      payload: { chartIndex: 0, variableKey: 'atx', axis: 'left', page: 'dashboard' }
    });
    const originalColor = first.charts.dashboard.configs[0].variables[0].color;

    const second = reduce({
      type: types.ADD_CHART_VARIABLE,
      payload: { chartIndex: 0, variableKey: 'atx', axis: 'right', page: 'dashboard' }
    }, first);
    const vars = second.charts.dashboard.configs[0].variables;
    expect(vars).toHaveLength(1); // still one variable
    expect(vars[0].axis).toBe('right');
    expect(vars[0].color).toBe(originalColor); // color preserved
  });

  test('appends multiple distinct variables', () => {
    let state = reduce({ type: types.ADD_CHART_VARIABLE, payload: { chartIndex: 0, variableKey: 'atx', axis: 'left', page: 'dashboard' } });
    state = reduce({ type: types.ADD_CHART_VARIABLE, payload: { chartIndex: 0, variableKey: 'wic', axis: 'left', page: 'dashboard' } }, state);
    expect(state.charts.dashboard.configs[0].variables).toHaveLength(2);
  });
});

describe('REMOVE_CHART_VARIABLE', () => {
  test('removes variable from chart config', () => {
    let state = reduce({ type: types.ADD_CHART_VARIABLE, payload: { chartIndex: 0, variableKey: 'atx', axis: 'left', page: 'dashboard' } });
    state = reduce({ type: types.REMOVE_CHART_VARIABLE, payload: { chartIndex: 0, variableKey: 'atx', page: 'dashboard' } }, state);
    expect(state.charts.dashboard.configs[0].variables).toHaveLength(0);
  });

  test('no-ops gracefully when variable not present', () => {
    const state = reduce({ type: types.REMOVE_CHART_VARIABLE, payload: { chartIndex: 0, variableKey: 'xyz', page: 'dashboard' } });
    expect(state.charts.dashboard.configs[0]?.variables ?? []).toHaveLength(0);
  });
});

describe('MOVE_CHART_VARIABLE_AXIS', () => {
  test('moves variable axis from left to right', () => {
    let state = reduce({ type: types.ADD_CHART_VARIABLE, payload: { chartIndex: 0, variableKey: 'wdc', axis: 'left', page: 'dashboard' } });
    state = reduce({ type: types.MOVE_CHART_VARIABLE_AXIS, payload: { chartIndex: 0, variableKey: 'wdc', axis: 'right', page: 'dashboard' } }, state);
    expect(state.charts.dashboard.configs[0].variables[0].axis).toBe('right');
  });
});

describe('SET_CHART_AXIS_LABEL', () => {
  test('sets left axis label', () => {
    const state = reduce({
      type: types.SET_CHART_AXIS_LABEL,
      payload: { chartIndex: 0, axis: 'left', label: 'Temperature (°C)', page: 'dashboard' }
    });
    expect(state.charts.dashboard.configs[0].axes.leftLabel).toBe('Temperature (°C)');
  });

  test('sets right axis label', () => {
    const state = reduce({
      type: types.SET_CHART_AXIS_LABEL,
      payload: { chartIndex: 0, axis: 'right', label: 'Wind (m/s)', page: 'dashboard' }
    });
    expect(state.charts.dashboard.configs[0].axes.rightLabel).toBe('Wind (m/s)');
  });
});

describe('SET_CHART_X_AXIS_VARIABLE', () => {
  test('sets x axis key', () => {
    const state = reduce({
      type: types.SET_CHART_X_AXIS_VARIABLE,
      payload: { chartIndex: 0, variableKey: 'psxc', page: 'dashboard' }
    });
    expect(state.charts.dashboard.configs[0].xAxisKey).toBe('psxc');
  });

  test('clears x axis key when null provided', () => {
    let state = reduce({ type: types.SET_CHART_X_AXIS_VARIABLE, payload: { chartIndex: 0, variableKey: 'psxc', page: 'dashboard' } });
    state = reduce({ type: types.SET_CHART_X_AXIS_VARIABLE, payload: { chartIndex: 0, variableKey: null, page: 'dashboard' } }, state);
    expect(state.charts.dashboard.configs[0].xAxisKey).toBeNull();
  });
});

describe('CLEAR_CHART_CONFIG', () => {
  test('resets chart config to defaults', () => {
    let state = reduce({ type: types.ADD_CHART_VARIABLE, payload: { chartIndex: 0, variableKey: 'atx', axis: 'left', page: 'dashboard' } });
    state = reduce({ type: types.CLEAR_CHART_CONFIG, payload: { chartIndex: 0, page: 'dashboard' } }, state);
    const cfg = state.charts.dashboard.configs[0];
    expect(cfg.variables).toHaveLength(0);
    expect(cfg.axes.leftLabel).toBeNull();
    expect(cfg.axes.rightLabel).toBeNull();
    expect(cfg.xAxisKey).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Map actions
// ---------------------------------------------------------------------------

describe('map actions', () => {
  test('MAP_TOGGLE_RADAR toggles radar visibility', () => {
    const on = reduce({ type: types.MAP_TOGGLE_RADAR });
    expect(on.map.showRadar).toBe(false); // starts true, toggled to false
    const back = reduce({ type: types.MAP_TOGGLE_RADAR }, on);
    expect(back.map.showRadar).toBe(true);
  });

  test('MAP_SET_LAYER_VISIBILITY sets a specific layer', () => {
    const state = reduce({
      type: types.MAP_SET_LAYER_VISIBILITY,
      payload: { layerId: 'glm', visible: true }
    });
    expect(state.map.layers.glm).toBe(true);
  });

  test('MAP_SET_LAYER_VISIBILITY does not affect other layers', () => {
    const state = reduce({
      type: types.MAP_SET_LAYER_VISIBILITY,
      payload: { layerId: 'glm', visible: true }
    });
    expect(state.map.layers.nexrad).toBe(true); // default, unchanged
  });
});

// ---------------------------------------------------------------------------
// Loading / Error actions
// ---------------------------------------------------------------------------

describe('loading states', () => {
  const pairs = [
    [types.FETCH_PROJECTS_REQUEST, types.FETCH_PROJECTS_SUCCESS, 'projects'],
    [types.FETCH_FLIGHTS_REQUEST, types.FETCH_FLIGHTS_SUCCESS, 'flights'],
    [types.FETCH_VARIABLES_REQUEST, types.FETCH_VARIABLES_SUCCESS, 'variables'],
    [types.FETCH_FLIGHT_DATA_REQUEST, types.FETCH_FLIGHT_DATA_SUCCESS, 'flightData'],
  ];

  for (const [reqType, successType, key] of pairs) {
    test(`${key}: REQUEST sets loading, SUCCESS clears it`, () => {
      const loading = reduce({ type: reqType });
      expect(loading.loading[key]).toBe(true);
      expect(loading.errors[key]).toBeNull();

      const done = reduce({ type: successType }, loading);
      expect(done.loading[key]).toBe(false);
      expect(done.errors[key]).toBeNull();
    });
  }

  test('FETCH_PROJECTS_FAILURE records error', () => {
    const state = reduce({
      type: types.FETCH_PROJECTS_FAILURE,
      payload: { error: 'network error' }
    });
    expect(state.loading.projects).toBe(false);
    expect(state.errors.projects).toBe('network error');
  });
});

// ---------------------------------------------------------------------------
// SET_SELECTED_VARIABLES (syncs chart configs)
// ---------------------------------------------------------------------------

describe('SET_SELECTED_VARIABLES', () => {
  test('builds chart configs from provided variables array', () => {
    const state = reduce({
      type: types.SET_SELECTED_VARIABLES,
      payload: { variables: [['atx'], ['wic']], page: 'dashboard' }
    });
    expect(state.charts.dashboard.configs[0].variables[0].key).toBe('atx');
    expect(state.charts.dashboard.configs[1].variables[0].key).toBe('wic');
  });

  test('ignores non-array input', () => {
    const before = reduce({ type: '@@INIT' });
    const after = reduce({
      type: types.SET_SELECTED_VARIABLES,
      payload: { variables: null, page: 'dashboard' }
    }, before);
    // State should be unchanged when variables is not an array
    expect(after).toBe(before);
  });
});
