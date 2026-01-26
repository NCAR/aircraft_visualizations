/**
 * Realtime data action creators
 * Handle real-time flight data from C130 and GV aircraft
 */

import * as types from './actionTypes.js';

// ========================================
// Database Selection
// ========================================

/**
 * Set the current realtime database
 * @param {string} database - Database key ('C130' or 'GV')
 */
export const setRealtimeDatabase = (database) => ({
  type: types.REALTIME_SET_DATABASE,
  payload: { database }
});

/**
 * Switch realtime database (thunk)
 * @param {string} database - Database key ('C130' or 'GV')
 */
export const switchRealtimeDatabase = (database) => async (dispatch, getState) => {
  try {
    // Update server-side current database
    const response = await fetch('/api/realtime/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ database })
    });

    if (!response.ok) {
      throw new Error('Failed to switch database');
    }

    // Update local state
    dispatch(setRealtimeDatabase(database));

    // Clear existing data
    dispatch({ type: types.REALTIME_CLEAR_DATA });

    // Fetch new data for the selected database
    dispatch(fetchRealtimeVariables());

  } catch (error) {
    console.error('[realtimeActions] Error switching database:', error);
  }
};

// ========================================
// Variables
// ========================================

/**
 * Fetch available realtime variables (thunk)
 */
export const fetchRealtimeVariables = () => async (dispatch, getState) => {
  dispatch({ type: types.REALTIME_FETCH_VARIABLES_REQUEST });

  try {
    const state = getState();
    const db = state.realtime?.currentDatabase || 'C130';

    // Fetch variables and metadata in parallel
    const [varsResponse, metaResponse] = await Promise.all([
      fetch(`/api/realtime/variables?db=${db}`),
      fetch(`/api/realtime/variable-metadata?db=${db}`)
    ]);

    if (!varsResponse.ok) {
      throw new Error('Failed to fetch variables');
    }

    const variables = await varsResponse.json();

    // Filter out datetime
    const filteredVariables = variables.filter(v => v !== 'datetime');

    dispatch({
      type: types.REALTIME_FETCH_VARIABLES_SUCCESS,
      payload: { variables: filteredVariables }
    });

    // Handle metadata if successful
    if (metaResponse.ok) {
      const metadata = await metaResponse.json();
      dispatch({
        type: types.REALTIME_FETCH_METADATA_SUCCESS,
        payload: { metadata }
      });
    }

    console.log('[realtimeActions] Fetched', filteredVariables.length, 'variables');

  } catch (error) {
    console.error('[realtimeActions] Error fetching variables:', error);
    dispatch({
      type: types.REALTIME_FETCH_VARIABLES_FAILURE,
      payload: { error: error.message }
    });
  }
};

// ========================================
// Variable Selection
// ========================================

/**
 * Set selected realtime variables
 * @param {Array<string>} variables - Array of variable names
 */
export const setRealtimeSelectedVariables = (variables) => ({
  type: types.REALTIME_SET_SELECTED_VARIABLES,
  payload: { variables }
});

/**
 * Add a variable to selection
 * @param {string} variable - Variable name
 */
export const addRealtimeVariable = (variable) => ({
  type: types.REALTIME_ADD_VARIABLE,
  payload: { variable }
});

/**
 * Remove a variable from selection
 * @param {string} variable - Variable name
 */
export const removeRealtimeVariable = (variable) => ({
  type: types.REALTIME_REMOVE_VARIABLE,
  payload: { variable }
});

// ========================================
// Data Fetching
// ========================================

/**
 * Fetch realtime data (thunk)
 * @param {Object} options - Fetch options
 * @param {string} [options.after] - ISO timestamp to fetch data after (incremental)
 * @param {number} [options.limit] - Maximum records to fetch
 */
export const fetchRealtimeData = (options = {}) => async (dispatch, getState) => {
  const state = getState();
  const db = state.realtime?.currentDatabase || 'C130';

  // Get selected variables from chart configs
  const chartConfigs = state.ui?.charts?.realtime?.configs || {};
  const selectedVars = new Set();

  // Collect all variables from all chart configs
  Object.values(chartConfigs).forEach(config => {
    if (config?.variables) {
      config.variables.forEach(v => selectedVars.add(v.key));
    }
  });

  // If no variables selected, use all available variables
  const varsToFetch = selectedVars.size > 0
    ? Array.from(selectedVars)
    : (state.realtime?.variables || ['tasx']);

  // Always include position variables for the map
  const positionVars = ['gglat', 'gglon', 'thdg'];
  const allVars = [...new Set(['datetime', ...positionVars, ...varsToFetch])];

  console.log('[realtimeActions] Fetching data for variables:', allVars);

  dispatch({ type: types.REALTIME_FETCH_DATA_REQUEST });

  try {
    // Build query params
    const params = new URLSearchParams();
    params.set('db', db);
    params.set('vars', allVars.join(','));

    if (options.after) {
      params.set('after', options.after);
    }
    if (options.limit) {
      params.set('limit', options.limit);
    }

    const response = await fetch(`/api/realtime/data?${params}`);

    if (!response.ok) {
      throw new Error('Failed to fetch realtime data');
    }

    const data = await response.json();

    // Process data - parse dates and handle missing values
    const processedData = data.map(row => {
      const processed = { ...row };

      // Parse datetime
      if (processed.datetime) {
        processed.datetime = new Date(processed.datetime);
      }

      // Handle missing values (-32767)
      selectedVars.forEach(varName => {
        if (processed[varName] === -32767) {
          processed[varName] = null;
        }
      });

      return processed;
    });

    // Calculate time range
    let timeRange = null;
    if (processedData.length > 0) {
      timeRange = {
        start: processedData[0].datetime,
        end: processedData[processedData.length - 1].datetime
      };
    }

    dispatch({
      type: types.REALTIME_FETCH_DATA_SUCCESS,
      payload: {
        data: processedData,
        timeRange,
        isIncremental: !!options.after
      }
    });

    console.log('[realtimeActions] Fetched', processedData.length, 'records');

    return processedData;

  } catch (error) {
    console.error('[realtimeActions] Error fetching data:', error);
    dispatch({
      type: types.REALTIME_FETCH_DATA_FAILURE,
      payload: { error: error.message }
    });
  }
};

// ========================================
// Auto Update
// ========================================

/**
 * Set auto-update state
 * @param {boolean} enabled - Whether auto-update is enabled
 */
export const setRealtimeAutoUpdate = (enabled) => ({
  type: types.REALTIME_SET_AUTO_UPDATE,
  payload: { enabled }
});

/**
 * Clear realtime data
 */
export const clearRealtimeData = () => ({
  type: types.REALTIME_CLEAR_DATA
});
