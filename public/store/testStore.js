/**
 * Simple store test
 * Run this in browser console or include in HTML to verify store works
 *
 * Usage: Load this file in browser and check console for test results
 */

import { createStore } from './createStore.js';
import { rootReducer } from './reducers/rootReducer.js';
import { thunkMiddleware } from './middleware/apiMiddleware.js';
import * as selectionActions from './actions/selectionActions.js';
import * as uiActions from './actions/uiActions.js';
import { getCurrentFlightId, getSelectedVariables, isTimelinePlaying } from './selectors/selectors.js';

/**
 * Run store tests
 */
export function runStoreTests() {
  console.log('%c=== Store Tests ===', 'color: #2196F3; font-size: 16px; font-weight: bold;');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`%c✓ PASS: ${message}`, 'color: #4CAF50;');
      testsPassed++;
    } else {
      console.error(`%c✗ FAIL: ${message}`, 'color: #F44336;');
      testsFailed++;
    }
  }

  // Test 1: Store creation
  try {
    const store = createStore(rootReducer, {}, [thunkMiddleware]);
    assert(store !== null, 'Store created successfully');
    assert(typeof store.getState === 'function', 'Store has getState method');
    assert(typeof store.dispatch === 'function', 'Store has dispatch method');
    assert(typeof store.subscribe === 'function', 'Store has subscribe method');
  } catch (error) {
    assert(false, `Store creation: ${error.message}`);
    return;
  }

  // Create store for remaining tests
  const initialState = {
    metadata: { projects: [], flights: {}, variables: [] },
    selection: {
      projectName: 'GOTHAAM',
      flightId: null,
      flightNumber: null,
      selectedChartIndex: 0,
      selectedVariables: ['atx', 'wic', 'wdc', 'dpxc']
    },
    data: { flightData: {} },
    ui: {
      timeline: { isPlaying: false, progress: 0, currentTime: null },
      charts: { zoomDomains: {} },
      map: { showRadar: true },
      loading: { projects: false, flights: false, flightData: false, variables: false },
      errors: { projects: null, flights: null, flightData: null, variables: null }
    }
  };

  const store = createStore(rootReducer, initialState, [thunkMiddleware]);

  // Test 2: Initial state
  const state = store.getState();
  assert(state.selection.projectName === 'GOTHAAM', 'Initial project name is GOTHAAM');
  assert(state.selection.flightId === null, 'Initial flight ID is null');
  assert(state.selection.selectedVariables.length === 4, 'Initial variables array has 4 items');

  // Test 3: Dispatch action
  store.dispatch(selectionActions.selectFlight(21, 'RF20'));
  const stateAfterFlight = store.getState();
  assert(stateAfterFlight.selection.flightId === 21, 'Flight ID updated to 21');
  assert(stateAfterFlight.selection.flightNumber === 'RF20', 'Flight number updated to RF20');

  // Test 4: Selectors
  const flightId = getCurrentFlightId(stateAfterFlight);
  assert(flightId === 21, 'Selector getCurrentFlightId returns 21');

  const variables = getSelectedVariables(stateAfterFlight);
  assert(variables.length === 4, 'Selector getSelectedVariables returns 4 variables');
  assert(variables[0] === 'atx', 'First variable is atx');

  // Test 5: Update chart variable
  store.dispatch(selectionActions.updateChartVariable(0, 'wdc'));
  const stateAfterVar = store.getState();
  assert(stateAfterVar.selection.selectedVariables[0] === 'wdc', 'Chart 0 variable updated to wdc');
  assert(stateAfterVar.selection.selectedVariables[1] === 'wic', 'Chart 1 variable unchanged');

  // Test 6: Timeline actions
  store.dispatch(uiActions.timelinePlay());
  const stateAfterPlay = store.getState();
  assert(isTimelinePlaying(stateAfterPlay) === true, 'Timeline playing after TIMELINE_PLAY');

  store.dispatch(uiActions.timelinePause());
  const stateAfterPause = store.getState();
  assert(isTimelinePlaying(stateAfterPause) === false, 'Timeline paused after TIMELINE_PAUSE');

  // Test 7: Timeline progress update
  const testTime = new Date('2025-08-27T15:00:00Z');
  store.dispatch(uiActions.timelineUpdateProgress(0.5, testTime));
  const stateAfterProgress = store.getState();
  assert(stateAfterProgress.ui.timeline.progress === 0.5, 'Timeline progress updated to 0.5');
  assert(stateAfterProgress.ui.timeline.currentTime?.getTime() === testTime.getTime(), 'Timeline currentTime updated');

  // Test 8: Chart zoom
  const zoomDomain = [new Date('2025-08-27T14:00:00Z'), new Date('2025-08-27T15:00:00Z')];
  store.dispatch(uiActions.chartZoom(0, zoomDomain));
  const stateAfterZoom = store.getState();
  assert(stateAfterZoom.ui.charts.zoomDomains[0] !== undefined, 'Chart 0 zoom domain set');
  assert(stateAfterZoom.ui.charts.zoomDomains[0][0].getTime() === zoomDomain[0].getTime(), 'Zoom start time correct');

  // Test 9: Chart reset zoom
  store.dispatch(uiActions.chartResetZoom(0));
  const stateAfterReset = store.getState();
  assert(stateAfterReset.ui.charts.zoomDomains[0] === undefined, 'Chart 0 zoom domain removed');

  // Test 10: Subscription
  let subscriptionCalled = false;
  const unsubscribe = store.subscribe(() => {
    subscriptionCalled = true;
  });

  store.dispatch(selectionActions.selectChart(2));
  assert(subscriptionCalled === true, 'Subscription callback called on state change');

  unsubscribe();
  subscriptionCalled = false;
  store.dispatch(selectionActions.selectChart(3));
  assert(subscriptionCalled === false, 'Subscription callback not called after unsubscribe');

  // Test 11: Project selection resets flight
  store.dispatch(selectionActions.selectFlight(21, 'RF20'));
  store.dispatch(selectionActions.selectProject('CAESAR'));
  const stateAfterProject = store.getState();
  assert(stateAfterProject.selection.projectName === 'CAESAR', 'Project changed to CAESAR');
  assert(stateAfterProject.selection.flightId === null, 'Flight ID reset to null when project changes');

  // Summary
  console.log('\n%c=== Test Summary ===', 'color: #2196F3; font-size: 16px; font-weight: bold;');
  console.log(`%cTests Passed: ${testsPassed}`, 'color: #4CAF50; font-weight: bold;');
  console.log(`%cTests Failed: ${testsFailed}`, 'color: #F44336; font-weight: bold;');

  if (testsFailed === 0) {
    console.log('%c\n✓ All tests passed! Store is working correctly.', 'color: #4CAF50; font-size: 14px; font-weight: bold;');
  } else {
    console.log('%c\n✗ Some tests failed. Check implementation.', 'color: #F44336; font-size: 14px; font-weight: bold;');
  }

  return { testsPassed, testsFailed };
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  console.log('%cStore test module loaded. Run runStoreTests() to test the store.', 'color: #2196F3;');
}
