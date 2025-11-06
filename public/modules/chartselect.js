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

export const variableRealTime = {
    'Temperature': 'tasx',
    'Wind Speed': 'wic',
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

function populateDropdown(options, id) {
    // Validate inputs
    if (!Array.isArray(options)) {
        console.error(`populateDropdown: options must be an array, got ${typeof options}`);
        return;
    }

    const selectElement = document.getElementById(id);
    if (!selectElement) {
        console.error(`populateDropdown: Element with id '${id}' not found`);
        return;
    }

    selectElement.innerHTML = ''; // Clear existing options

    options.forEach(flight => {
        const optionElement = document.createElement('option');
        optionElement.value = flight;
        optionElement.textContent = flight;
        selectElement.appendChild(optionElement);
    });
}
function populateVars(options) {
    // Validate input
    if (typeof options !== 'object' || options === null) {
        console.error(`populateVars: options must be an object, got ${typeof options}`);
        return;
    }

    const selectElement = document.getElementById('variable-select');
    if (!selectElement) {
        console.error('populateVars: Element with id "variable-select" not found');
        return;
    }

    selectElement.innerHTML = ''; // Clear existing options

    for (const option in options) {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        selectElement.appendChild(optionElement);
    }
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
            if (projects.length > 0) {
                PROJECT = projects[0];
                setOAP(PROJECT);
            }
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
    const projectNameElement = document.getElementById('project-name');
    const flightNameElement = document.getElementById('flight-name');

    if (projectNameElement) {
        projectNameElement.textContent = PROJECT;
    } else {
        console.warn('project-name element not found');
    }

    if (flightNameElement) {
        flightNameElement.textContent = FLIGHT;
    } else {
        console.warn('flight-name element not found');
    }
}

// Initialize - fetch projects first, then PROJECT will be set in fetchProjects callback
fetchProjects();
//populateVars(variableDataSources);
