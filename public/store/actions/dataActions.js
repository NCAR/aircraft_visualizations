/**
 * Data action creators
 * Handle fetching and caching flight data (timeseries and track)
 */

import * as types from './actionTypes.js';

// ========================================
// Flight Data Actions
// ========================================

export const fetchFlightDataRequest = (flightId) => ({
  type: types.FETCH_FLIGHT_DATA_REQUEST,
  payload: { flightId }
});

export const fetchFlightDataSuccess = (flightId, timeseries, track, timeRange, variables) => ({
  type: types.FETCH_FLIGHT_DATA_SUCCESS,
  payload: { flightId, timeseries, track, timeRange, variables }
});

export const fetchFlightDataFailure = (flightId, error) => ({
  type: types.FETCH_FLIGHT_DATA_FAILURE,
  payload: { flightId, error }
});

/**
 * Async action to fetch flight data with caching
 * Only fetches variables that haven't been loaded yet
 * @param {number} flightId - Flight ID
 * @param {Array<string>} variables - Array of variable names to fetch
 * @param {number} limit - Maximum number of data points (default: 100000 for full flights)
 * @returns {Function} Thunk function
 */
export const fetchFlightData = (flightId, variables, limit = 100000) => {
  return async (dispatch, getState) => {
    if (!flightId || !variables || variables.length === 0) {
      console.warn('[fetchFlightData] Invalid parameters:', { flightId, variables });
      return;
    }

    dispatch(fetchFlightDataRequest(flightId));

    try {
      // Check cache - only fetch variables not already loaded
      const existingData = getState().data.flightData[flightId];
      const loadedVars = existingData?.loadedVariables || new Set();
      const varsToLoad = variables.filter(v => !loadedVars.has(v));

      if (varsToLoad.length === 0 && existingData?.timeseries && existingData?.track) {
        console.log('[fetchFlightData] Data already cached for flight', flightId);
        return;
      }

      console.log('[fetchFlightData] Fetching data for flight', flightId, 'variables:', varsToLoad);

      // Fetch timeseries and track in parallel
      const promises = [];

      // Only fetch timeseries if we have variables to load
      if (varsToLoad.length > 0) {
        const variableString = varsToLoad.join(',');
        promises.push(
          fetch(`/api/flights/${flightId}/timeseries?variables=${variableString}&limit=${limit}`)
            .then(response => {
              if (!response.ok) throw new Error(`Timeseries HTTP ${response.status}`);
              return response.json();
            })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      // Only fetch track if not already loaded
      if (!existingData?.track) {
        promises.push(
          fetch(`/api/flights/${flightId}/track?limit=${limit}`)
            .then(response => {
              if (!response.ok) throw new Error(`Track HTTP ${response.status}`);
              return response.json();
            })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      const [timeseriesResponse, trackResponse] = await Promise.all(promises);

      console.log('[fetchFlightData] Raw responses:', {
        timeseriesType: timeseriesResponse ? (Array.isArray(timeseriesResponse) ? 'array' : 'object') : 'null',
        timeseriesHasData: timeseriesResponse?.data ? true : false,
        timeseriesIsArray: Array.isArray(timeseriesResponse),
        trackType: trackResponse ? (Array.isArray(trackResponse) ? 'array' : 'object') : 'null',
        trackHasData: trackResponse?.data ? true : false,
        trackIsArray: Array.isArray(trackResponse)
      });

      // Process timeseries data
      let timeseries = existingData?.timeseries || [];
      if (timeseriesResponse) {
        // Handle both API response formats: {data: [...]} or [...]
        const rawData = timeseriesResponse.data || timeseriesResponse;

        if (Array.isArray(rawData) && rawData.length > 0) {
          const processedTimeseries = rawData.map(entry => ({
            ...entry,
            Time: new Date(entry.time),
            flight_id: entry.flight_id || flightId
          }));

          // Merge with existing timeseries if present
          if (existingData?.timeseries) {
            // Create a map for efficient merging
            const timeseriesMap = new Map(existingData.timeseries.map(entry => [entry.Time.getTime(), entry]));

            // Merge new data
            processedTimeseries.forEach(entry => {
              const existing = timeseriesMap.get(entry.Time.getTime());
              if (existing) {
                // Merge properties
                Object.assign(existing, entry);
              } else {
                timeseriesMap.set(entry.Time.getTime(), entry);
              }
            });

            // Convert back to array and sort by time
            timeseries = Array.from(timeseriesMap.values()).sort((a, b) => a.Time - b.Time);
          } else {
            timeseries = processedTimeseries;
          }
        } else {
          console.warn('[fetchFlightData] Timeseries response has no data array');
        }
      }

      // Process track data
      let track = existingData?.track || [];
      if (trackResponse) {
        // Handle both API response formats: {data: [...]} or [...]
        const rawTrack = trackResponse.data || trackResponse;

        if (Array.isArray(rawTrack) && rawTrack.length > 0) {
          track = rawTrack.map(entry => ({
            ...entry,
            Time: new Date(entry.time)
          }));
        } else {
          console.warn('[fetchFlightData] Track response has no data array');
        }
      }

      // Calculate time range
      let timeRange = existingData?.timeRange;
      if (timeseries.length > 0) {
        timeRange = {
          start: timeseries[0].Time,
          end: timeseries[timeseries.length - 1].Time
        };
      }

      console.log('[fetchFlightData] Fetched data:', {
        flightId,
        timeseriesLength: timeseries.length,
        trackLength: track.length,
        timeRange,
        newVariables: varsToLoad
      });

      dispatch(fetchFlightDataSuccess(flightId, timeseries, track, timeRange, varsToLoad));

    } catch (error) {
      console.error('[fetchFlightData] Error:', error);
      dispatch(fetchFlightDataFailure(flightId, error.message));
    }
  };
};
