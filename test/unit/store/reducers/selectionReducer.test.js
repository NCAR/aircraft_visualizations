import { selectionReducer } from '../../../../public/store/reducers/selectionReducer.js';
import * as types from '../../../../public/store/actions/actionTypes.js';

const reduce = (action, state = undefined) => selectionReducer(state, action);

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('selectionReducer initial state', () => {
  test('has default project name', () => {
    const state = reduce({ type: '@@INIT' });
    expect(state.projectName).toBe('GOTHAAM');
  });

  test('has null flight id and number', () => {
    const state = reduce({ type: '@@INIT' });
    expect(state.flightId).toBeNull();
    expect(state.flightNumber).toBeNull();
  });

  test('has default dashboard selected variables', () => {
    const state = reduce({ type: '@@INIT' });
    const dashVars = state.selectedVariables.dashboard;
    expect(Array.isArray(dashVars)).toBe(true);
    expect(dashVars[0]).toContain('atx');
  });
});

// ---------------------------------------------------------------------------
// SELECT_PROJECT
// ---------------------------------------------------------------------------

describe('SELECT_PROJECT', () => {
  test('sets project name', () => {
    const state = reduce({ type: types.SELECT_PROJECT, payload: { projectName: 'SOCRATES' } });
    expect(state.projectName).toBe('SOCRATES');
  });

  test('resets flight id and number when project changes', () => {
    const withFlight = reduce({ type: types.SELECT_FLIGHT, payload: { flightId: 42, flightNumber: 'RF01' } });
    const switched = reduce({ type: types.SELECT_PROJECT, payload: { projectName: 'NEW' } }, withFlight);
    expect(switched.flightId).toBeNull();
    expect(switched.flightNumber).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SELECT_FLIGHT
// ---------------------------------------------------------------------------

describe('SELECT_FLIGHT', () => {
  test('sets flightId and flightNumber', () => {
    const state = reduce({ type: types.SELECT_FLIGHT, payload: { flightId: 7, flightNumber: 'RF07' } });
    expect(state.flightId).toBe(7);
    expect(state.flightNumber).toBe('RF07');
  });

  test('does not affect project name', () => {
    const state = reduce({ type: types.SELECT_FLIGHT, payload: { flightId: 1, flightNumber: 'RF01' } });
    expect(state.projectName).toBe('GOTHAAM');
  });
});

// ---------------------------------------------------------------------------
// SELECT_CHART
// ---------------------------------------------------------------------------

describe('SELECT_CHART', () => {
  test('sets chart index for dashboard page', () => {
    const state = reduce({ type: types.SELECT_CHART, payload: { chartIndex: 3, page: 'dashboard' } });
    expect(state.selectedChartIndex.dashboard).toBe(3);
  });

  test('sets chart index for realtime page independently', () => {
    const state = reduce({ type: types.SELECT_CHART, payload: { chartIndex: 5, page: 'realtime' } });
    expect(state.selectedChartIndex.realtime).toBe(5);
    expect(state.selectedChartIndex.dashboard).toBe(0); // default
  });

  test('defaults to dashboard when page is omitted', () => {
    const state = reduce({ type: types.SELECT_CHART, payload: { chartIndex: 2 } });
    expect(state.selectedChartIndex.dashboard).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// UPDATE_CHART_VARIABLE
// ---------------------------------------------------------------------------

describe('UPDATE_CHART_VARIABLE', () => {
  test('adds variable to chart', () => {
    const state = reduce({
      type: types.UPDATE_CHART_VARIABLE,
      payload: { chartIndex: 0, variableCleanName: 'dpxc', page: 'dashboard' }
    });
    expect(state.selectedVariables.dashboard[0]).toContain('dpxc');
  });

  test('does not add duplicate variable', () => {
    let state = reduce({
      type: types.UPDATE_CHART_VARIABLE,
      payload: { chartIndex: 0, variableCleanName: 'atx', page: 'dashboard' }
    });
    // 'atx' is already in the default initial state for chart 0
    const countBefore = state.selectedVariables.dashboard[0].filter(v => v === 'atx').length;
    state = reduce({
      type: types.UPDATE_CHART_VARIABLE,
      payload: { chartIndex: 0, variableCleanName: 'atx', page: 'dashboard' }
    }, state);
    const countAfter = state.selectedVariables.dashboard[0].filter(v => v === 'atx').length;
    expect(countAfter).toBe(countBefore);
  });

  test('defaults to dashboard page when page omitted', () => {
    const state = reduce({
      type: types.UPDATE_CHART_VARIABLE,
      payload: { chartIndex: 1, variableCleanName: 'psxc' }
    });
    expect(state.selectedVariables.dashboard[1]).toContain('psxc');
  });
});

// ---------------------------------------------------------------------------
// REMOVE_CHART_VARIABLE
// ---------------------------------------------------------------------------

describe('REMOVE_CHART_VARIABLE (selectionReducer)', () => {
  test('removes variable from chart', () => {
    let state = reduce({ type: '@@INIT' }); // chart 0 has ['atx']
    state = reduce({
      type: types.REMOVE_CHART_VARIABLE,
      payload: { chartIndex: 0, variableKey: 'atx', page: 'dashboard' }
    }, state);
    expect(state.selectedVariables.dashboard[0]).not.toContain('atx');
  });

  test('no-ops gracefully when variable not present', () => {
    const state = reduce({
      type: types.REMOVE_CHART_VARIABLE,
      payload: { chartIndex: 0, variableKey: 'nonexistent', page: 'dashboard' }
    });
    expect(state.selectedVariables.dashboard[0]).toContain('atx'); // default preserved
  });
});

// ---------------------------------------------------------------------------
// SET_SELECTED_VARIABLES
// ---------------------------------------------------------------------------

describe('SET_SELECTED_VARIABLES (selectionReducer)', () => {
  test('replaces selected variables for page', () => {
    const newVars = [['psxc'], ['wic'], [], [], [], [], [], []];
    const state = reduce({
      type: types.SET_SELECTED_VARIABLES,
      payload: { variables: newVars, page: 'dashboard' }
    });
    expect(state.selectedVariables.dashboard[0]).toEqual(['psxc']);
    expect(state.selectedVariables.dashboard[1]).toEqual(['wic']);
  });

  test('pads to 8 chart slots', () => {
    const state = reduce({
      type: types.SET_SELECTED_VARIABLES,
      payload: { variables: [['atx']], page: 'dashboard' }
    });
    expect(state.selectedVariables.dashboard).toHaveLength(8);
  });

  test('does not affect other page variables', () => {
    const state = reduce({
      type: types.SET_SELECTED_VARIABLES,
      payload: { variables: [['psxc']], page: 'dashboard' }
    });
    // realtime variables should remain default
    expect(state.selectedVariables.realtime).toBeDefined();
  });

  test('uses empty arrays for missing slots', () => {
    const state = reduce({
      type: types.SET_SELECTED_VARIABLES,
      payload: { variables: [], page: 'dashboard' }
    });
    state.selectedVariables.dashboard.forEach(slot => {
      expect(Array.isArray(slot)).toBe(true);
      expect(slot).toHaveLength(0);
    });
  });
});
