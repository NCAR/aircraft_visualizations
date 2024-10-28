// Function to populate the dropdown menu

function selectFlight(options) {
    const selectElement = document.getElementById('flight-select');
    selectElement.innerHTML = ''; // Clear existing options

    options.forEach(flight => {
        const optionElement = document.createElement('option');
        optionElement.value = flight;
        optionElement.textContent = flight;
        selectElement.appendChild(optionElement);
    });
}
function populateDropdown(options) {
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
const flightList = [
    'TF06','RF04'
    // Add more objects as needed
];
// Populate the dropdown with initial options
populateDropdown(variableDataSources);
selectFlight(flightList);

// Event listener for dropdown change
document.getElementById('variable-select').addEventListener('change', function() {
    const selectedVariable = this.value;
    updateChartVariable(selectedVariable);
})
