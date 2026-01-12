# Interfaces Directory

This directory contains interface/base classes that define contracts for store-connected components in the visualization system. These interfaces establish consistent patterns for component initialization, state management, and lifecycle management.

## Logic
Separating the interface files provides significant architectural benefits:

### 1. **Single Source of Truth for Component Contracts**
All components (LineChartStore, FlightMapStore, FlightMovieStore, TimelineControllerStore) extend from these shared interfaces. This removed the need for shared imports or duplicated code.

### 2. **Enforces Consistent Patterns Across All Components**
Every component follows the same lifecycle:
```javascript
// Every component implements this pattern
class MyComponent extends IComponent {
  onStateChange(state) { ... }  // Always named onStateChange
  destroy() { ... }               // Always destroys cleanly
}
```

### 3. **Flexible Coordination**
The timeline controller can treat all components uniformly:
```javascript
components.forEach(comp => comp.onStateChange(newState));  // Works for all

// Runtime type checking for optional features
if (component instanceof IChart) {
  component.updateProgress(0.5);
}
```

### 4. **Self-Documenting API**
Other developers can immediately know what methods a component must implement by looking at the interface file, rather than reverse-engineering patterns from multiple module implementations.

### 5. **Supports Mixin Patterns**
`ITimelineAware` is an optional contract that components can implement alongside their main interface, avoiding messy inheritance.

### 6. **Architectural Flexibility**
We can swap implementations (e.g., D3 → Chart.js) without breaking the contract, as long as the interface methods remain compatible.

---

## Contract

In this context, a contract is a formal agreement that specifies:
- **What methods must exist** (e.g., `onStateChange()`, `destroy()`)
- **What parameters those methods accept** (e.g., `onStateChange(state)`)
- **What behavior is expected** (e.g., "onStateChange is called whenever store state changes")

When a class extends an interface, it's promising to implement all required methods. If it doesn't, the code will throw an error immediately rather than failing mysteriously later.

**Example:**
```javascript
// IComponent defines the contract:
// - Any subclass MUST implement onStateChange(state)
// - Any subclass MUST implement destroy()

class FlightMapStore extends IComponent {
  //I'm keeping the contract
  onStateChange(state) { ... }
  destroy() { ... }
}

// If someone forgot:
class BrokenComponent extends IComponent {
  // Contract violation! Missing onStateChange()
  destroy() { ... }
}
// → Error: "BrokenComponent must implement onStateChange(state)"
```

---

## Overview

The interfaces follow a hierarchical design pattern:

```
IComponent (base)
    ↓
  IChart (chart-specific)

ITimelineAware (mixin/optional)
```

## Interfaces

### IComponent

**File:** `IComponent.js`

Base interface for all store-connected components. Provides store integration, subscription management, and lifecycle methods.

#### Purpose
- Ensures all components properly connect to and disconnect from the Redux store
- Provides common dispatch and state access patterns
- Enforces consistent lifecycle management

#### Key Methods

| Method | Purpose | Notes |
|--------|---------|-------|
| `constructor(store)` | Initialize component with store reference | Required; throws if store is missing |
| `connect()` | Subscribe to store changes | Triggers `onStateChange()` on state updates |
| `disconnect()` | Unsubscribe from store | Cleans up subscription |
| `onStateChange(state)` | **MUST be implemented** | Called on every state change; subclass responsibility |
| `dispatch(action)` | Dispatch action to store | Convenience wrapper for `store.dispatch()` |
| `getState()` | Get current store state | Convenience wrapper for `store.getState()` |
| `destroy()` | Cleanup component | Default implementation calls `disconnect()` |

#### Usage Example

```javascript
import { IComponent } from './interfaces/IComponent.js';

class MyComponent extends IComponent {
  constructor(store) {
    super(store);  // Call parent constructor
    this.initDOM();
    this.connect();  // Subscribe to store
  }

  onStateChange(state) {
    // Called whenever store state changes
    this.render(state);
  }

  destroy() {
    // Custom cleanup
    this.removeDOM();
    super.destroy();  // Call parent cleanup
  }
}
```

#### Subclasses in Codebase
- `IChart` - extends IComponent for chart components
- `LineChartStore` - extends IChart; renders D3 line charts
- `FlightMapStore` - extends IComponent; renders flight map
- `FlightMovieStore` - extends IComponent; manages video playback
- `TimelineControllerStore` - extends IComponent; manages timeline animation

---

### IChart

**File:** `IChart.js`

Chart-specific interface extending `IComponent`. Adds methods for data visualization and zoom management.

#### Purpose
- Provides standardized contract for all chart components
- Ensures consistent data update and progress tracking patterns
- Manages zoom functionality across multiple charts

#### Additional Methods (beyond IComponent)

| Method | Purpose | Notes |
|--------|---------|-------|
| `updateData(data, variable)` | **MUST be implemented** | Update chart with new timeseries data and variable |
| `updateProgress(progress)` | **MUST be implemented** | Update chart visualization based on timeline progress (0-1) |
| `updateZoom(domain)` | Optional | Update zoom domain; `domain` is `[startDate, endDate]` |
| `resetZoom()` | Optional | Reset zoom to initial domain |

#### Constructor
```javascript
constructor(store, chartIndex)
```
- `store` - Store instance (inherited from IComponent)
- `chartIndex` - Chart position (0-3); validates range
- `this.chartIndex` - Accessible to subclass

#### Usage Example

