const express = require('express');
const path = require('path');
const pg = require('pg');
const app = express();
const port = 3000;

// PostgreSQL configuration for real-time data
const realtime_config = {
    database: 'real-time-C130' // Replace with your database name if different
};

// Create a pool for PostgreSQL connections for past projects
const config = {
    host: 'eol-rosetta.eol.ucar.edu',
    database: 'aircraft_data',  // Changed to match your new database
    user: 'ads',
    password: 'snoitarbilac'
};

const pool = new pg.Pool(config);


// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get all projects
app.get('/api/projects', (req, res) => {
    pool.query('SELECT * FROM projects ORDER BY project_name', (err, result) => {
        if (err) {
            console.error('Error fetching projects:', err);
            return res.status(500).send('Error fetching projects');
        }
        res.json(result.rows);
    });
});

// API endpoint to get flights for a project
app.get('/api/projects/:projectName/flights', (req, res) => {
    const { projectName } = req.params;
    const query = `
        SELECT f.*, p.project_name, p.aircraft 
        FROM flights f 
        JOIN projects p ON f.project_id = p.id 
        WHERE UPPER(p.project_name) = UPPER($1)
        ORDER BY f.flight_date DESC, f.flight_number
    `;
    
    pool.query(query, [projectName], (err, result) => {
        if (err) {
            console.error('Error fetching flights:', err);
            return res.status(500).send('Error fetching flights');
        }
        res.json(result.rows);
    });
});

// NEW: API endpoint to get timeseries data using project/flight names
app.get('/api/flights/:flightId/timeseries', async (req, res) => {
    try {
        let flightId = req.params.flightId;
        
        // Ensure flightId is a valid integer
        const numericFlightId = parseInt(flightId, 10);
        if (isNaN(numericFlightId)) {
            return res.status(400).json({ 
                error: 'Invalid flight ID. Must be a numeric ID.'
            });
        }
        flightId = numericFlightId; // Use the parsed integer
        
        const { limit = 1000, variables } = req.query;
        
        console.log(`Looking up timeseries for Flight ID: ${flightId}`);
        
        // Build dynamic column selection if variables are specified
        let columns = '*';
        if (variables) {
            const varList = variables.split(',').map(v => v.trim());
            columns = ['flight_id', 'time', ...varList].join(', ');
        }
        console.log('Selected variables:', variables);
        
        const query = `
            SELECT ${columns}
            FROM timeseries_data 
            WHERE flight_id = $1 
            ORDER BY time 
            LIMIT $2
        `;
        console.log('Executing query:', query);
        const result = await pool.query(query, [flightId, limit]);
        
        const processedData = result.rows.map(row => ({
            ...row,
            time: new Date(row.time)
        }));
        
        console.log(`Returning ${processedData.length} timeseries records`);
        res.json(processedData);
        
    } catch (err) {
        console.error('Error fetching timeseries data:', err);
        res.status(500).json({ error: 'Error fetching timeseries data', details: err.message });
    }
});
// NEW: API endpoint to get track data using project/flight names
app.get('/api/projects/:projectName/flights/:flightNumber/track', async (req, res) => {
    try {
        const { projectName, flightNumber } = req.params;
        const { limit = 5000 } = req.query;
        
        console.log(`Looking up track for: ${projectName} / ${flightNumber}`);
        
        const query = `
            SELECT time, gglat as latitude, gglon as longitude
            FROM timeseries_data 
            WHERE flight_id = $1 
            AND gglat IS NOT NULL 
            AND gglon IS NOT NULL
            ORDER BY time 
            LIMIT $2
        `;
        console.log('Executing query:', query);
        const result = await pool.query(query, [flightNumber, limit]);
        
        const trackData = result.rows.map(row => ({
            time: new Date(row.time),
            latitude: parseFloat(row.latitude),
            longitude: parseFloat(row.longitude)
        }));
        
        console.log(`Returning ${trackData.length} track points`);
        res.json(trackData);
        
    } catch (err) {
        console.error('Error fetching track data:', err);
        res.status(500).json({ error: 'Error fetching track data', details: err.message });
    }
});

