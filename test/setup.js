/**
 * Jest global setup
 * Runs after the test framework is installed in the environment
 */

// Suppress console.log in tests to keep output clean.
// Use console.warn/error for things that should still be visible.
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
