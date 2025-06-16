// Import necessary modules and functions
import LineChart from './modules/LineChart.js';
import { setSelectedChart, SELCHART, removeLineCharts, CHARTS } from './modules/LineChart.js';
import { loadData, updateChartVariable } from './modules/loadData.js';
import { PROJECT, FLIGHT, variableDataSources, fetchFlightList, setFlight, setProject, OAP_VIS, setOAP } from './modules/chartselect.js';
import FlightMap from './modules/FlightMap.js';
import FlightMovie from './modules/FlightMovie.js';
//import OAPImagery from './modules/OAPImagery.js';

// Initialize variables
let flightMap;
let currentFlight = null; // Store the current flight to avoid reinitializing
const flightMovie = new FlightMovie('myVideo', PROJECT);
//const oapImagery = new OAPImagery(PROJECT, FLIGHT);


// Fetch the list of available flights
fetchFlightList();
// Function to handle flight data loading and chart updates
async function handleFlightChange(flight) {
    if (currentFlight === flight) {
        return; // Skip if the flight hasn't changed
    }
    currentFlight = flight; // Update the current flight
    setFlight(flight);
    flightMovie.updateVideoSource(flight);

    try {
        const parsedData = await loadData(PROJECT, flight);

        if (!CHARTS.length) {
            // Create new line charts if they don't exist
            CHARTS.push(new LineChart("#chart1", "myVideo", parsedData, 'Temperature'));
            CHARTS.push(new LineChart("#chart2", "myVideo", parsedData, "Wind Speed"));
            CHARTS.push(new LineChart("#chart3", "myVideo", parsedData, "Wind Direction"));
            CHARTS.push(new LineChart("#chart4", "myVideo", parsedData, "Dew Point Temperature", true));
            setSelectedChart(CHARTS[0]);

            if (flightMap) {
                flightMap.map.remove();
            }
            flightMap = new FlightMap('map', PROJECT, flight);
            flightMap.addVideoEventListener('myVideo');
            flightMap.updateFlight(flight);
            //oapImagery.updateFlight(flight);
            setTimeout(function(){
                if(flightMap && flightMap.map){
                    flightMap.map.invalidateSize();
                }
            }, 500);
        } else {
            // Update existing charts with new data
            let count = 0;
            for (const long_name in variableDataSources) {
                if (count < CHARTS.length) {
                    CHARTS[count].setVariable(long_name);
                    CHARTS[count].updateData(parsedData, long_name);
                    CHARTS[count].initVideoSync();
                    count++;
                } else {
                    console.log('Udated chart:', long_name);
                }
            }
            flightMap.updateFlight(flight);
            if (OAP_VIS) {
                flightMap.OAP_imagery.getFilenames(flight, 'F2DS');
                flightMap.OAP_imagery.getFilenames(flight, 'HVPS');
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

// Event listener for when flight data is fetched
document.addEventListener('flightFetched', async (event) => {
    await handleFlightChange(event.detail.flight);
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