# Redux Store Architecture

## What is Redux?

Redux is a state management library that provides a predictable, centralized way to manage application state. Instead of having state scattered across multiple components, Redux keeps all state in a single source of truth called the store. I restructured the website to this structure to help with debugging of existing functionality, and for future modularity.

### Why Redux?

1. **Predictable State Updates** - All state changes happen through explicit actions
2. **Centralized State** - One place to find all application data
3. **Debugging** - Easy to track state changes and trace bugs
4. **Scalability** - Easier to manage complex state as the app grows
5. **History** - Can see state history and replay actions
6. **Component Decoupling** - Components don't need to pass props deeply

## Redux Flow (Unidirectional)

```
User Action (click, input, etc.)
    ↓
Dispatch Action (describe what happened)
    ↓
Middleware (async operations like API calls)
    ↓
Reducer (pure function: (oldState, action) → newState)
    ↓
Store Updated (new state stored)
    ↓
Selectors (extract needed data)
    ↓
Components Re-render with new data
```

## Directory Structure

### `actions/` - User Interactions
Defines the possible events/commands in the app:
- **actionTypes.js** - Constants like `FETCH_PROJECTS_SUCCESS`, `SELECT_FLIGHT`
- **dataActions.js** - Actions for fetching/updating flight data
- **metadataActions.js** - Actions for loading projects, flights, variables
- **selectionActions.js** - Actions for user selections
- **uiActions.js** - Actions for UI state (play/pause, zoom, etc.)

**Example Action:**
```javascript
export const selectFlight = (flightId, flightNumber) => ({
  type: 'SELECT_FLIGHT',
  payload: { flightId, flightNumber }
});
```

### `reducers/` - How does state change?
Update state based on actions:
- **dataReducer.js** - Manages flight data (timeseries, variables)
- **metadataReducer.js** - Manages metadata (projects, flights list)
- **selectionReducer.js** - Manages user selections
- **uiReducer.js** - Manages UI state (timeline, zoom, radar, loading)
- **rootReducer.js** - Combines all reducers

**Reducer Rules:**
1. Must be a pure function (same input = same output)
2. Cannot mutate state directly
3. Must return new state object
4. Cannot have side effects (API calls, etc.)

**Example Reducer:**
```javascript
function selectionReducer(state = initialState, action) {
  switch(action.type) {
    case 'SELECT_FLIGHT':
      return {
        ...state,
        flightId: action.payload.flightId,
        flightNumber: action.payload.flightNumber
      };
    default:
      return state;
  }
}
```

### `middleware/` - Asynchronous operations
Intercepts actions before they reach reducers:
- **apiMiddleware.js** - Handles async operations (fetch API data)
- **loggerMiddleware.js** - Logs all actions for debugging

Middleware allows us to:
- Make API calls when actions are dispatched
- Log state changes
- Validate actions
- Handle async operations

**Example Flow with Middleware:**
```
Dispatch fetchFlightData(flightId)
    ↓
apiMiddleware intercepts
    ↓
Makes async API request
    ↓
When response arrives, dispatches FETCH_FLIGHT_DATA_SUCCESS
    ↓
Reducer updates state with data
```

### `selectors/` - Accessing current state
Pure functions that extract and compute data from state:
```javascript
export const getCurrentFlightId = (state) => state.selection.flightId;
export const getSelectedVariables = (state) => state.selection.variables;
export const getChartVariable = (state, chartIndex) => 
  state.selection.variables[chartIndex];
```

**Benefits:**
- Encapsulates state structure
- Can compute derived data without components knowing implementation
- Easy to refactor state structure later

### `createStore.js` - Initialize the store
Sets up the Redux store with:
- Root reducer
- Middleware (apiMiddleware, loggerMiddleware)
- Dev tools for debugging

### `Store.js` - Store implementation
The core Redux store class that:
- Holds the current state
- Dispatches actions
- Notifies subscribers of changes
- Allows middleware to intercept actions

## Example: Complete Flow

**Scenario:** User selects a flight

```javascript
// 1. USER ACTION (in mainStore.js)
flightSelect.addEventListener('change', function() {
  const flightId = parseInt(this.value);
  
  // 2. DISPATCH ACTION
  store.dispatch(selectFlight(flightId, flightNumber));
});

// 3. ACTION (actions/selectionActions.js)
export const selectFlight = (flightId, flightNumber) => ({
  type: 'SELECT_FLIGHT',
  payload: { flightId, flightNumber }
});

// 4. REDUCER (reducers/selectionReducer.js)
case 'SELECT_FLIGHT':
  return {
    ...state,
    flightId: payload.flightId,
    flightNumber: payload.flightNumber
  };

// 5. STORE UPDATES
// State tree now has new flightId

// 6. COMPONENTS SUBSCRIBE (via store.subscribe())
store.subscribe((state) => {
  const flightData = getCurrentFlightData(state); // SELECTOR
  updateCharts(flightData);
});

// 7. UI RE-RENDERS with new flight data
```

## State Structure

```javascript
{
  data: {
    flightData: {
      [flightId]: { timeseries: [...], loadedVariables: Set(...) }
    }
  },
  metadata: {
    projects: [...],
    flights: { [projectName]: [...] },
    variables: [...]
  },
  selection: {
    projectName: "NCAR",
    flightId: 1,
    flightNumber: "F1",
    selectedChartIndex: 0,
    variables: ["ALAT", "ALONG", ...]
  },
  ui: {
    timeline: { progress: 0.5, isPlaying: false, currentTime: Date },
    zoom: { [chartIndex]: domainRange },
    radar: { isEnabled: true },
    loading: { projectsLoading: false },
    errors: { projectsError: null }
  }
}
```