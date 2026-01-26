/**
 * Realtime Data Bridge Middleware
 * Bridges realtime data to the format expected by the dashboard charts
 */

import * as types from '../actions/actionTypes.js';

const REALTIME_FLIGHT_ID = 'REALTIME';

export function realtimeDataBridge(store) {
	return (next) => (action) => {
		const result = next(action);

		// When realtime data arrives, publish it as a flight data set
		if (action.type === types.REALTIME_FETCH_DATA_SUCCESS) {
			const state = store.getState();
			const rt = state.realtime;
			if (rt && rt.data && rt.data.length > 0) {
				const timeseries = rt.data.map(row => ({
					Time: new Date(row.datetime),
					...row
				}));

				// Get actual variables present in the data (not all available variables)
				const dataKeys = Object.keys(rt.data[0] || {}).filter(k => k !== 'datetime');
				console.log('[realtimeDataBridge] Data contains variables:', dataKeys);
				console.log('[realtimeDataBridge] All available variables:', rt.variables);

				const times = timeseries.map(d => d.Time.getTime());
				const timeRange = {
					start: new Date(Math.min(...times)),
					end: new Date(Math.max(...times))
				};

				// Dispatch as flight data for chart consumption
				store.dispatch({
					type: types.FETCH_FLIGHT_DATA_SUCCESS,
					payload: {
						flightId: REALTIME_FLIGHT_ID,
						timeseries,
						track: [],
						timeRange,
						variables: dataKeys // Only variables actually in the data
					}
				});

				// Select the realtime flight for chart readers
				store.dispatch({
					type: types.SELECT_FLIGHT,
					payload: {
						flightId: REALTIME_FLIGHT_ID,
						flightNumber: undefined
					}
				});
			}
		}

		return result;
	};
}
