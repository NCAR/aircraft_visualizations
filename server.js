const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch flight data
app.get('/api/flight-data/:project/:flight', (req, res) => {
    const { project, flight } = req.params;
    const filePath = path.join('/scr/raf_data', project, 'LRT_json', `${project}${flight.toLowerCase()}.json`);
    console.log(`Fetching flight data from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error fetching flight data: ${err.message}`);
            if (!res.headersSent) {
                res.status(404).send('File not found');
            }
        }
    });
});

// API endpoint to fetch flight track data
app.get('/api/flight-track/:project/:flight', (req, res) => {
    const { project, flight } = req.params;
    const filePath = path.join('/scr/raf_data', project, 'LRT_json', `${project}${flight.toLowerCase()}_track.json`);
    console.log(`Fetching flight track data from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error fetching flight track data: ${err.message}`);
            if (!res.headersSent) {
                res.status(404).send('File not found');
            }
        }
    });
});;

// Serve movie files
app.get('/movies/:project/:filename', (req, res) => {
    const { project, filename } = req.params;
    const filePath = path.join('/scr/raf_Raw_Data', project, 'Movies', filename);
    console.log(`Fetching movie file from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error fetching movie file: ${err.message}`);
            if (!res.headersSent) {
                res.status(404).send('File not found');
            }
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});