```javascript
import { IChart } from './interfaces/IChart.js';

class LineChartStore extends IChart {
  constructor(selector, store, chartIndex, showXLabel) {
    super(store, chartIndex);  // Validates chartIndex is 0-3
    this.selector = selector;
    this.showXLabel = showXLabel;
    this.renderer = new ChartRenderer(selector);
    this.connect();
  }

  onStateChange(state) {
    const flightData = state.data.flightData[state.selection.flightId];
    const variable = state.selection.selectedVariables[this.chartIndex];
    
    if (flightData && variable) {
      this.updateData(flightData.timeseries, variable);
    }

    const domain = state.ui.charts.zoomDomains[this.chartIndex];
    if (domain) {
      this.updateZoom(domain);
    }
  }

  updateData(data, variable) {
    this.renderer.updateData(data, variable);
  }

  updateProgress(progress) {
    this.renderer.updateProgress(progress);
  }

  updateZoom(domain) {
    this.renderer.updateZoom(domain);
  }

  resetZoom() {
    this.renderer.resetZoom();
  }
}
```

#### Subclasses in Codebase
- `LineChartStore` - main chart implementation in [modules/LineChartStore.js](../modules/LineChartStore.js)

---

### ITimelineAware

**File:** `ITimelineAware.js`

Mixin interface for components that respond to timeline updates. **Not extending IComponent** — it's a separate contract.

#### Purpose
- Allows components to react to timeline playback progress
- Enables synchronized animations across multiple components
- Optional interface — implement only if component needs timeline updates

#### Key Methods

| Method | Purpose | Notes |
|--------|---------|-------|
| `updateFlightTime(progress, currentTime)` | **MUST be implemented** | Called during timeline animation with progress (0-1) and current time |
| `isTimelineAware(obj)` | Utility | Check if object implements interface |

#### Constructor
No constructor — this is a pure contract/mixin.

#### Usage Example

```javascript
import { ITimelineAware, isTimelineAware } from './interfaces/ITimelineAware.js';
import { IComponent } from './interfaces/IComponent.js';

class MyAnimatedComponent extends IComponent {
  // Can implement ITimelineAware alongside IComponent
  
  constructor(store) {
    super(store);
    this.connect();
  }

  onStateChange(state) {
    // ... regular store subscription handling
  }

  // Implement ITimelineAware contract
  updateFlightTime(progress, currentTime) {
    this.animateToProgress(progress);
  }
}

// Later, in timeline controller:
const component = new MyAnimatedComponent(store);

if (isTimelineAware(component)) {
  // Component supports timeline updates
  component.updateFlightTime(0.5, new Date('2023-03-02T13:02:27Z'));
}
```

#### Subclasses in Codebase
- `LineChartStore` - implements updateFlightTime for chart marker movement
- `FlightMapStore` - implements updateFlightTime for map position updates
- `TimelineControllerStore` - calls updateFlightTime on registered components during playback

---

## Architecture Patterns

### Pattern 1: Store-Connected Components (IComponent)

All components follow this lifecycle:

```javascript
class MyStore extends IComponent {
  constructor(store, ...args) {
    super(store);
    // Initialize DOM, renderers, etc.
    this.connect();  // Subscribe to store
  }

  onStateChange(state) {
    // React to state changes
  }

  destroy() {
    // Cleanup DOM, timers, etc.
    super.destroy();  // Disconnects subscription
  }
}
```

### Pattern 2: Chart Components (IChart)

Charts must implement both data visualization and timeline sync:

```javascript
class LineChartStore extends IChart {
  constructor(selector, store, chartIndex, showXLabel) {
    super(store, chartIndex);
    // ... initialization
    this.connect();
  }

  onStateChange(state) {
    // Update from state changes (variable selection, etc.)
  }

  updateProgress(progress) {
    // Update from timeline playback
  }

  updateZoom(domain) {
    // Handle zoom gestures
  }
}
```

### Pattern 3: Timeline-Aware Components (ITimelineAware)

Optional mixin for components responding to timeline:

```javascript
class FlightMapStore extends IComponent {
  // ... also implements updateFlightTime from ITimelineAware

  updateFlightTime(progress, currentTime) {
    // Move map marker, update display, etc.
  }
}
```

---

## Implementation

### Implementing IComponent
- [ ] Call `super(store)` in constructor
- [ ] Call `this.connect()` after initialization
- [ ] Implement `onStateChange(state)` to handle updates
- [ ] Implement `destroy()` and call `super.destroy()`
- [ ] Use `this.dispatch(action)` for state updates
- [ ] Use `this.getState()` for current state access

### Implementing IChart
- [ ] Call `super(store, chartIndex)` in constructor
- [ ] Ensure `chartIndex` is valid (0-3)
- [ ] Implement `updateData(data, variable)`
- [ ] Implement `updateProgress(progress)` for timeline sync
- [ ] Optionally implement `updateZoom(domain)`
- [ ] Optionally implement `resetZoom()`

### Implementing ITimelineAware
- [ ] Implement `updateFlightTime(progress, currentTime)`
- [ ] Call `isTimelineAware(component)` before using timeline methods
- [ ] Handle progress range [0, 1] properly

---

## Related Documentation

- [Redux Store Architecture](../store/README.md) - Store design and state flow
- [LineChartStore Implementation](../modules/LineChartStore.js) - Concrete IChart example
- [TimelineControllerStore](../modules/TimeLineStore.js) - Coordinates timeline-aware components

---

## Summary Table

| Interface | Purpose | Extends | Required Methods | Use When |
|-----------|---------|---------|------------------|----------|
| `IComponent` | Base for store-connected components | None | `onStateChange()` | Building any component that reads/modifies store |
| `IChart` | Chart visualization contract | IComponent | `updateData()`, `updateProgress()` | Building chart components that sync with timeline |
| `ITimelineAware` | Timeline sync contract | None | `updateFlightTime()` | Component needs to respond to timeline playback |
