// Import necessary modules and functions
import LineChart from './modules/LineChart.js';
import { setSelectedChart, SELCHART, removeLineCharts } from './modules/LineChart.js';
import { loadData, updateChartVariable } from './modules/loadData.js';
import { PROJECT, FLIGHT, variableDataSources, fetchFlightList, setFlight, setProject, OAP_VIS, setOAP } from './modules/chartselect.js';
import FlightMap from './modules/FlightMap.js';
import FlightMovie from './modules/FlightMovie.js';
//import OAPImagery from './modules/OAPImagery.js';

// Initialize variables
let charts = [];
let flightMap;
const flightMovie = new FlightMovie('myVideo', PROJECT);
//const oapImagery = new OAPImagery(PROJECT, FLIGHT);


// Fetch the list of available flights
fetchFlightList();

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
    const flight = event.detail.flight;
    setFlight(flight);
    removeLineCharts(charts);

    try {
        const parsedData = await loadData(PROJECT, flight);

        // Create new line charts with the loaded data
        charts.push(new LineChart("#chart1", "myVideo", parsedData, 'Temperature'));
        charts.push(new LineChart("#chart2", "myVideo", parsedData, "Wind Speed"));
        charts.push(new LineChart("#chart3", "myVideo", parsedData, "Wind Direction"));
        charts.push(new LineChart("#chart4", "myVideo", parsedData, "Dew Point Temperature", true));

        setSelectedChart(charts[0]);

        if (flightMap) {
            flightMap.map.remove();
        }
        flightMap = new FlightMap('map', PROJECT, flight);
        flightMap.addVideoEventListener('myVideo');
        flightMovie.updateVideoSource(flight);
        //oapImagery.updateFlight(flight);
            // Initialize Masonry after charts are created
        setTimeout(function(){
            if(flightMap && flightMap.map){
                flightMap.map.invalidateSize();
            }
        }, 500);

    } catch (error) {
        console.error('Error loading flight data:', error);
    }
});

// Event listener for flight selection change
document.getElementById('flight-select').addEventListener('change', async function() {
    const flight = this.value;
    setFlight(flight);
    flightMovie.updateVideoSource(flight);
    flightMap.updateFlight(flight);
    //oapImagery.updateFlight(flight);

    try {
        const parsedData = await loadData(PROJECT, flight);

        let count = 0;
        // Update existing charts with the new data
        for (const long_name in variableDataSources) {
            if (count < charts.length) {
                charts[count].setVariable(long_name);
                charts[count].updateData(parsedData, long_name);
                charts[count].initVideoSync();
                count++;
            } else {
                console.error('Index out of bounds: charts array does not have enough elements');
            }
        }

        // Update the flight map with the new flight data
        flightMap.updateFlight(flight);
        if (OAP_VIS) {
            flightMap.OAP_imagery.getFilenames(flight, 'F2DS');
            flightMap.OAP_imagery.getFilenames(flight, 'HVPS');
        }
    } catch (error) {
        console.error('Error loading flight data:', error);
    }
});

// Event listener for variable selection change to update the chart variable
document.getElementById('variable-select').addEventListener('change', function() {
    const selectedVariable = this.value;
    updateChartVariable(selectedVariable, SELCHART);
});

// Add event listeners to all chart elements for click and hover interactions
document.querySelectorAll('.line-chart').forEach(chart => {
    chart.addEventListener('click', handleChartClick);
    chart.addEventListener('mouseover', () => {
        chart.style.cursor = 'pointer'; // Change cursor to pointer on hover
    });
});