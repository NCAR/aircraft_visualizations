import { variableDataSources,FLIGHT_ID, PROJECT, getVariableMetadata } from './chartselect.js';
const SERVER_PORT = 3000;
// Function to fetch flight data
// Fetch timeseries data for plotting
export async function fetchTimeseriesData(variables, limit = 5000) {
    if (!FLIGHT_ID) {
        throw new Error('No flight selected');
    }
    
    console.log('fetchTimeseriesData called with:', {
        variables,
        flightId: FLIGHT_ID, // Renamed for clarity
        limit
    });
    
    try {
        const variableString = Array.isArray(variables) ? variables.join(',') : variables;
        // Use the simplified API structure: /api/flights/{flightId}/timeseries
        const url = `/api/flights/${encodeURIComponent(FLIGHT_ID)}/timeseries?variables=${encodeURIComponent(variableString)}&limit=${limit}`;
        
        console.log('Fetching from URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Fetched timeseries data:', result);
        
        return result;
        
    } catch (error) {
        console.error('Error fetching timeseries data:', error);
        throw error;
    }
}

// Update fetchFlightTrack function
export async function fetchFlightTrack(limit = 5000) {
    if (!FLIGHT_ID) {
        throw new Error('No flight selected');
    }
    
    try {
        // Use the simplified API structure: /api/flights/{flightId}/track
        const url = `/api/flights/${encodeURIComponent(FLIGHT_ID)}/track?limit=${limit}`;
        console.log('Fetching track from URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const trackData = await response.json();
        console.log('Fetched flight track:', trackData);
        
        return trackData;
        
    } catch (error) {
        console.error('Error fetching flight track:', error);
        throw error;
    }
}

// Function to load and process data
// Updated loadData function to use new API structure
export async function loadData(variables = null, limit = 5000) {
    
    if (!FLIGHT_ID) {
        throw new Error('No flight ID provided or selected');
    }
    
    try {
        // Use the simplified API structure
        const result = await fetchTimeseriesData(variables, limit);
        const data = result.data || result; // Handle both API response formats
        
        // Process data to match expected format for existing charts
        const parsedData = data.map(entry => {
            // Convert time (which is a string from JSON) to a Date object, mapping it to 'Time'
            const processedEntry = {
                ...entry,
                Time: entry.time instanceof Date ? entry.time : new Date(entry.time)
            };
            
            // Handle null values and -32767 (missing data indicator)
            // This logic ensures all variable columns are correctly parsed as numbers or set to null
            Object.keys(processedEntry).forEach(key => {
                if (key !== 'Time' && key !== 'flight_id' && key !== 'time') {
                    let value = processedEntry[key];
                    if (value === -32767 || 
                        value === null || 
                        value === undefined ||
                        value === '' ||
                        isNaN(value) ||
                        !isFinite(value)) {
                        processedEntry[key] = null;
                    } else if (typeof value === 'string') {
                        const numValue = +value;
                        processedEntry[key] = isNaN(numValue) ? null : numValue;
                    } else {
                        // Ensure it's a proper number
                        processedEntry[key] = Number(value);
                    }
                }
            });
            
            return processedEntry;
        });
        
        console.log('Processed data:', parsedData);
        return parsedData;
        
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// Updated function to work with variable metadata from database
export function updateChartVariable(variable, selChart) {
    // First try to find in legacy mapping
    let baseFileName = variableDataSources[variable];
    
    // If not found in legacy mapping, try to use the variable directly
    if (!baseFileName) {
        // Get metadata for the variable
        const metadata = getVariableMetadata(variable);
        if (metadata) {
            baseFileName = metadata.clean_name;
        } else {
            baseFileName = variable; // Fallback to using variable name directly
        }
    }
    
    if (baseFileName) {
        if (selChart) {
            selChart.setVariable(variable, baseFileName);
        } else {
            console.error('No chart selected');
        }
    } else {
        console.error('Data source not found for variable:', variable);
    }
}

export async function loadPostgresData() {
    try {
        const response = await fetch(`http://localhost:${SERVER_PORT}/data`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S.%LZ"); // Adjusted for your time format
        const parsedData = data.map(entry => ({
            ...entry, // Spread the existing properties
            Time: parseTime(entry.datetime) // Convert the Time field to a Date object
        }));

        console.log(parsedData); // Log the parsed data for debugging
        return parsedData;
    } catch (error) {
        console.error('Error loading data from PostgreSQL:', error);
        throw error;
    }
}

// New function to get processed data for specific variables
export async function getVariableData(variables, flightId = null, limit = 5000) {
    try {
        const data = await loadData(variables, limit);
        
        // Filter to only include requested variables plus Time
        if (variables && Array.isArray(variables)) {
            return data.map(entry => {
                const filteredEntry = { Time: entry.Time };
                variables.forEach(variable => {
                    filteredEntry[variable] = entry[variable];
                });
                return filteredEntry;
            });
        }
        
        return data;
        
    } catch (error) {
        console.error('Error getting variable data:', error);
        throw error;
    }
}

// Helper function to get data extent for scaling charts
export function getDataExtent(data, variable) {
    const values = data
        .map(d => d[variable])
        .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (values.length === 0) return [0, 1];
    
    return d3.extent(values);
}

// Helper function to check if variable has data
export function hasValidData(data, variable) {
    return data.some(d => {
        const value = d[variable];
        return value !== null && value !== undefined && !isNaN(value);
    });
}