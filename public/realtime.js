// Import necessary modules and functions
import LineChart from './modules/LineChart.js';
import { setSelectedChart, SELCHART, removeLineCharts, CHARTS } from './modules/LineChart.js';
import { loadData, updateChartVariable, loadPostgresData } from './modules/loadData.js';
import { PROJECT} from './modules/chartselect.js';
import FlightMap from './modules/FlightMap.js';
import FlightMovie from './modules/FlightMovie.js';
//import OAPImagery from './modules/OAPImagery.js';

// Initialize variables
let flightMap;
//const oapImagery = new OAPImagery(PROJECT, FLIGHT);


// Function to handle flight data loading and chart updates
document.addEventListener('DOMContentLoaded', () => {
    const selectedVariables = ['temperature', 'pressure', 'humidity'];
    loadPostgresData(selectedVariables)
        .then(parsedData => {
            CHARTS.push(new LineChart("#chart1", "myVideo ", parsedData, 'Temperature', false,false));
            CHARTS.push(new LineChart("#chart2", "myVideo", parsedData, "Altitude",false,false));
            CHARTS.push(new LineChart("#chart3", "myVideo", parsedData, "Wind Speed",false, false));
            CHARTS.push(new LineChart("#chart4", "myVideo", parsedData, "Wind Direction", true, false));
            //flightMap = new FlightMap('map', PROJECT, flight);
        })
        .catch(error => {
            console.error('Error:', error);
        });
});

// Add event listeners to all chart elements for click and hover interactions
document.querySelectorAll('.line-chart').forEach(chart => {
    chart.addEventListener('click', handleChartClick);
    chart.addEventListener('mouseover', () => {
        chart.style.cursor = 'pointer'; // Change cursor to pointer on hover
    });
});