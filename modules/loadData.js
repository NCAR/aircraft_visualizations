import { variableDataSources } from './chartselect.js';
export function loadData(dataSource, callback) {
    fetch(dataSource)
        .then(response => response.text())
        .then(text => {
            const cleanedText = text.replace(/NaN/g, 'null'); // Replace NaN with null
            const data = JSON.parse(cleanedText);
            const timeArray = data.coords.Time.data;
            const dataArray = data.data_vars;
            const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
            const parsedData = timeArray.map((time, index) => {
                const entry = { Time: parseTime(time) };
                for (const variable in dataArray) {
                let value = +dataArray[variable].data[index];
                if (isNaN(value) || value === -32767) {
                    value = null; // Replace -32767 with null
                }
                entry[variable] = value;
                }
                return entry;
        });
        callback(parsedData);
        })
        .catch(error => {
        console.error('Error fetching the JSON file:', error);
        });
    }
export function updateChartVariable(variable, selChart) {
    const baseFileName = variableDataSources[variable];
    if (baseFileName) {
        if (selChart) {
        selChart.setVariable(variable);
        } else {
        console.error('No chart selected');
        }
    } else {
        console.error('Data source not found for variable:', variable);
    }
    }
