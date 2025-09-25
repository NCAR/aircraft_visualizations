// Import necessary modules and functions
import LineChart from './modules/LineChart.js';
import { setSelectedChart, SELCHART, removeLineCharts, CHARTS } from './modules/LineChart.js';
import { loadData, fetchTimeseriesData, updateChartVariable } from './modules/loadData.js';
import { 
    PROJECT, 
    FLIGHT_ID, 
    MOVIE_FILENAME,
    fetchFlightList, 
    setFlight, 
    setProject, 
    OAP_VIS, 
    setOAP,
    getVariableMetadata,
    VARIABLE_METADATA,
    VARIABLES
} from './modules/chartselect.js';
import FlightMap from './modules/FlightMap.js';
import FlightMovie from './modules/FlightMovie.js';

// Initialize variables
let flightMap = new FlightMap('map', PROJECT, FLIGHT_ID);
let currentFlightId = FLIGHT_ID; // Store the current flight ID to avoid reinitializing
const flightMovie = new FlightMovie('myVideo', PROJECT);
//const oapImagery = new OAPImagery(PROJECT, FLIGHT);


// Fetch the list of available flights
fetchFlightList();

async function handleFlightChange(flightId, flightName = null) {
    console.log('handleFlightChange called with:', { flightId, flightName, currentFlightId });
    
    if (currentFlightId === flightId) {
        return; // Skip if the flight hasn't changed
    }
    currentFlightId = flightId; // Update the current flight
    if (flightName){
        setFlight(flightId, flightName);
    }
    console.log(flightId)
    flightMovie.updateVideoSource(flightId);

    try {
        const parsedData = await loadData(flightId,VARIABLES);
        if (!parsedData || parsedData.length === 0) {
            console.warn('No data loaded for flight:', flightId);
            return;
        }

        // Define default variables once
        const defaultVariables = [
            { cleanName: 'atx', displayName: 'Temperature' },
            { cleanName: 'wic', displayName: 'Wind Speed' },
            { cleanName: 'wdc', displayName: 'Wind Direction' },
            { cleanName: 'dpxc', displayName: 'Dew Point Temperature' }
        ];

        if (!CHARTS.length) {
            // ===================================
            // CHART CREATION (Initial Load)
            // ===================================
            console.log('Creating new charts...');
            
            defaultVariables.forEach((variable, index) => {
                const chartId = `#chart${index + 1}`;
                const metadata = getVariableMetadata(variable.cleanName);
                const units = metadata.units ? ` (${metadata.units})` : '';
                const long_name = metadata.long_name;

                console.log(`Creating chart ${index + 1} for variable:`, variable.cleanName);
                
                const chart = new LineChart(
                    chartId, 
                    "myVideo", 
                    parsedData, 
                    long_name,
                    index === 3 // Last chart gets special treatment
                );
                
                // setVariable handles the initial axis creation and drawing
                chart.setVariable(variable.cleanName, long_name);
                CHARTS.push(chart);
            });
            
            setSelectedChart(CHARTS[0]);

            // Initialize flight map
            if (flightMap) {
                flightMap.map.remove();
            }
            flightMap = new FlightMap('map', PROJECT,flightId);
            flightMap.addVideoEventListener('myVideo');
            flightMap.updateFlight(flightId);
            
            setTimeout(function(){
                if(flightMap && flightMap.map){
                    flightMap.map.invalidateSize();
                }
            }, 500);
            
        } else {
            // ===================================
            // CHART UPDATE (Flight Change)
            // ===================================
            console.log('Updating existing charts...');
            
            for (let i = 0; i < CHARTS.length && i < defaultVariables.length; i++) {
                const variableCleanName = defaultVariables[i].cleanName;
                const metadata = getVariableMetadata(variableCleanName);
                
                
                console.log(`Updating chart ${i + 1} with variable:`, variableCleanName);
                
                // 🛑 CORRECTED LINE: Use updateData for data replacement
                // updateData will call addNewData, which resets axes and redraws the line.
                // It takes the full data array and the variable's cleanName (e.g., 'atx').
                CHARTS[i].updateData(parsedData, variableCleanName,metadata.long_name); 
                
                // You only need to call initVideoSync if it was previously disconnected, 
                // but since it's already set up to listen for 'timeupdate' on the video 
                // in the chart constructor, it usually doesn't need to be re-initialized.
                // Keeping it here ensures the progress is reset for the new video/data length.
                CHARTS[i].initVideoSync(); 
            }
            
            // Update flight map
            if (flightMap) {
                flightMap.updateFlightData(flightId);
            }
            
            if (OAP_VIS && flightMap) {
                flightMap.OAP_imagery.getFilenames(flightName || flightId, 'F2DS');
                flightMap.OAP_imagery.getFilenames(flightName || flightId, 'HVPS');
            }
        }
        
    } catch (error) {
        console.error('Error loading flight data:', error);
    }
}

// Event listener for project selection change
document.getElementById('project-select').addEventListener('change', function() {
    const project = this.value;
    setProject(project);
    fetchFlightList();
    flightMap.setProject(project);
    flightMovie.setProject(project);
});
document.getElementById('variable-select').addEventListener('change', function() {
    const selectedVariable = this.value;
    console.log('Variable changed to:', selectedVariable);
    
    if (selectedVariable && SELCHART) {
        // Get the metadata for display
        const metadata = getVariableMetadata(selectedVariable);
        const displayName = metadata.long_name;

        // Update the selected chart with the new variable
        updateChartVariable(selectedVariable, SELCHART);
        
        // If we have current data, update the chart
        if (currentFlightId) {
            loadData(currentFlightId,[metadata.clean_name]).then(data => {
                SELCHART.updateData(data, metadata.clean_name,metadata.long_name);
            }).catch(error => {
                console.error('Error updating chart with new variable:', error);
            });
        }
    }
});
// Event listener for when flight data is fetched
document.addEventListener('flightFetched', async (event) => {
    await handleFlightChange(event.detail.flightId, event.detail.flight);
});

// Event listener for flight selection change
document.getElementById('flight-select').addEventListener('change', async function() {
    await handleFlightChange(this.value);
});

// Event listener for variable selection change to update the chart variable (no variable select currently)
// document.getElementById('variable-select').addEventListener('change', function() {
//     const selectedVariable = this.value;
//     updateChartVariable(selectedVariable, SELCHART);
// });

// Add event listeners to all chart elements for click and hover interactions
document.querySelectorAll('.line-chart').forEach(chart => {
    chart.addEventListener('click', handleChartClick);
    chart.addEventListener('mouseover', () => {
        chart.style.cursor = 'pointer'; // Change cursor to pointer on hover
    });
});