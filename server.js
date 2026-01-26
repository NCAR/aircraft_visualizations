require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pg = require('pg');
const app = express();

// Configuration from environment variables with fallbacks
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/scr/raf_data';
const RAW_DATA_DIR = process.env.RAW_DATA_DIR || '/scr/raf_Raw_Data';

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:8080'],
    optionsSuccessStatus: 200
};

// PostgreSQL configuration for historical data
const config = {
    host: process.env.PG_HOST || 'eol-rosetta.eol.ucar.edu',
    database: process.env.PG_DATABASE || 'aircraft_data',
    user: process.env.PG_USER || 'ads',
    password: process.env.PG_PASSWORD || 'snoitarbilac',
    port: process.env.PG_PORT || 5432
};

// PostgreSQL configuration for real-time data
const realtimeBaseConfig = {
    host: process.env.RT_PG_HOST || 'eol-rt-data.eol.ucar.edu',
    user: process.env.RT_PG_USER || 'ads',
    password: process.env.RT_PG_PASSWORD || '',
    port: process.env.RT_PG_PORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Available realtime databases
const REALTIME_DATABASES = {
    'C130': 'real-time-C130',
    'GV': 'real-time-GV'
};

// Create pools for each realtime database
const realtimePools = {};
Object.entries(REALTIME_DATABASES).forEach(([key, dbName]) => {
    realtimePools[key] = new pg.Pool({
        ...realtimeBaseConfig,
        database: dbName
    });
});

// Default realtime database
let currentRealtimeDB = process.env.RT_PG_DATABASE === 'real-time-GV' ? 'GV' : 'C130';

const pool = new pg.Pool(config);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log configuration on startup
console.log('Server Configuration:');
console.log(`  Port: ${PORT}`);
console.log(`  Data Directory: ${DATA_DIR}`);
console.log(`  Raw Data Directory: ${RAW_DATA_DIR}`);
console.log(`  Database: ${config.database} @ ${config.host}`);
console.log(`  Real-time DB: ${REALTIME_DATABASES[currentRealtimeDB]} (${currentRealtimeDB})`);
console.log(`  CORS Origins: ${corsOptions.origin.join(', ')}`);
console.log('');

// ===================================
// POSTGRESQL API ENDPOINTS
// ===================================

// API endpoint to get all projects
app.get('/api/projects', (req, res) => {
    pool.query('SELECT * FROM projects ORDER BY project_name', (err, result) => {
        if (err) {
            console.error('Error fetching projects:', err);
            return res.status(500).json({
                error: 'Error fetching projects',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
        res.json(result.rows);
    });
});

// API endpoint to get flights for a project
app.get('/api/projects/:projectName/flights', (req, res) => {
    const { projectName } = req.params;

    // Validate input
    if (!projectName.match(/^[a-zA-Z0-9_-]+$/)) {
        return res.status(400).json({ error: 'Invalid project name' });
    }

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
            return res.status(500).json({
                error: 'Error fetching flights',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
        res.json(result.rows);
    });
});

// API endpoint to get timeseries data
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
        flightId = numericFlightId;

        const { limit = 1000, variables } = req.query;

        console.log(`Looking up timeseries for Flight ID: ${flightId}`);

        // Build dynamic column selection if variables are specified
        let columns = '*';
        if (variables) {
            const varList = variables.split(',').map(v => v.trim());
            // Validate variable names to prevent SQL injection
            const validVars = varList.filter(v => v.match(/^[a-zA-Z0-9_]+$/));
            if (validVars.length > 0) {
                columns = ['flight_id', 'time', ...validVars].join(', ');
            }
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
        res.status(500).json({
            error: 'Error fetching timeseries data',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// API endpoint to get track data (simplified)
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
        flightId = numericFlightId;

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
        res.status(500).json({
            error: 'Error fetching track data',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
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
            return res.status(500).json({
                error: 'Error fetching variables',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
        res.json(result.rows);
    });
});

// Helper function to get movie file path from database
async function getMovieFilePath(flightId) {
    const query = `
        SELECT movie_filename, p.project_name
        FROM flights f
        JOIN projects p ON f.project_id = p.id
        WHERE f.id = $1
    `;

    const result = await pool.query(query, [flightId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

// API endpoint to serve a movie file based on Flight ID
app.get('/movies/:flightID', async (req, res) => {
    const { flightID } = req.params;

    // Validate and convert flightID to a number
    const numericFlightId = parseInt(flightID, 10);
    if (isNaN(numericFlightId)) {
        return res.status(400).json({ error: 'Invalid Flight ID' });
    }

    console.log(`Fetching movie file for Flight ID: ${numericFlightId}`);

    try {
        const flightDetails = await getMovieFilePath(numericFlightId);

        if (!flightDetails || !flightDetails.movie_filename) {
            console.warn(`Movie filename not found for Flight ID: ${numericFlightId}`);
            return res.status(404).json({ error: 'Movie file not found for this flight' });
        }

        // Use the full file path from database
        let fullFilePath = flightDetails.movie_filename;

        console.log(`Serving file from: ${fullFilePath}`);

        res.sendFile(fullFilePath, (err) => {
            if (err) {
                console.error(`Error sending movie file ${fullFilePath}: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error serving file' });
                }
            }
        });
    } catch (err) {
        console.error('Database error during movie lookup:', err);
        res.status(500).json({
            error: 'Server error during file lookup',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// ===================================
// LEGACY FILE-BASED ENDPOINTS
// (Kept for backwards compatibility)
// ===================================

// API endpoint to fetch data from PostgreSQL real-time database
app.get('/data', (req, res) => {
    const rtPool = new pg.Pool(realtime_config);

    rtPool.connect((err, client, done) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            return res.status(500).json({
                error: 'Error connecting to the database',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }

        client.query('SELECT * FROM raf_lrt', (err, result) => {
            done();
            if (err) {
                console.error('Error executing query:', err.stack);
                return res.status(500).json({
                    error: 'Error fetching data',
                    details: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }

            const processedData = result.rows.map(item => {
                const { datetime, ...rest } = item;
                return {
                    ...rest,
                    datetime: new Date(datetime)
                };
            });
            res.json(processedData);
        });
    });
});

// API endpoint to fetch flight data from files
app.get('/api/flight-data/:project/:flight', (req, res) => {
    const { project, flight } = req.params;

    // Validate input to prevent path traversal
    if (!project.match(/^[a-zA-Z0-9_-]+$/) || !flight.match(/^[a-zA-Z0-9_-]+$/)) {
        return res.status(400).json({ error: 'Invalid project or flight name' });
    }

    const filePath = path.join(DATA_DIR, project, 'LRT_json', `${project}${flight.toLowerCase()}.json`);
    console.log(`Fetching flight data from: ${filePath}`);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error fetching flight data: ${err.message}`);
            if (!res.headersSent) {
                res.status(404).json({
                    error: 'Flight data not found',
                    project,
                    flight
                });
            }
        }
    });
});

// API endpoint to fetch flight track data from files
app.get('/api/flight-track/:project/:flight', (req, res) => {
    const { project, flight } = req.params;

    // Validate input to prevent path traversal
    if (!project.match(/^[a-zA-Z0-9_-]+$/) || !flight.match(/^[a-zA-Z0-9_-]+$/)) {
        return res.status(400).json({ error: 'Invalid project or flight name' });
    }

    const filePath = path.join(DATA_DIR, project, 'LRT_json', `${project}${flight.toLowerCase()}_track.json`);
    console.log(`Fetching flight track data from: ${filePath}`);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error fetching flight track data: ${err.message}`);
            if (!res.headersSent) {
                res.status(404).json({
                    error: 'Flight track data not found',
                    project,
                    flight
                });
            }
        }
    });
});

// Serve movie files by project/filename
app.get('/movies/:project/:filename', (req, res) => {
    const { project, filename } = req.params;

    // Validate input to prevent path traversal
    if (!project.match(/^[a-zA-Z0-9_-]+$/) || !filename.match(/^[a-zA-Z0-9._-]+$/)) {
        return res.status(400).json({ error: 'Invalid project or filename' });
    }

    // Ensure it's a video file
    if (!filename.match(/\.(mp4|mov|avi)$/i)) {
        return res.status(400).json({ error: 'Only video files are allowed' });
    }

    const filePath = path.join(RAW_DATA_DIR, project, 'Movies', filename);
    console.log(`Fetching movie file from: ${filePath}`);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error fetching movie file: ${err.message}`);
            if (!res.headersSent) {
                res.status(404).json({
                    error: 'Movie file not found',
                    project,
                    filename
                });
            }
        }
    });
});

// ===================================
// UTILITY ENDPOINTS
// ===================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ===================================
// REALTIME DATA ENDPOINTS
// ===================================

// Get available realtime databases
app.get('/api/realtime/databases', (req, res) => {
    res.json({
        available: Object.keys(REALTIME_DATABASES),
        current: currentRealtimeDB,
        databases: REALTIME_DATABASES
    });
});

// Switch realtime database
app.post('/api/realtime/database', express.json(), (req, res) => {
    const { database } = req.body;

    if (!REALTIME_DATABASES[database]) {
        return res.status(400).json({
            error: 'Invalid database',
            available: Object.keys(REALTIME_DATABASES)
        });
    }

    currentRealtimeDB = database;
    console.log(`[Realtime] Switched to database: ${REALTIME_DATABASES[database]}`);

    res.json({
        success: true,
        current: currentRealtimeDB,
        database: REALTIME_DATABASES[database]
    });
});

// Get realtime variables (column names from raf_lrt table)
app.get('/api/realtime/variables', async (req, res) => {
    const dbKey = req.query.db || currentRealtimeDB;
    const rtPool = realtimePools[dbKey];

    if (!rtPool) {
        return res.status(400).json({ error: 'Invalid database' });
    }

    try {
        const query = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'raf_lrt'
            ORDER BY column_name;
        `;

        const result = await rtPool.query(query);
        const variables = result.rows.map(row => row.column_name);
        res.json(variables);

    } catch (err) {
        console.error('[Realtime] Error fetching variables:', err);
        res.status(500).json({
            error: 'Error fetching variables',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Get realtime variable metadata
app.get('/api/realtime/variable-metadata', async (req, res) => {
    const dbKey = req.query.db || currentRealtimeDB;
    const rtPool = realtimePools[dbKey];

    if (!rtPool) {
        return res.status(400).json({ error: 'Invalid database' });
    }

    try {
        const query = `
            SELECT name, long_name, units, missing_value
            FROM variable_list
            ORDER BY name;
        `;

        const result = await rtPool.query(query);

        // Convert to object for easy lookup
        const metadata = {};
        result.rows.forEach(row => {
            metadata[row.name] = {
                long_name: row.long_name,
                units: row.units,
                missing_value: row.missing_value
            };
        });

        console.log(`[Realtime] Found metadata for ${Object.keys(metadata).length} variables`);
        res.json(metadata);

    } catch (err) {
        console.error('[Realtime] Error fetching variable metadata:', err);
        res.status(500).json({
            error: 'Error fetching variable metadata',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Get realtime data
app.get('/api/realtime/data', async (req, res) => {
    const dbKey = req.query.db || currentRealtimeDB;
    const rtPool = realtimePools[dbKey];

    if (!rtPool) {
        return res.status(400).json({ error: 'Invalid database' });
    }

    try {
        // Get requested variables from query parameter
        const requestedVars = req.query.vars ? req.query.vars.split(',') : ['datetime', 'tasx', 'wic'];

        // Always include datetime
        if (!requestedVars.includes('datetime')) {
            requestedVars.unshift('datetime');
        }

        // Validate variable names to prevent SQL injection
        const validVars = requestedVars.filter(v => v.match(/^[a-zA-Z0-9_]+$/));
        const columnList = validVars.map(v => `"${v}"`).join(', ');

        // Check if we have an 'after' parameter for incremental updates
        let whereClause = '';
        let queryParams = [];

        if (req.query.after) {
            whereClause = 'WHERE datetime > $1';
            queryParams.push(req.query.after);
        }

        // Optional limit
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
        const limitClause = limit ? `LIMIT ${limit}` : '';

        const query = `
            SELECT ${columnList}
            FROM raf_lrt
            ${whereClause}
            ORDER BY datetime
            ${limitClause}
        `;

        console.log(`[Realtime] Fetching data from ${REALTIME_DATABASES[dbKey]}, vars: ${validVars.join(',')}`);

        const result = await rtPool.query(query, queryParams);

        console.log(`[Realtime] Returning ${result.rows.length} records`);
        res.json(result.rows);

    } catch (err) {
        console.error('[Realtime] Error fetching data:', err);
        res.status(500).json({
            error: 'Error fetching realtime data',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Get realtime track data (lat/lon)
app.get('/api/realtime/track', async (req, res) => {
    const dbKey = req.query.db || currentRealtimeDB;
    const rtPool = realtimePools[dbKey];

    if (!rtPool) {
        return res.status(400).json({ error: 'Invalid database' });
    }

    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5000;

        const query = `
            SELECT datetime as time, gglat as latitude, gglon as longitude
            FROM raf_lrt
            WHERE gglat IS NOT NULL AND gglon IS NOT NULL
            ORDER BY datetime
            LIMIT $1
        `;

        const result = await rtPool.query(query, [limit]);

        const trackData = result.rows.map(row => ({
            time: new Date(row.time),
            latitude: parseFloat(row.latitude),
            longitude: parseFloat(row.longitude)
        }));

        console.log(`[Realtime] Returning ${trackData.length} track points`);
        res.json(trackData);

    } catch (err) {
        console.error('[Realtime] Error fetching track data:', err);
        res.status(500).json({
            error: 'Error fetching track data',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// ===================================
// SPA FALLBACK ROUTE
// ===================================

// Serve index.html for all non-API, non-file routes (SPA support)
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }

    // Skip routes with file extensions (static files)
    if (req.path.includes('.')) {
        return next();
    }

    // Skip movie routes
    if (req.path.startsWith('/movies/')) {
        return next();
    }

    // Serve the SPA shell for all other routes
    console.log(`[SPA] Serving index.html for route: ${req.path}`);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`✓ Server running at http://localhost:${PORT}/`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
    });
});
