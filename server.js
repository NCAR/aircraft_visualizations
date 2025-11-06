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

// PostgreSQL configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'real-time-C130',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
};

// Only include user/password if they are set
const pool = new pg.Pool(
    dbConfig.user && dbConfig.password
        ? dbConfig
        : { database: dbConfig.database }
);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log configuration on startup
console.log('Server Configuration:');
console.log(`  Port: ${PORT}`);
console.log(`  Data Directory: ${DATA_DIR}`);
console.log(`  Raw Data Directory: ${RAW_DATA_DIR}`);
console.log(`  Database: ${dbConfig.database}`);
console.log(`  CORS Origins: ${corsOptions.origin.join(', ')}`);
console.log('');

// API endpoint to fetch data from PostgreSQL
app.get('/data', (req, res) => {
    pool.connect((err, client, done) => {
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

// API endpoint to fetch flight data
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

// API endpoint to fetch flight track data
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

// Serve movie files
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
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
