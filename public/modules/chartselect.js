// Function to populate the dropdown menu
export let SPACER;
export let OAP_VIS;
export let PROJECT ='TI3GER';
export let FLIGHT;

// Example options array
export const variableDataSources = {
    'Temperature': 'ATX',
    'Wind Speed': 'WIC',
    'Wind Direction': 'WDC',
    //'Fast Response Ozone Mixing Ratio': 'FO3C_ACOM',
    'Dew Point Temperature': 'DPXC',
    'Raw Static Pressure, Fuselage': 'PSX',
    'Wind Vector, Vertical Gust Component':'WIX',
    'Horizontal Wind Speed':'WSC',
    'Altitude':'GGALT'
    //'Cloud Droplet Concentration':'CONCD_LWI',
    // Add more key-value pairs as needed
};

export const UNITS = {
    'Temperature': '°C',
    'Wind Speed': 'm/s',
    'Wind Direction': '°',
    'Dew Point Temperature': '°C',
    'Raw Static Pressure, Fuselage': 'hPa',
    'Fast Response Ozone Mixing Ratio': 'ppb',
    'Wind Vector, Vertical Gust Component':'m/s',
    'Horizontal Wind Speed':'m/s',
    'Cloud Droplet Concentration':'#/cm^3',
    'Altitude':'m'

    // Add more key-value pairs as needed
};

function populateDropdown(options,id) {
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
let projects = []



export function setOAP(project){
    if (project === 'CAESAR'){
        OAP_VIS = true;
        SPACER = 8;
    } else{
        OAP_VIS = false;
        SPACER = 4.4;

}
}

export function fetchProjects() {
    fetch('flight_lists.json')
        .then(response => response.json())
        .then(data => {
            Object.keys(data).forEach(project => {
                projects.push(project);
            });
            PROJECT = projects[0];
            populateDropdown(projects, 'project-select');
        })
        .catch(error => {
            console.error('Error fetching projects:', error);
        });
}
//let flight;
// Fetch flight list from JSON file and update dropdown based on project
// Function to fetch flight list based on PROJECT
export function fetchFlightList() {
    fetch('flight_lists.json')
        .then(response => response.json())
        .then(data => {
            if (!data[PROJECT]) {
                console.error(`No flights found for project: ${PROJECT}`);
                return;
            }
            const flightList = data[PROJECT];
            if (flightList.length > 0) {
                FLIGHT = flightList[0];
                populateDropdown(flightList, 'flight-select');

                // Dispatch custom event when flight data is available
                document.dispatchEvent(new CustomEvent('flightFetched', { detail: { flight: FLIGHT } }));
            } else {
                console.warn(`Flight list for project ${PROJECT} is empty.`);
            }
        })
        .catch(error => console.error('Error fetching flight list:', error));
}

export function setFlight(newFlight) {
    FLIGHT = newFlight;
}

export function setProject(newProject) {
    PROJECT = newProject;
    setOAP(newProject);
}

export function updateProjectAndFlightText() {
    document.getElementById('project-name').textContent = PROJECT;
    document.getElementById('flight-name').textContent = FLIGHT;
}

// Populate the dropdown with initial options
setProject(projects[0])
//populateVars(variableDataSources);
fetchProjects();
//populateDropdown(projects,'project-select');
