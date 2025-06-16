const express = require('express');
const path = require('path');
const pg = require('pg');
const app = express();
const port = 3000;

// PostgreSQL configuration
const config = {
    database: 'real-time-C130' // Replace with your database name if different
};
const pool = new pg.Pool(config);


// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch data from PostgreSQL
app.get('/data', (req, res) => {
    pool.connect((err, client, done) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            return res.status(500).send('Error connecting to the database');
        }
        client.query('SELECT * FROM raf_lrt', (err, result) => {
            done();
            if (err) {
                console.error('Error executing query:', err.stack);
                return res.status(500).send('Error fetching data');
            } else {
                const processedData = result.rows.map(item => ({
                    ...item, // Spread all columns from the database row
                    datetime: new Date(item.datetime) // Convert 'datetime' to a JavaScript Date object
                }));
                delete processedData.datetime; 
                res.json(processedData);
            }
        });
    });
});


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