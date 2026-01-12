/**
 * Store Diagnostics
 * Run this in browser console to check store health
 * Usage: import('./store/diagnostics.js').then(m => m.runDiagnostics())
 */

export function runDiagnostics() {
  console.log('%c=== Store Diagnostics ===', 'color: #2196F3; font-size: 16px; font-weight: bold;');

  // Check if store exists
  if (!window.__STORE__) {
    console.error('❌ Store not found on window.__STORE__');
    return;
  }

  const store = window.__STORE__;
  console.log('✓ Store exists');

  // Check store methods
  const methods = ['getState', 'dispatch', 'subscribe'];
  methods.forEach(method => {
    if (typeof store[method] === 'function') {
      console.log(`✓ store.${method}() exists`);
    } else {
      console.error(`❌ store.${method}() missing`);
    }
  });

  // Get current state
  const state = store.getState();
  console.log('\n%c Current State:', 'color: #4CAF50; font-weight: bold;');
  console.log(state);

  // Check state structure
  const expectedKeys = ['metadata', 'selection', 'data', 'ui'];
  expectedKeys.forEach(key => {
    if (state[key]) {
      console.log(`✓ state.${key} exists`);
    } else {
      console.error(`❌ state.${key} missing`);
    }
  });

  // Check metadata
  console.log('\n%c Metadata:', 'color: #4CAF50; font-weight: bold;');
  console.log(`  Projects: ${state.metadata.projects.length}`);
  console.log(`  Variables: ${state.metadata.variables.length}`);
  console.log(`  Flights loaded for projects:`, Object.keys(state.metadata.flights));

  // Check selection
  console.log('\n%c Selection:', 'color: #4CAF50; font-weight: bold;');
  console.log(`  Project: ${state.selection.projectName}`);
  console.log(`  Flight ID: ${state.selection.flightId}`);
  console.log(`  Flight Number: ${state.selection.flightNumber}`);
  console.log(`  Selected Variables:`, state.selection.selectedVariables);

  // Check data
  console.log('\n%c Data:', 'color: #4CAF50; font-weight: bold;');
  const flightIds = Object.keys(state.data.flightData);
  console.log(`  Flights loaded: ${flightIds.length}`, flightIds.map(id => parseInt(id)));

  flightIds.forEach(id => {
    const fd = state.data.flightData[id];
    console.log(`  Flight ${id}:`);
    console.log(`    Timeseries points: ${fd.timeseries?.length || 0}`);
    console.log(`    Track points: ${fd.track?.length || 0}`);
    console.log(`    Loaded variables:`, Array.from(fd.loadedVariables || []));
  });

  // Check UI state
  console.log('\n%c UI State:', 'color: #4CAF50; font-weight: bold;');
  console.log(`  Timeline playing: ${state.ui.timeline.isPlaying}`);
  console.log(`  Timeline progress: ${(state.ui.timeline.progress * 100).toFixed(1)}%`);
  console.log(`  Radar enabled: ${state.ui.map.showRadar}`);

  // Check loading/errors
  console.log('\n%c Loading/Errors:', 'color: #4CAF50; font-weight: bold;');
  console.log('  Loading:', state.ui.loading);
  console.log('  Errors:', state.ui.errors);

  // Test dispatch
  console.log('\n%c Testing Dispatch:', 'color: #4CAF50; font-weight: bold;');
  try {
    store.dispatch({ type: '@@TEST', payload: 'test' });
    console.log('✓ Dispatch works');
  } catch (error) {
    console.error('❌ Dispatch error:', error);
  }

  console.log('\n%c=== Diagnostics Complete ===', 'color: #2196F3; font-size: 16px; font-weight: bold;');
}

// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.__STORE__) {
  console.log('%cStore diagnostics loaded. Call runDiagnostics() to check store health.', 'color: #2196F3;');
}
