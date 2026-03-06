import { dataReducer } from '../../../../public/store/reducers/dataReducer.js';
import * as types from '../../../../public/store/actions/actionTypes.js';

const reduce = (action, state = undefined) => dataReducer(state, action);

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('dataReducer initial state', () => {
  test('starts with empty flightData cache', () => {
    const state = reduce({ type: '@@INIT' });
    expect(state.flightData).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// FETCH_FLIGHT_DATA_SUCCESS
// ---------------------------------------------------------------------------

describe('FETCH_FLIGHT_DATA_SUCCESS', () => {
  const FLIGHT_ID = 42;
  const timeseries = [{ Time: new Date(2025, 0, 15, 9, 0, 0), atx: 25.1 }];
  const track = [{ lat: 40.1, lon: -105.2, alt: 3000 }];
  const timeRange = { start: new Date(2025, 0, 15, 8, 0, 0), end: new Date(2025, 0, 15, 10, 0, 0) };
  const variables = ['atx', 'wic'];

  const successAction = {
    type: types.FETCH_FLIGHT_DATA_SUCCESS,
    payload: { flightId: FLIGHT_ID, timeseries, track, timeRange, variables }
  };

  test('stores timeseries, track, and timeRange under flightId', () => {
    const state = reduce(successAction);
    const entry = state.flightData[FLIGHT_ID];
    expect(entry.timeseries).toBe(timeseries);
    expect(entry.track).toBe(track);
    expect(entry.timeRange).toBe(timeRange);
  });

  test('stores loaded variables as a Set', () => {
    const state = reduce(successAction);
    const loaded = state.flightData[FLIGHT_ID].loadedVariables;
    expect(loaded).toBeInstanceOf(Set);
    expect(loaded.has('atx')).toBe(true);
    expect(loaded.has('wic')).toBe(true);
  });

  test('merges variables when called again for same flight', () => {
    const firstAction = {
      type: types.FETCH_FLIGHT_DATA_SUCCESS,
      payload: { flightId: FLIGHT_ID, timeseries, track, timeRange, variables: ['atx'] }
    };
    const secondAction = {
      type: types.FETCH_FLIGHT_DATA_SUCCESS,
      payload: { flightId: FLIGHT_ID, timeseries: null, track: null, timeRange: null, variables: ['wic'] }
    };
    const state1 = reduce(firstAction);
    const state2 = reduce(secondAction, state1);
    const loaded = state2.flightData[FLIGHT_ID].loadedVariables;
    expect(loaded.has('atx')).toBe(true);
    expect(loaded.has('wic')).toBe(true);
  });

  test('preserves existing timeseries when new payload has null timeseries', () => {
    const state1 = reduce(successAction);
    const state2 = reduce({
      type: types.FETCH_FLIGHT_DATA_SUCCESS,
      payload: { flightId: FLIGHT_ID, timeseries: null, track: null, timeRange: null, variables: ['dpxc'] }
    }, state1);
    expect(state2.flightData[FLIGHT_ID].timeseries).toBe(timeseries);
  });

  test('stores multiple flights independently', () => {
    const state1 = reduce(successAction);
    const state2 = reduce({
      type: types.FETCH_FLIGHT_DATA_SUCCESS,
      payload: { flightId: 99, timeseries: [], track: [], timeRange, variables: ['psxc'] }
    }, state1);
    expect(state2.flightData[FLIGHT_ID]).toBeDefined();
    expect(state2.flightData[99]).toBeDefined();
    expect(state2.flightData[99].loadedVariables.has('psxc')).toBe(true);
  });

  test('does not mutate previous state', () => {
    const state1 = reduce(successAction);
    const frozen = Object.freeze({ ...state1, flightData: { ...state1.flightData } });
    expect(() => reduce({
      type: types.FETCH_FLIGHT_DATA_SUCCESS,
      payload: { flightId: 99, timeseries: [], track: [], timeRange, variables: [] }
    }, frozen)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unknown action
// ---------------------------------------------------------------------------

describe('unknown action', () => {
  test('returns state unchanged', () => {
    const state = reduce({ type: '@@INIT' });
    const next = reduce({ type: 'DOES_NOT_EXIST' }, state);
    expect(next).toBe(state);
  });
});
