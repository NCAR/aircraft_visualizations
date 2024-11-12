// Function to populate the dropdown menu

function selectDropdown(options,id) {
    const selectElement = document.getElementById(id);
    selectElement.innerHTML = ''; // Clear existing options

    options.forEach(flight => {
        const optionElement = document.createElement('option');
        optionElement.value = flight;
        optionElement.textContent = flight;
        selectElement.appendChild(optionElement);
    });
}
function populateVars(options) {
    const selectElement = document.getElementById('variable-select');
    selectElement.innerHTML = ''; // Clear existing options

    for (const option in options) {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        selectElement.appendChild(optionElement);
    };
}

// Example options array
const variableDataSources = {
    'Temperature': 'ATX',
    'Wind Speed': 'WIC',
    'Wind Direction': 'WDC',
    'Fast Response Ozone Mixing Ratio': 'FO3C_ACOM',
    'Dew Point Temperature': 'DPXC',
    'Raw Static Pressure, Fuselage': 'PSX',
    'Wind Vector, Vertical Gust Component':'WIX',
    'Horizontal Wind Speed':'WSC',
    'Cloud Droplet Concentration':'CONCD_LWI',
    // Add more key-value pairs as needed
};

const UNITS = {
    'Temperature': '°C',
    'Wind Speed': 'm/s',
    'Wind Direction': '°',
    'Fast Response Ozone Mixing Ratio': 'ppb',
    'Dew Point Temperature': '°C',
    'Raw Static Pressure, Fuselage': 'hPa',
    'Wind Vector, Vertical Gust Component':'m/s',
    'Horizontal Wind Speed':'m/s',
    'Cloud Droplet Concentration':'#/cm^3',

    // Add more key-value pairs as needed
};
const PROJECTS = ['CAESAR','TI3GER','APAR-FVT2023']
let project = PROJECTS[0];
let flight;
selectDropdown(PROJECTS,'project-select');

let flightList = [];
//let flight;
// Fetch flight list from JSON file and update dropdown based on project
// Function to fetch flight list and dispatch an event
function fetchFlightList() {
    fetch('flight_lists.json')
        .then(response => response.json())
        .then(data => {
            flightList = data[project] || [];
            flight = flightList[0];
            selectDropdown(flightList, 'flight-select');
            // Dispatch a custom event when flight data is fetched and available
            document.dispatchEvent(new CustomEvent('flightFetched', { detail: { flight } }));
        })
        .catch(error => console.error('Error fetching flight list:', error));
}
document.addEventListener('flightFetched', (event) => {
    flight = event.detail.flight;
    updateProjectAndFlightText();
});
fetchFlightList();
console.log(flight);

// Populate the dropdown with initial options
populateVars(variableDataSources);

// Event listener for dropdown change
document.getElementById('variable-select').addEventListener('change', function() {
    const selectedVariable = this.value;
    updateChartVariable(selectedVariable);
})

function updateProjectAndFlightText() {
    document.getElementById('project-name').textContent = project;
    document.getElementById('flight-name').textContent = flight;
}

document.getElementById('project-select').addEventListener('change', function() {
    project = this.value;
    fetchFlightList();
});

updateProjectAndFlightText();