app.get('/api/flights/:flightId/track', async (req, res) => {
    try {
        let flightId = req.params.flightId;
        
        // Ensure flightId is a valid integer
        const numericFlightId = parseInt(flightId, 10);
        if (isNaN(numericFlightId)) {
            return res.status(400).json({ 
                error: 'Invalid flight ID. Must be a numeric ID.'
            });
        }
        flightId = numericFlightId; // Use the parsed integer
        
        const { limit = 5000 } = req.query;
        
        console.log(`Looking up track for Flight ID: ${flightId}`);
        
        const query = `
            SELECT time, gglat as latitude, gglon as longitude
            FROM timeseries_data 
            WHERE flight_id = $1 
            AND gglat IS NOT NULL 
            AND gglon IS NOT NULL
            ORDER BY time 
            LIMIT $2
        `;
        console.log('Executing query:', query);
        
        const result = await pool.query(query, [flightId, limit]);
        
        const trackData = result.rows.map(row => ({
            time: new Date(row.time),
            latitude: parseFloat(row.latitude),
            longitude: parseFloat(row.longitude)
        }));
        
        console.log(`Returning ${trackData.length} track points`);
        res.json(trackData);
        
    } catch (err) {
        console.error('Error fetching track data:', err);
        res.status(500).json({ error: 'Error fetching track data', details: err.message });
    }
});

// API endpoint to get available variables for a flight
app.get('/api/flights/:flightId/variables', (req, res) => {
    const query = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'timeseries_data' 
        AND column_name NOT IN ('flight_id', 'time')
        ORDER BY column_name
    `;
    
    pool.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching variables:', err);
            return res.status(500).send('Error fetching variables');
        }
        res.json(result.rows);
    });
});

// API endpoint to get variable metadata
app.get('/api/variables', (req, res) => {
    const query = `
        SELECT variable_name, clean_name, long_name, units, description
        FROM variable_metadata
        ORDER BY variable_name
    `;
    
    pool.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching variables:', err);
            return res.status(500).send('Error fetching variables');
        }
        res.json(result.rows);
    });
});


async function getMovieFilePath(flightId) {
    const query = `
        SELECT movie_filename, p.project_name
        FROM flights f
        JOIN projects p ON f.project_id = p.id
        WHERE f.id = $1
    `;

    const result = await pool.query(query, [flightId]);
    
    // Return the result row if found, otherwise null
    return result.rows.length > 0 ? result.rows[0] : null;
}
// NEW: API endpoint to serve a movie file based on Flight ID
app.get('/movies/:flightID', async (req, res) => {
    const { flightID } = req.params;
    
    // 1. Validate and convert flightID to a number
    const numericFlightId = parseInt(flightID, 10);
    if (isNaN(numericFlightId)) {
        return res.status(400).send('Invalid Flight ID.');
    }

    console.log(`Fetching movie file for Flight ID: ${numericFlightId}`);

    try {
        // 2. Look up the movie filename from the database
        const flightDetails = await getMovieFilePath(numericFlightId);

        if (!flightDetails || !flightDetails.movie_filename) {
            console.warn(`Movie filename not found for Flight ID: ${numericFlightId}`);
            return res.status(404).send('Movie file path not found for this flight.');
        }

        // 3. Construct the full path on the server filesystem
        // If your database stores the FULL path (e.g., /scr/raf_Raw_Data/PROJECT/Movies/filename.mp4),
        // you use that directly.
        let fullFilePath = flightDetails.movie_filename;

        // If the path stored in the DB is ONLY the filename, you'll need to construct the base path:
        // const basePath = '/scr/raf_Raw_Data'; 
        // fullFilePath = path.join(basePath, flightDetails.project_name, 'Movies', flightDetails.movie_filename);
        
        // **Assuming your database column `movie_filename` holds the full, absolute server path:**
        
        console.log(`Serving file from: ${fullFilePath}`);

        // 4. Serve the file
        res.sendFile(fullFilePath, (err) => {
            if (err) {
                console.error(`Error sending movie file ${fullFilePath}: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).send('Error serving file.');
                }
            }
        });

    } catch (err) {
        console.error('Database error during movie lookup:', err);
        res.status(500).send('Server error during file lookup.');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});