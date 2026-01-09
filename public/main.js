// Import necessary modules and functions
import LineChart from './modules/LineChart.js';
import TimelineController from './modules/TimeLine.js';
import { setSelectedChart, SELCHART, removeLineCharts, CHARTS, CHARTS_SVG } from './modules/LineChart.js';
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
    console.log('handleFlightChange called with:', { flightId, flightName, flightIdType: typeof flightId, currentFlightId });
    
    // Convert string to number if needed
    const numericFlightId = parseInt(flightId, 10);
    console.log('After parsing:', { originalFlightId: flightId, numericFlightId, currentFlightId, compare: currentFlightId === numericFlightId });
    
    if (currentFlightId === numericFlightId) {
        console.log('Flight unchanged, skipping...');
        return; // Skip if the flight hasn't changed
    }
    currentFlightId = numericFlightId; // Update the current flight
    if (flightName){
        setFlight(numericFlightId, flightName);
    }
    console.log('Loading data for flightId:', numericFlightId);
    flightMovie.updateVideoSource(numericFlightId);
    try {
        const parsedData = await loadData(numericFlightId, VARIABLES);
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
        if (CHARTS.length > 0)  {
            // Delete existing charts and recreate them
            console.log('Clearing charts for new flight...');
            
            removeLineCharts(CHARTS);
            CHARTS_SVG.length = 0; // Also clear SVG array
        }
        if (CHARTS.length === 0) {
            // ===================================
            // CHART CREATION (Initial Load)
            // ===================================
            console.log('Creating new charts...');

            // Clear any orphaned DOM elements
            const chartContainers = ["#chart1", "#chart2", "#chart3", "#chart4"];
            chartContainers.forEach(container => {
                const element = document.querySelector(container);
                if (element) {
                    element.innerHTML = '';
                }
            });

            defaultVariables.forEach((variable, index) => {
                const chartId = `#chart${index + 1}`;
                const metadata = getVariableMetadata(variable.cleanName);

                if (!metadata) {
                    console.error(`No metadata found for variable: ${variable.cleanName}`);
                    return;
                }

                const long_name = metadata.long_name || variable.displayName;

                console.log(`Creating chart ${index + 1} for variable:`, variable.cleanName);

                // LineChart constructor automatically adds to CHARTS array
                // Parameters: selector, videoId, data, name, showXLabel, timeline
                const chart = new LineChart(
                    chartId,
                    "myVideo",
                    parsedData,
                    long_name,
                    index === 3, // Last chart shows X-axis labels
                    true         // Enable timeline control
                );

                // setVariable handles the initial axis creation and drawing
                chart.setVariable(variable.cleanName, long_name);
            });

            // Set first chart as selected
            if (CHARTS.length > 0) {
                setSelectedChart(CHARTS[0]);
            }

            // Initialize flight map
            if (flightMap) {
                flightMap.map.remove();
            }
            flightMap = new FlightMap('map', PROJECT, currentFlightId);
            
            // Note: Gap handling disabled for now - hardcoded gaps don't match actual data
            // In future, fetch gaps from API: const timeGaps = await fetchTimeGaps(currentFlightId);
            if (!timelineController) {
                // Initialize the controller the first time
                timelineController = new TimelineController(flightMap, flightMovie, currentFlightId);
            } else {
                // Update the controller with the new components
                timelineController.flightMap = flightMap;
                timelineController.flightMovie = flightMovie;
            }
            
            // Set the full data time range based on the loaded data
            timelineController.setTimelineRange(parsedData);
            flightMap.updateFlight(flightId);
            
            setTimeout(function(){
                if(flightMap && flightMap.map){
                    flightMap.map.invalidateSize();
                }
            }, 500);
            
        } 
        
    } catch (error) {
        console.error('Error loading flight data:', error);
    }
}

// Event listener for project selection change
const projectSelect = document.getElementById('project-select');
if (projectSelect) {
    projectSelect.addEventListener('change', async function() {
        const project = this.value;
        console.log('Project changed to:', project);

        // Clean up existing charts when switching projects
        if (CHARTS.length > 0) {
            console.log('Cleaning up existing charts...');
            removeLineCharts(CHARTS);
            CHARTS_SVG.length = 0; // Also clear SVG array
        }

        // Reset current flight ID to force reload
        currentFlightId = null;

        // Update project in state
        setProject(project);

        // Update components with new project
        if (flightMap) {
            flightMap.setProject(project);
        }
        flightMovie.setProject(project);

        // Fetch new flight list for this project
        await fetchFlightList();
    });
} else {
    console.error('project-select element not found');
}

