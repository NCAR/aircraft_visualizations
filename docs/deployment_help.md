# Deployment

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- Network access to the NSF NCAR PostgreSQL databases (or a local substitute)

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the values for your environment. See [Environment Variables](#environment-variables) below for a full reference.

### 3. Start the server

```bash
npm start
```

The app is served at `http://localhost:3000` by default. The port can be changed via `PORT` in `.env`.

---

## Environment Variables

All variables are read from `.env` via `dotenv`. Copy `.env.example` as a starting point.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the Express server listens on |
| `NODE_ENV` | `development` | Set to `production` to suppress error details in API responses |
| `DATA_DIR` | `/scr/raf_data` | Path to legacy file-based RAF data |
| `RAW_DATA_DIR` | `/scr/raf_Raw_Data` | Path to raw RAF data files |
| `PG_HOST` | `eol-rosetta.eol.ucar.edu` | PostgreSQL host for historical flight data |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `aircraft_data` | Historical data database name |
| `PG_USER` | `ads` | PostgreSQL username |
| `PG_PASSWORD` | _(required)_ | PostgreSQL password |
| `RT_PG_HOST` | `eol-rt-data.eol.ucar.edu` | PostgreSQL host for real-time data |
| `RT_PG_PORT` | `5432` | Real-time PostgreSQL port |
| `RT_PG_DATABASE` | `real-time-C130` | Real-time database name (`real-time-C130` or `real-time-GV`) |
| `RT_PG_USER` | `ads` | Real-time PostgreSQL username |
| `RT_PG_PASSWORD` | _(optional)_ | Real-time PostgreSQL password |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Comma-separated list of allowed CORS origins |
| `GITHUB_TOKEN` | _(optional)_ | GitHub personal access token with `repo` scope, used for issue submission |

---

## Production Deployment

### Running under Apache

The `public/.htaccess` file configures Apache `mod_rewrite` to serve `index.html` for all non-file requests, enabling SPA client-side routing.

If the app is served at a sub-path (e.g. `/aircraft`), Express already mounts static files at both `/` and `/aircraft`:

```js
app.use(express.static('public'));
app.use('/aircraft', express.static('public'));
```

A typical Apache `ProxyPass` setup:

```apache
ProxyPass /aircraft http://localhost:3000/aircraft
ProxyPassReverse /aircraft http://localhost:3000/aircraft
```

### Keeping the server running

Use a process manager such as `pm2` or a systemd service to keep the Node process alive across reboots:

```bash
# pm2 example
pm2 start server.js --name aircraft-viz
pm2 save
pm2 startup
```

### Setting NODE_ENV

Set `NODE_ENV=production` in `.env` for production deployments. This suppresses internal error details from API error responses.

---

## API Endpoints

The Express server exposes the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:name/flights` | List flights for a project |
| GET | `/api/flights/:id/timeseries` | Timeseries data for a flight (supports `?variables=` and `?limit=`) |
| GET | `/api/flights/:id/track` | GPS track for a flight |
| GET | `/api/variables` | All variable definitions |
| GET | `/api/movies/:flightId` | Streams the flight video file |
| GET | `/api/realtime/variables` | Available variables for a realtime database (`?db=C130\|GV`) |
| GET | `/api/realtime/data` | Latest realtime data snapshot |
| GET | `/api/realtime/stream` | Server-Sent Events stream of live data |
