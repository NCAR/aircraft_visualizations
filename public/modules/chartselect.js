// Function to populate the dropdown menu
export let SPACER;
export let OAP_VIS;
export let PROJECT ='GOTHAAM';
export let FLIGHT='RF01';
export let FLIGHT_ID =2;
export let MOVIE_FILENAME;
export let VARIABLES = [];

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

// export const UNITS = {
//     'Temperature': '°C',
//     'Wind Speed': 'm/s',
//     'Wind Direction': '°',
//     'Dew Point Temperature': '°C',
//     'Raw Static Pressure, Fuselage': 'hPa',
//     'Fast Response Ozone Mixing Ratio': 'ppb',
//     'Wind Vector, Vertical Gust Component':'m/s',
//     'Horizontal Wind Speed':'m/s',
//     'Cloud Droplet Concentration':'#/cm^3',
//     'Altitude':'m'
// };

export let VARIABLE_METADATA = {};
export let UNITS = {};

function populateDropdown(options, id) {
    const selectElement = document.getElementById(id);
    selectElement.innerHTML = ''; // Clear existing options

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = 'GOTHAAM';
    defaultOption.textContent = id.includes('project') ? 'Select Project' : 'Select Flight';
    selectElement.appendChild(defaultOption);

    options.forEach(option => {
        const optionElement = document.createElement('option');
        if (typeof option === 'object') {
            // For projects and flights with more data
            optionElement.value = option.value;
            optionElement.textContent = option.text;
        } else {
            // For simple arrays
            optionElement.value = option;
            optionElement.textContent = option;
        }
        selectElement.appendChild(optionElement);
    });
}

function populateVars(variables) {
    const selectElement = document.getElementById('variable-select');
    if (!selectElement) {
        console.warn('variable-select element not found');
        return;
    }
    
    selectElement.innerHTML = ''; // Clear existing options

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Variable';
    selectElement.appendChild(defaultOption);

    variables.forEach(variable => {
        const optionElement = document.createElement('option');
        
        // Use clean_name as the value (this is what gets sent to the API)
        const cleanName = variable.clean_name || variable.variable_name;
        optionElement.value = cleanName;
        
        // Use long_name for display
        const displayName = variable.long_name || variable.variable_name;
        const units = variable.units ? ` (${variable.units})` : '';
        optionElement.textContent = `${displayName}${units}`;
        
        
        selectElement.appendChild(optionElement);
    });
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

export async function fetchProjects() {
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const projects = await response.json();
        console.log('Fetched projects:', projects);
        
        const projectOptions = projects.map(project => ({
            value: project.project_name,
            text: `${project.project_name}${project.aircraft ? ` (${project.aircraft})` : ''}`
        }));
        
        populateDropdown(projectOptions, 'project-select');
        
        // firs project set on init
        await fetchFlightList();
        
    } catch (error) {
        console.error('Error fetching projects:', error);
        // Fallback to show error in UI
        const selectElement = document.getElementById('project-select');
        selectElement.innerHTML = '<option value="">Error loading projects</option>';
    }
}
//let flight;
// Fetch flight list from JSON file and update dropdown based on project
// Function to fetch flight list based on PROJECT
export async function fetchFlightList() {
    if (!PROJECT) {
        console.warn('No project selected');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(PROJECT)}/flights`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const flights = await response.json();
        console.log('Fetched flights:', flights);
        
        const flightOptions = flights.map(flight => ({
            value: flight.id,
            text: `${flight.flight_number}`
            // ${flight.flight_date ? ` (${flight.flight_date})` : ''}`
        }));
        
        populateDropdown(flightOptions, 'flight-select');
        
        // Set first flight as default if available
        if (flights.length > 0) {
            FLIGHT = flights[0].flight_number;
            FLIGHT_ID = flights[0].id;
            MOVIE_FILENAME = flights[0].movie_filename;
            
            // Load variables for this flight
            await fetchVariables();
            
            // Dispatch custom event when flight data is available
            document.dispatchEvent(new CustomEvent('flightFetched', { 
                detail: { 
                    flight: FLIGHT, 
                    flightId: FLIGHT_ID,
                    project: PROJECT 
                } 
            }));
        }
        
    } catch (error) {
        console.error('Error fetching flights:', error);
        const selectElement = document.getElementById('flight-select');
        selectElement.innerHTML = '<option value="">Error loading flights</option>';
    }
}
// Fetch available variables from database
export async function fetchVariables() {
    try {
        const response = await fetch(`/api/variables`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const variables = await response.json();
        console.log('Fetched variables:', variables);
        
        // Store metadata for later use
        VARIABLE_METADATA = {};
        UNITS = {};
        VARIABLES=[];
        
        variables.forEach(variable => {
            // Use the clean_name as the key for easy lookup
            const key = variable.clean_name || variable.variable_name;
            
            VARIABLE_METADATA[key] = {
                variable_name: variable.variable_name,
                clean_name: variable.clean_name,
                long_name: variable.long_name,
                units: variable.units,
                description: variable.description
            };
            
            // Also store units separately for easy access
            if (variable.units) {
                UNITS[key] = variable.units;
            }
            VARIABLES.push(key);
        });
        console.log('Processed VARIABLE_METADATA:', VARIABLE_METADATA);
        
        // Populate variable dropdown
        populateVars(variables);
        
    } catch (error) {
        console.error('Error fetching variables:', error);
        const selectElement = document.getElementById('variable-select');
        selectElement.innerHTML = '<option value="">Error loading variables</option>';
    }
}
// Helper function to get variable metadata
export function getVariableMetadata(cleanName) {
    return VARIABLE_METADATA[cleanName] || null;
}
export function setFlight(newFlightId, newFlightName) {
    FLIGHT_ID = newFlightId;
    FLIGHT = newFlightName;
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
