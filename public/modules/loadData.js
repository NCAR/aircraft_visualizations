import { variableDataSources } from './chartselect.js';
// Function to fetch flight data
export async function fetchFlightData(project, flight) {
    try {
        const response = await fetch(`/api/flight-data/${project}/${flight}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching flight data:', error);
        throw error;
    }
}

export async function fetchFlightTrack(project, flight) {
    try {
        const response = await fetch(`/api/flight-track/${project}/${flight}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching flight data:', error);
        throw error;
    }
}
// Function to load and process data
export async function loadData(project, flight) {
    try {
        const data = await fetchFlightData(project, flight);
        const timeArray = data.coords.Time.data;
        const dataArray = data.data_vars;
        const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
        const parsedData = timeArray.map((time, index) => {
            const entry = { Time: parseTime(time) };
            for (const variable in dataArray) {
                let value = +dataArray[variable].data[index];
                if (isNaN(value) || value === -32767) {
                    value = null; // Replace -32767 with null
                }
                entry[variable] = value;
            }
            return entry;
        });
        return parsedData;
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

export function updateChartVariable(variable, selChart) {
    const baseFileName = variableDataSources[variable];
    if (baseFileName) {
        if (selChart) {
        selChart.setVariable(variable);
        } else {
        console.error('No chart selected');
        }
    } else {
        console.error('Data source not found for variable:', variable);
    }
    }
