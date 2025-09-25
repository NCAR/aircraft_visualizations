// Import necessary modules and functions
import LineChart from './modules/LineChart.js';
import TimelineController from './modules/TimeLine.js';
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
let timelineController = null; // Declare the controller

// Initialize variables
let flightMap = new FlightMap('map', PROJECT, FLIGHT_ID);
let currentFlightId = FLIGHT_ID; // Store the current flight ID to avoid reinitializing
const flightMovie = new FlightMovie('myVideo', PROJECT);
//const oapImagery = new OAPImagery(PROJECT, FLIGHT);
const timeSlider = document.getElementById('time-slider');
const playPauseButton = document.getElementById('play-pause-button');
const timeDisplay = document.getElementById('current-time-display');

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
            flightMap = new FlightMap('map', PROJECT, currentFlightId);
            
            //const timeGaps = await fetchTimeGaps(currentFlightId); eventually when testing is done
            let timeGaps =(currentFlightId === 'rf09') ? 
                                          timelineController.parseTimeGaps(rf09Gaps) : 
                                          [];
            if (!timelineController) {
                // Initialize the controller the first time
                timelineController = new TimelineController(flightMap, flightMovie, timeGaps);
            } else {
                // Update the controller with the new components and gaps
                timelineController.flightMap = flightMap;
                timelineController.flightMovie = flightMovie;
                timelineController.timeGaps = timeGaps;
            }
            
            // Set the full data time range based on the loaded data
            timelineController.setTimelineRange(parsedData);
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
                CHARTS[i].updateProgress(0, parsedData[0].time); 
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

// ===================================
// 🛑 NEW: Add Timeline Control Listeners
// ===================================

// Convert minutes/seconds to HH:MM:SS format
function formatTime(date) {
    if (!date) return '00:00:00';
    // Use data time to calculate elapsed duration for display
    const durationMs = date.getTime() - timelineController.dataStartTime.getTime();
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(v => v < 10 ? "0" + v : v)
        .join(":");
}

// 🛑 Slider Input (User dragging the slider)
timeSlider.addEventListener('input', function() {
    if (!timelineController || !timelineController.dataStartTime) return;

    const totalDurationMs = timelineController.dataEndTime.getTime() - timelineController.dataStartTime.getTime();
    
    // Calculate the percentage position based on slider value (0-1000)
    const normalizedValue = parseFloat(this.value) / 1000;
    
    // Calculate the new time point in milliseconds
    const seekTimeMs = timelineController.dataStartTime.getTime() + (totalDurationMs * normalizedValue);
    const newTime = new Date(seekTimeMs);

    // Pause the playback while seeking
    timelineController.stop(); 
    
    // Update the controller, which syncs charts and map
    timelineController.seekToTime(newTime); 
    
    timeDisplay.textContent = formatTime(newTime);
});

// 🛑 Play/Pause Button
playPauseButton.addEventListener('click', function() {
    if (!timelineController) return;

    if (timelineController.isRunning) {
        timelineController.stop();
        playPauseButton.textContent = '▶';
    } else {
        timelineController.start();
        playPauseButton.textContent = '⏸';
    }
});