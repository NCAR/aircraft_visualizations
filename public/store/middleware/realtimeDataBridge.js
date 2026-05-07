/**
 * Realtime Data Bridge Middleware
 * Bridges realtime data to the format expected by the dashboard charts
 */

import * as types from '../actions/actionTypes.js';

const REALTIME_FLIGHT_ID = 'REALTIME';

function dispatchFlightData(store) {
	const state = store.getState();
	const rt = state.realtime;
	if (!rt?.data?.length) return;

	const timeseries = rt.data.map(row => ({
		Time: new Date(row.datetime),
		...row
	}));

	const dataKeys = Object.keys(rt.data[0] || {}).filter(k => k !== 'datetime');

	const times = timeseries.map(d => d.Time.getTime());
	const timeRange = {
		start: new Date(Math.min(...times)),
		end: new Date(Math.max(...times))
	};

	store.dispatch({
		type: types.FETCH_FLIGHT_DATA_SUCCESS,
		payload: {
			flightId: REALTIME_FLIGHT_ID,
			timeseries,
			track: [],
			timeRange,
			variables: dataKeys
		}
	});

	store.dispatch({
		type: types.SELECT_FLIGHT,
		payload: {
			flightId: REALTIME_FLIGHT_ID,
			flightNumber: undefined
		}
	});
}

export function realtimeDataBridge(store) {
	return (next) => (action) => {
		const result = next(action);

		if (
			action.type === types.REALTIME_FETCH_DATA_SUCCESS ||
			action.type === types.REALTIME_SSE_DATA_RECEIVED
		) {
			dispatchFlightData(store);
		}

		return result;
	};
}
