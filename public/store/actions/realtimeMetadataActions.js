// Fetch realtime variables (names)
export const fetchRealtimeVariables = (dbKey) => {
  return async (dispatch) => {
    dispatch({ type: types.REALTIME_FETCH_VARIABLES_REQUEST });
    try {
      const response = await fetch(`/api/realtime/variables?db=${encodeURIComponent(dbKey)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const variables = await response.json();
      dispatch({ type: types.REALTIME_FETCH_VARIABLES_SUCCESS, payload: { variables } });
    } catch (error) {
      dispatch({ type: types.REALTIME_FETCH_VARIABLES_FAILURE, payload: { error: error.message } });
    }
  };
};

// Fetch realtime variable metadata (long_name, units, category, etc)
export const fetchRealtimeVariableMetadata = (dbKey) => {
  return async (dispatch) => {
    try {
      const response = await fetch(`/api/realtime/variable-metadata?db=${encodeURIComponent(dbKey)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const metadata = await response.json();
      dispatch({ type: types.REALTIME_FETCH_METADATA_SUCCESS, payload: { metadata } });
    } catch (error) {
      // Optionally handle error
      console.error('[fetchRealtimeVariableMetadata] Error:', error);
    }
  };
};
