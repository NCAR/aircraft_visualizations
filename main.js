import LineChart from './modules/LineChart.js';
import { setSelectedChart, SELCHART, removeLineCharts} from './modules/LineChart.js';
import { loadData, updateChartVariable} from './modules/loadData.js';
import { PROJECT, FLIGHT, variableDataSources, fetchFlightList, setFlight,setProject, OAP_VIS, setOAP} from './modules/chartselect.js';
import FlightMap from './modules/FlightMap.js';

//initialize variables
let charts = [];
let flightMap;


fetchFlightList();

document.getElementById('project-select').addEventListener('change', function() {
    const project = this.value;
    setProject(project);
    fetchFlightList();
});

document.addEventListener('flightFetched', (event) => {
    const flight = event.detail.flight;
    setFlight(flight);
    removeLineCharts(charts);
    const initialData = `data/${PROJECT}/${PROJECT}${FLIGHT.toLowerCase()}.json`;
    loadData(initialData, (parsedData) => {
        charts.push(new LineChart("#chart1", "myVideo", parsedData, 'Temperature'))
        charts.push(new LineChart("#chart2", "myVideo", parsedData, "Wind Speed"));
        charts.push(new LineChart("#chart3", "myVideo", parsedData, "Wind Direction"));
        charts.push(new LineChart("#chart4", "myVideo", parsedData, "Dew Point Temperature", true));
    });
    console.log(charts);
    setSelectedChart(charts[0]);
    if (flightMap) {
        flightMap.map.remove();
    }
    console.log("flight:",flight);
    console.log("PROJECT:",PROJECT);
    console.log("OAP_VIS:",OAP_VIS);
    flightMap = new FlightMap('map', flight, OAP_VIS);
    flightMap.handleOAPVisibility();
    flightMap.addVideoEventListener('myVideo');
});

//charts.push(new LineChart("#my_dataviz", "myVideo", `ATX${flight.toLowerCase()}.json`, 'Temperature (C)'))
//charts.push(new LineChart("#chart2", "myVideo", `WIC${flight.toLowerCase()}.json`, "Wind Speed (m/s)"));

document.getElementById('flight-select').addEventListener('change', function() {
    const flight = this.value;
    this.progress=1;
    const newDataSource = `data/${PROJECT}/${PROJECT}${flight.toLowerCase()}.json`;
    loadData(newDataSource, (parsedData) => {
    let count = 0;
    for (const long_name in variableDataSources) {
        if (count < charts.length) {
            console.log(long_name, count);
            console.log(charts[count]);
            charts[count].setVariable(long_name);
            charts[count].updateData(parsedData,long_name);
            charts[count].initVideoSync();

            count++;
        } else {
            console.error('Index out of bounds: charts array does not have enough elements');
        }
    }
    flightMap.updateFlight(flight);
    if (OAP_VIS){
	flightMap.OAP_imagery.getFilenames(flight,'F2DS');
	flightMap.OAP_imagery.getFilenames(flight,'HVPS');
	}
    });
});

// Event listener for dropdown change to update the chart variable
document.getElementById('variable-select').addEventListener('change', function() {
    const selectedVariable = this.value;
    updateChartVariable(selectedVariable, SELCHART);
});

// Add event listeners to all chart elements
document.querySelectorAll('.line-chart').forEach(chart => {
    chart.addEventListener('click', handleChartClick);
    chart.addEventListener('mouseover', () => {
        chart.style.cursor = 'pointer'; // Change cursor to pointer on hover
    });
});


