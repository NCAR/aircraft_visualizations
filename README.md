# Aircraft Visualizations

An interactive web application for visualizing flight data from NSF NCAR research aircraft — the C-130 and GV (Gulfstream V). Researchers can explore historical flight data through synchronized time-series charts, a live flight-track map, and camera footage, as well as monitor live data during active flights via the real-time page.

## Features

- **Dashboard** — select a project and flight, then visualize up to 8 configurable time-series charts alongside a Mapbox flight-track map and synchronized camera video
- **Real-time page** — monitor live sensor data from the C-130 or GV via a Server-Sent Events stream
- **URL state** — the current project, flight, variables, and chart layout are encoded in the URL for easy sharing and bookmarking
- **Configurable charts** — add/remove variables per chart, assign axes (left/right), zoom, and configure x-axis variables for scatter-style plots
- **Gap-aware video sync** — video playback automatically accounts for recording gaps, keeping camera footage in sync with the data timeline (work in progress)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Database | PostgreSQL (`pg`) |
| Frontend | Vanilla JS ES modules, Redux-like store |
| Charts | Apache ECharts (primary), D3.js (legacy) |
| Map | Mapbox GL JS |
| Styling | CSS custom properties + Tailwind CSS |
| Tests | Jest + jsdom + Babel |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env — at minimum set PG_PASSWORD

# 3. Start the development server. MUST FILL IN POSTGRES PASSWORD OR IT CANNOT CONNECT TO THE DATABASE
PG_PASSWORD=<password> npm start 
# → http://localhost:3000
```

See [docs/deployment_help.md](docs/deployment_help.md) for production setup, Apache configuration, and a full environment variable reference.

---

## Running Tests

Tests use [Jest](https://jestjs.io/) with jsdom and Babel for ES module support.

```bash
# Run all tests
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# Unit tests only
npm run test:unit

# With coverage report
npm run test:coverage
```

> **Note:** `npm` and `npx` may not be on `PATH` on some servers. In that case run tests directly:
> ```bash
> /path/to/node node_modules/.bin/jest
> ```

### Test structure

```
test/
  setup.js                    # Suppresses console output during tests
  mocks/
    styleMock.js              # CSS module mock
    fileMock.js               # Static asset mock
  unit/
    shared/
      gapUtils.test.js        # Gap math and progress-mapping utilities
      StateChangeDetector.test.js
    store/
      reducers/
        uiReducer.test.js
        selectionReducer.test.js
        dataReducer.test.js
      selectors.test.js
```

---

## Project Structure

```
aircraft_visualizations/
├── server.js           # Express server and API endpoints
├── package.json
├── .env.example        # Environment variable template
├── docs/
│   ├── deployment_help.md   # Deployment and configuration guide
│   └── public_files.md        # One-line description of every file in public/
├── public/             # Frontend SPA (served statically)
│   ├── app.js          # SPA entry point
│   ├── index.html      # Application shell
│   ├── interfaces/     # IComponent / IChart / ITimelineAware base classes
│   ├── modules/        # Store-connected UI components
│   ├── pages/          # Per-page init modules
│   ├── router/         # Client-side router + URL state sync
│   ├── store/          # Redux-like store, reducers, actions, selectors
│   └── css/            # Modular stylesheets
└── test/               # Jest test suite
```

For a complete description of every file under `public/`, see [docs/public_files.md](docs/public_files.md).

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