// Event listener for variable selection change
const variableSelect = document.getElementById('variable-select');
if (variableSelect) {
    variableSelect.addEventListener('change', function() {
        const selectedVariable = this.value;
        console.log('Variable changed to:', selectedVariable);

        if (selectedVariable && SELCHART) {
            // Get the metadata for display
            const metadata = getVariableMetadata(selectedVariable);

            if (!metadata) {
                console.error(`No metadata found for variable: ${selectedVariable}`);
                return;
            }

            const displayName = metadata.long_name;

            // Update the selected chart with the new variable
            updateChartVariable(selectedVariable, SELCHART);

            // If we have current data, update the chart
            if (currentFlightId) {
                loadData(currentFlightId, [metadata.clean_name]).then(data => {
                    if (data && data.length > 0) {
                        SELCHART.updateData(data, metadata.clean_name, metadata.long_name);
                    } else {
                        console.warn('No data returned for variable:', selectedVariable);
                    }
                }).catch(error => {
                    console.error('Error updating chart with new variable:', error);
                });
            }
        }
    });
} else {
    console.warn('variable-select element not found');
}
// Event listener for when flight data is fetched
document.addEventListener('flightFetched', async (event) => {
    if (event.detail && event.detail.flightId) {
        await handleFlightChange(event.detail.flightId, event.detail.flight);
    } else {
        console.error('flightFetched event missing flight data');
    }
});

// Event listener for flight selection change
const flightSelect = document.getElementById('flight-select');
if (flightSelect) {
    flightSelect.addEventListener('change', async function() {
        console.log('[Flight Selection] Dropdown changed to:', {
            selectedValue: this.value,
            selectedText: this.options[this.selectedIndex].text,
            valueType: typeof this.value
        });
        await handleFlightChange(this.value);
    });
} else {
    console.error('flight-select element not found');
}

// Event listener for variable selection change to update the chart variable (no variable select currently)
// document.getElementById('variable-select').addEventListener('change', function() {
//     const selectedVariable = this.value;
//     updateChartVariable(selectedVariable, SELCHART);
// });

// Function to handle chart click events
function handleChartClick(event) {
    // Remove 'selected' class from all charts
    document.querySelectorAll('.line-chart').forEach(c => {
        c.classList.remove('selected');
    });

    // Add 'selected' class to the clicked chart
    const clickedChart = event.target.closest('.line-chart');
    if (clickedChart) {
        clickedChart.classList.add('selected');
    }
}

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
    if (!date || !timelineController || !timelineController.dataStartTime) {
        return '00:00:00';
    }

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

// Track whether timeline was playing before slider interaction
let wasPlayingBeforeSeek = false;

// 🛑 Slider Input (User dragging the slider)
timeSlider.addEventListener('input', function() {
    if (!timelineController || !timelineController.dataStartTime) return;

    // Remember play state only on first input event (start of drag)
    if (timelineController.isRunning && !wasPlayingBeforeSeek) {
        wasPlayingBeforeSeek = true;
    }

    const totalDurationMs = timelineController.dataEndTime.getTime() - timelineController.dataStartTime.getTime();
    
    // Calculate the percentage position based on slider value (0-1000)
    const normalizedValue = parseFloat(this.value) / 1000;
    
    // Calculate the new time point in milliseconds
    const seekTimeMs = timelineController.dataStartTime.getTime() + (totalDurationMs * normalizedValue);
    const newTime = new Date(seekTimeMs);

    // Pause the playback while seeking
    if (timelineController.isRunning) {
        timelineController.stop(); 
    }
    
    // Update the controller, which syncs charts and map
    timelineController.seekToTime(newTime); 
    
    timeDisplay.textContent = formatTime(newTime);
});

// 🛑 Slider Change (User releases the slider)
timeSlider.addEventListener('change', function() {
    if (!timelineController || !timelineController.dataStartTime) return;

    // Resume playback if it was playing before
    if (wasPlayingBeforeSeek) {
        timelineController.start();
        playPauseButton.textContent = '⏸';
        wasPlayingBeforeSeek = false;
    }
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