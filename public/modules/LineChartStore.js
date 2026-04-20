/**
 * LineChart - Store-connected version
 * Refactored to use Redux-like store for state management
 */

import { IChart } from '../interfaces/IChart.js';
import { ChartState } from './chart/ChartState.js';
import { ChartRenderer } from './chart/ChartRenderer.js';
import { ChartInteractions } from './chart/ChartInteractions.js';
import {
  getCurrentPageData,
  getChartVariable,
  getTimelineProgress,
  getChartZoomDomain,
  getVariableMetadata,
  getChartVariablesByAxis,
  getChartAxisLabel,
  getChartVariablesWithColors,
  getChartXAxisVariable,
  getTimelineWindow
} from '../store/selectors/selectors.js';
import { chartZoom, chartResetZoom, setChartXAxisVariable } from '../store/actions/uiActions.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';
import { debounce, getAxisLabelText, isValidNumber } from './shared/utils.js';
import { NCAR_COLORS } from './shared/constants.js';

// Global store for all chart instances (for syncing interactions)
let ALL_CHART_INSTANCES = [];

/**
 * LineChart - Store-connected time-series chart
 * Extends IChart and reacts to store state changes
 */
export default class LineChartStore extends IChart {
  /**
   * @param {string} svgSelector - CSS selector for SVG container
   * @param {Store} store - Redux store instance
   * @param {number} chartIndex - Chart index (0-7)
   * @param {boolean} showXLabel - Whether to show X axis labels
   * @param {string|null} pageContext - Page context ('dashboard' or 'realtime')
   */
  constructor(svgSelector, store, chartIndex, showXLabel = false, pageContext = null) {
    super(store, chartIndex, pageContext);

    this.selector = svgSelector;
    this.svgContainer = d3.select(svgSelector);
    this.showXLabel = showXLabel;
    this.chartInitialized = false;
    this.yticks = 5;
    this.idleTimeout = null;
    this.isBrushClearing = false; // Flag to track programmatic brush clearing
    this.isManualZoom = false; // Flag to distinguish brush zoom from timeline zoom

    // Detect mobile/touch device
    this.isTouchDevice = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      window.matchMedia('(pointer: coarse)').matches;

    // Track previous state to detect changes
    this.changeDetector = new StateChangeDetector({
      flightId: null,
      variable: null,
      progress: null,
      data: null,
      zoomDomain: null,
      configStr: '[]'  // Initialize with empty array JSON
    });

    this.prevProgress = null;  // Initialize progress tracking for timeline updates

    // Initialize dimensions
    this.updateDimensions();

    // Initialize modules (with empty data initially)
    this.state = new ChartState([], null);
    this.renderer = new ChartRenderer(svgSelector, {
      width: this.width,
      height: this.height,
      margin: this.margin
    }, NCAR_COLORS);
    this.interactions = new ChartInteractions(null, this.state, ALL_CHART_INSTANCES, NCAR_COLORS);
    this.interactions.parentChart = this;
    // Scales
    this.xScale = null;
    this.yScale = null;
    this.yScaleRight = null;
    this.xAxisKey = null;

    // Add resize event listener with debouncing
    this.resizeHandler = debounce(() => this.onResize(), 250);
    window.addEventListener('resize', this.resizeHandler);

    // Add ResizeObserver for container size changes (uses same debounced handler)
    const container = document.querySelector(this.selector);
    if (window.ResizeObserver && container) {
      this._resizeObserver = new ResizeObserver(this.resizeHandler);
      this._resizeObserver.observe(container);
    }

    // Add this chart instance to global registry
    ALL_CHART_INSTANCES.push(this);

    // Connect to store and initialize with current state
    this.connect();
    this.onStateChange(this.getState());
  }

  /**
   * Handle store state changes
   * Called whenever store state updates
   */
  onStateChange(state) {
    const flightId = state.selection.flightId;
    const variable = getChartVariable(state, this.chartIndex, this.pageContext);
    const progress = getTimelineProgress(state);
    const zoomDomain = getChartZoomDomain(state, this.chartIndex, this.pageContext);
    this.currentZoomDomain = zoomDomain || null;
    const flightData = getCurrentPageData(state, this.pageContext);
    // Timeline window sync — only when user hasn't brush-zoomed and chart uses Time axis
    // Charts with a custom x-axis variable use a linear scale, not time, so
    // applying a time-based zoom domain would be meaningless.
    const timelineWindow = getTimelineWindow(state, this.pageContext);
    if (!this.isManualZoom && !this.xAxisKey && flightData && flightData.timeRange && timelineWindow && timelineWindow.start !== undefined && timelineWindow.end !== undefined) {
      const { start, end } = timelineWindow;
      const t0 = flightData.timeRange.start.getTime();
      const t1 = flightData.timeRange.end.getTime();
      const xStart = new Date(t0 + (t1 - t0) * start);
      const xEnd = new Date(t0 + (t1 - t0) * end);

      // Avoid redundant dispatch if zoom already matches timeline window
      const hasZoom = !!(zoomDomain && zoomDomain.x && zoomDomain.x[0] && zoomDomain.x[1]);
      const alreadySynced = hasZoom &&
        zoomDomain.x[0].getTime() === xStart.getTime() &&
        zoomDomain.x[1].getTime() === xEnd.getTime();

      if (!alreadySynced) {
        this.dispatch(chartZoom(this.chartIndex, { x: [xStart, xEnd], y: zoomDomain ? zoomDomain.y : null }, this.pageContext));
        // Return — the dispatch triggers a re-entrant onStateChange that
        // processes the new zoom with fresh state.  Continuing here would
        // use the stale local `zoomDomain` and undo the zoom.
        return;
      }
    }

    // Debug logging of state changes
    // console.log(`[LineChartStore ${this.chartIndex}] State change:`, {
    //   flightId,
    //   variable,
    //   progress,
    //   zoomDomain,
    //   hasData: !!flightData,
    //   dataLength: flightData?.timeseries?.length || 0 });

    // Check if we have data
    if (!flightData || !flightData.timeseries || flightData.timeseries.length === 0) {
      return;
    }

    const variables = getChartVariablesWithColors(state, this.chartIndex, this.pageContext);
    const xAxisKey = getChartXAxisVariable(state, this.chartIndex, this.pageContext);
    const configStr = JSON.stringify({ variables, xAxisKey });
    // Check if flight data or config changed
    const changes = this.changeDetector.detectChanges({
      flightId,
      variable,
      configStr,
      data: flightData.timeseries
    });

    if (changes.flightId || changes.variable || changes.data) {
      // console.log(`[LineChartStore ${this.chartIndex}] Data/variable changed`, changes);

      // Update state
      this.state.updateData(flightData.timeseries, variable);
      this.changeDetector.updateAll({
        flightId,
        variable,
        data: flightData.timeseries,
        configStr  // Include configStr in update
      });

      // Get variable metadata for display name and units
      const metadata = getVariableMetadata(state, variable);
      this.longName = metadata?.long_name || variable;
      this.long_name = this.longName;
      this.units = metadata?.units || variable;

      // Only initialize or update chart if variable is valid
      if (!variable) {
        if (!this.chartInitialized) {
          // Can't initialize without a primary variable — skip entirely
          return;
        }
        // Already initialized: fall through so configStr changes still apply below
      } else if (!this.chartInitialized) {
        this.setVariable(variable, this.longName);
      } else {
        this.addNewData();
      }
    }
    // Handle chart config changes (variables added/removed/axis changed)
    if (this.chartInitialized && changes.configStr) {
      this.changeDetector.update('configStr', configStr);

      // Keep ChartState aware of all configured Y-axis variables
      // Use the local xAxisKey (from current state) since this.xAxisKey
      // won't be updated until createScales() runs below.
      const yVarKeys = (variables || [])
        .filter(v => !(xAxisKey && v.key === xAxisKey))
        .map(v => v.key);
      this.state.setVariables(yVarKeys);

      // Recreate scales
      this.createScales();

      // Remove old right axis parts if needed
      if (!this.yScaleRight && this.renderer.yAxisRight) {
        this.renderer.getSVG().select('.y-axis-right').remove();
        this.renderer.getSVG().select('.y-axis-label-right').remove();
        this.renderer.yAxisRight = null;
      }

      // Ensure right axis group exists if needed
      if (this.yScaleRight && !this.renderer.yAxisRight) {
        this.renderer.yAxisRight = this.renderer.getSVG().append('g')
          .attr('class', 'y-axis-right')
          .attr('transform', `translate(${this.width},0)`)
          .call(d3.axisRight(this.yScaleRight).ticks(5));
      }
      this.updateAllAxes(300, false);

      // Update Axis Labels using consolidated method
      this.updateAxisLabel('left');
      this.updateAxisLabel('right');
      this.updateXAxisLabel();

      // Update Title
      const titleElem = this.renderer.getSVG().select('.chart-title');
      if (titleElem.size() > 0) {
        titleElem.text(this.getChartTitle(this.getState()));
      }

      this.drawConfiguredLines(state);
    }

    // For custom x-axis charts, react to timeline window changes by re-filtering
    // data and redrawing. Time-axis charts handle this via zoom dispatch above.
    if (this.chartInitialized && this.xAxisKey) {
      const twStr = JSON.stringify(timelineWindow);
      if (this.changeDetector.hasChanged('timelineWindow', twStr)) {
        this.changeDetector.update('timelineWindow', twStr);
        this.createScales();
        this.updateAllAxes(300, false);
        this.renderer.getSVG().select(".x-grid").remove();
        this.renderer.getSVG().select(".y-grid").remove();
        this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);
        this.drawConfiguredLines(this.getState());
      }
    }

    // Update progress (independent of data changes)
    if (this.chartInitialized && this.prevProgress !== progress) {
      this.updateProgress(progress);
      this.prevProgress = progress;
    }

    // Update zoom (independent of data changes)
    const zoomChanged = this.changeDetector.hasChanged('zoomDomain', JSON.stringify(zoomDomain));
    // Zoom debug logging
    // console.log(`[LineChartStore ${this.chartIndex}] Zoom check:`, {
    //   chartInitialized: this.chartInitialized,
    //   zoomChanged,
    //   hasXScale: !!this.xScale,
    //   prevZoomDomain: this.changeDetector.get('zoomDomain'),
    //   zoomDomain: zoomDomain
    // });

    if (this.chartInitialized && zoomChanged && this.xScale) {
      // console.log(`[LineChartStore ${this.chartIndex}] Applying zoom change`);

      // Always reset scales to full data extent first, then apply any zoomed domains
      this.createScales();
      if (zoomDomain) {
        if (zoomDomain.x) this.xScale.domain(zoomDomain.x);
        if (zoomDomain.y) this.yScale.domain(zoomDomain.y);
        if (zoomDomain.yRight && this.yScaleRight) this.yScaleRight.domain(zoomDomain.yRight);
      }

      // Update axes with zoom awareness
      this.updateAllAxes(500, !!zoomDomain);

      // Update gridlines - use correct selectors
      this.renderer.getSVG().select(".x-grid").remove();
      this.renderer.getSVG().select(".y-grid").remove();
      this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

      // Redraw line with new domain
      this.drawConfiguredLines(this.getState());

      // Update line end markers and progress clip to last visible data point in current zoom window
      if (zoomDomain && zoomDomain.x && zoomDomain.x[0] && zoomDomain.x[1]) {
        let planeData = null;
        const xStart = zoomDomain.x[0];
        const xEnd = zoomDomain.x[1];
        for (let i = this.state.data.length - 1; i >= 0; i--) {
          const d = this.state.data[i];
          const xVal = this.getXValue(d);
          if (xVal == null) continue;
          if (xVal >= xStart && xVal <= xEnd && this.state.hasValidData(d)) {
            planeData = d;
            break;
          }
        }

        if (planeData) {
          const series = this.buildSeriesData(this.getState());
          this.renderer.updateLineEndMarkers(series, planeData, this.xScale, this.getXValue.bind(this));
          this.renderer.updateProgressClip(this.xScale(this.getXValue(planeData)));
        } else {
          this.renderer.updateProgressClip(0);
        }
      }

      this.changeDetector.update('zoomDomain', JSON.stringify(zoomDomain));
    }
  }

  /**
   * Update dimensions based on container size
   */
  updateDimensions() {
    const container = document.querySelector(this.selector);
    if (!container) return;

    const containerWidth = container.clientWidth || 600;
    const containerHeight = container.clientHeight || 300;

    this.margin = { top: 20, right: 54, bottom: this.showXLabel ? 30 : 15, left: 50 };

    // Ensure minimum dimensions to prevent negative values
    this.width = Math.max(100, containerWidth - this.margin.left - this.margin.right);
    this.height = Math.max(50, containerHeight - this.margin.top - this.margin.bottom);
  }

  /**
   * Set variable and initialize chart
   */
  setVariable(cleanName, long_name = null) {
    console.log(`[LineChartStore ${this.chartIndex}] setVariable:`, { cleanName });

    if (!this.state.data || this.state.data.length === 0) {
      console.error(`[LineChartStore ${this.chartIndex}] No data available`);
      return;
    }

    const availableColumns = Object.keys(this.state.data[0]);

    // Validate variable exists
    if (!availableColumns.includes(cleanName)) {
      console.error(`[LineChartStore ${this.chartIndex}] Variable ${cleanName} not found in data`);
      return;
    }

    this.state.setVariable(cleanName);
    this.longName = long_name || cleanName;
    this.long_name = this.longName;

    // Validate data
    const hasValidData = this.state.data.some(entry => isValidNumber(entry[cleanName]));

    if (!hasValidData) {
      console.error(`[LineChartStore ${this.chartIndex}] No valid data for variable ${cleanName}`);
      const container = document.querySelector(this.selector);
      if (container) {
        container.innerHTML = `<div class="chart-no-data-message">No valid data for <strong>${cleanName}</strong></div>`;
      }
      return;
    }

    // Initialize chart
    this.initChart();
    this.chartInitialized = true;
  }
    handleBrushEnd(selection) {
    // D3 v6 passes the event object, selection is event.selection
    const sel = selection && selection.selection ? selection.selection : selection;
    if (!sel) return;
    if (!Array.isArray(sel) || sel.length !== 2 || !Array.isArray(sel[0]) || !Array.isArray(sel[1])) return;
    const [[x0, y0], [x1, y1]] = sel;
    // Ignore tiny brush selections (accidental clicks)
    if (Math.abs(x1 - x0) < 10 && Math.abs(y1 - y0) < 10) return;
    if (this.xScale && this.yScale) {
      const xDomain = [this.xScale.invert(x0), this.xScale.invert(x1)];
      // SVG Y is inverted: y0 (top pixel) maps to larger value, y1 (bottom) to smaller
      const yDomain = [this.yScale.invert(y1), this.yScale.invert(y0)];
      const yRightDomain = this.yScaleRight
        ? [this.yScaleRight.invert(y1), this.yScaleRight.invert(y0)]
        : null;

      // Sync zoom across charts with matching x-axis type — share X domain, per-chart Y
      // A time-based domain can't be applied to a linear scale and vice versa.
      const myXAxisKey = this.xAxisKey;
      ALL_CHART_INSTANCES.forEach(chart => {
        if (chart.xAxisKey !== myXAxisKey) return; // skip incompatible axis types
        chart.isManualZoom = true;
        if (chart === this) {
          this.dispatch(chartZoom(chart.chartIndex, { x: xDomain, y: yDomain, yRight: yRightDomain }, chart.pageContext));
        } else {
          this.dispatch(chartZoom(chart.chartIndex, { x: xDomain, y: null, yRight: null }, chart.pageContext));
        }
      });

      // Clear the brush rectangle so it doesn't stay visible after zooming
      this.isBrushClearing = true;
      this.renderer.getSVG().select(".brush").call(this.renderer.brush.move, null);
    }
  }

  /**
   * Initialize the chart
   */
  initChart() {
    // Recalculate dimensions to get actual container size after layout
    this.updateDimensions();

    // Update renderer with correct dimensions
    this.renderer.updateDimensions({
      width: this.width,
      height: this.height,
      margin: this.margin
    });

    // Initialize SVG
    this.renderer.initSVG();
    this.interactions.svg = this.renderer.getSVG();

    // Clean up any duplicate elements from previous initialization attempts
    this.renderer.removeDuplicates();

    // Create scales
    this.createScales();

    // Create axes
    const xTickFormat = this.getXAxisTickFormat();
    if (this.yScaleRight) {
      this.renderer.createDualAxes(this.xScale, this.yScale, this.yScaleRight, this.height, this.showXLabel, xTickFormat);
    } else {
      this.renderer.createAxes(this.xScale, this.yScale, this.height, this.showXLabel, xTickFormat);
    }

    // Add gridlines
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Add axis labels and title
    this.addLabels();

    // Create clip paths for brushing and progress animation
    this.renderer.createClipPath(this.width, this.height, this.chartIndex);

    // Draw initial lines
    this.drawConfiguredLines(this.getState());

    // Add interactions (tooltip and vertical line)
    this.interactions.initTooltip();
    this.interactions.initVerticalLine(this.height);

    const svg = this.renderer.getSVG();

    // Add brush for zooming - only on non-touch devices
    // Touch devices use the timeline window instead to avoid accidental zoom while scrolling
    if (!this.isTouchDevice) {
      this.renderer.addBrush(this.width, this.height, this.handleBrushEnd.bind(this));
    }

    // Attach tooltip events to the brush overlay (which captures mouse events)
    const brushOverlay = svg.select(".brush .overlay");
    if (!brushOverlay.empty()) {
      brushOverlay
        .on("mousemove", (event) => {
          this.interactions.onMouseMove(event, this.xScale, this.yScale, this.longName);
        })
        .on("mouseout", () => {
          this.interactions.onMouseOut();
        });
    }

    // Initialize line end markers for current time indicators
    this.renderer.initializeLineEndMarkers();

    // Double-click to reset zoom
    svg.on("dblclick", () => {
      this.resetZoom();
    });

    // Initialize with full data visible (progress = 1)
    this.updateProgress(1);

    console.log(`[LineChartStore ${this.chartIndex}] Chart initialized`);
  }

  /**
   * Filter data to the current timeline window for custom x-axis charts.
   * Time-axis charts return the full dataset (timeline handled via zoom).
   * @param {Array} dataWithTime - Data filtered to entries with valid Time
   * @returns {Array} Timeline-filtered data
   */
  getTimelineFilteredData(dataWithTime) {
    if (!this.xAxisKey) return dataWithTime;
    const timelineWindow = getTimelineWindow(this.getState(), this.pageContext);
    const flightData = getCurrentPageData(this.getState(), this.pageContext);
    if (timelineWindow && flightData && flightData.timeRange &&
        timelineWindow.start !== undefined && timelineWindow.end !== undefined) {
      const t0 = flightData.timeRange.start.getTime();
      const t1 = flightData.timeRange.end.getTime();
      const windowStart = new Date(t0 + (t1 - t0) * timelineWindow.start);
      const windowEnd = new Date(t0 + (t1 - t0) * timelineWindow.end);
      const filtered = dataWithTime.filter(d => d.Time >= windowStart && d.Time <= windowEnd);
      return filtered.length > 0 ? filtered : dataWithTime;
    }
    return dataWithTime;
  }

  /**
   * Create D3 scales
   */
  createScales() {
    // Determine axis variables from config
    const axisVars = getChartVariablesByAxis(this.getState(), this.chartIndex, this.pageContext);

    // Get x-axis config first so we can exclude it from y-axis variables
    const xAxisKey = getChartXAxisVariable(this.getState(), this.chartIndex, this.pageContext);
    this.xAxisKey = xAxisKey || null;

    // Filter out the x-axis variable from y-axis variables (it defines the horizontal axis, not a line)
    let leftVars = axisVars.left && axisVars.left.length ? axisVars.left : [this.state.variable];
    let rightVars = axisVars.right || [];
    if (this.xAxisKey) {
      leftVars = leftVars.filter(v => v !== this.xAxisKey);
      rightVars = rightVars.filter(v => v !== this.xAxisKey);
    }

    // Use data with Time values (we'll check variable validity per-variable)
    const dataWithTime = this.state.data.filter(d => d.Time);

    if (dataWithTime.length === 0) {
      console.warn(`[LineChartStore ${this.chartIndex}] No data with Time values for creating scales`);
      return;
    }

    // Filter to timeline window (only affects custom x-axis charts)
    const renderData = this.getTimelineFilteredData(dataWithTime);
    // Cache for use by buildSeriesData() and updateProgress() — always
    // refreshed here so consumers don't need a stale-data fallback.
    this._renderData = renderData;

    let dataForX = !this.xAxisKey
      ? renderData
      : renderData.filter(d => isValidNumber(d[this.xAxisKey]));

    if (!dataForX.length) {
      console.warn(`[LineChartStore ${this.chartIndex}] No valid data for X-axis variable "${xAxisKey}", resetting to Time`);
      this.xAxisKey = null;
      dataForX = renderData;
      // Sync the store so the UI (SettingsOverlay) reflects the fallback
      this.dispatch(setChartXAxisVariable(this.chartIndex, null, this.pageContext));
    }

    if (!this.xAxisKey) {
      const rtState = this.pageContext === 'realtime' ? this.getState().realtime : null;
      if (rtState?.timeWindow && rtState?.timeRange?.end) {
        // Fixed scrolling window: keep right edge 8% past latest data for breathing room
        const windowMs = rtState.timeWindow * 60 * 1000;
        const rightPadMs = windowMs * 0.08;
        const domainEnd = new Date(rtState.timeRange.end.getTime() + rightPadMs);
        const domainStart = new Date(rtState.timeRange.end.getTime() - windowMs);
        this.xScale = d3.scaleTime()
          .domain([domainStart, domainEnd])
          .range([0, this.width]);
      } else {
        const timeExtent = d3.extent(dataForX, d => d.Time);
        this.xScale = d3.scaleTime()
          .domain(timeExtent)
          .range([0, this.width]);
      }
    } else {
      const xExtent = d3.extent(dataForX, d => d[this.xAxisKey]);
      this.xScale = d3.scaleLinear()
        .domain(xExtent)
        .range([0, this.width]);
    }

    // Build sorted index for O(log n) hover lookups on custom x-axis
    this.state.buildSortedIndex(this.xAxisKey);

    // Left Y scale extent across all left variables
    let leftMin = Infinity, leftMax = -Infinity;
    renderData.forEach(d => {
      leftVars.forEach(v => {
        const val = d[v];
        if (isValidNumber(val)) {
          leftMin = Math.min(leftMin, val);
          leftMax = Math.max(leftMax, val);
        }
      });
    });
    if (!isFinite(leftMin) || !isFinite(leftMax)) {
      leftMin = 0; leftMax = 1;
    }
    const leftPad = (leftMax - leftMin) * 0.1 || 1;
    this.yScale = d3.scaleLinear()
      .domain([leftMin - leftPad, leftMax + leftPad])
      .range([this.height, 0]);

    // Right Y scale if any right variables
    if (rightVars.length) {
      let rMin = Infinity, rMax = -Infinity;
      renderData.forEach(d => {
        rightVars.forEach(v => {
          const val = d[v];
          if (isValidNumber(val)) {
            rMin = Math.min(rMin, val);
            rMax = Math.max(rMax, val);
          }
        });
      });
      if (!isFinite(rMin) || !isFinite(rMax)) {
        rMin = 0; rMax = 1;
      }
      const rPad = (rMax - rMin) * 0.1 || 1;
      this.yScaleRight = d3.scaleLinear()
        .domain([rMin - rPad, rMax + rPad])
        .range([this.height, 0]);
    } else {
      this.yScaleRight = null;
    }

    // Aliases for backward compatibility
    this.x = this.xScale;
    this.y = this.yScale;
  }

  /**
   * Update axes, handling dual-axis configuration automatically
   * @param {number} duration - Transition duration in ms
   * @param {boolean} isZoomed - Whether chart is in zoomed state
   */
  updateAllAxes(duration = 500, isZoomed = false) {
    const xTickFormat = this.getXAxisTickFormat();
    if (this.yScaleRight) {
      this.renderer.updateDualAxes(this.xScale, this.yScale, this.yScaleRight, this.showXLabel, duration, isZoomed, xTickFormat);
    } else {
      this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, duration, isZoomed, xTickFormat);
    }
  }

  /**
   * Create or update a Y-axis label (left or right)
   * @param {string} side - 'left' or 'right'
   */
  updateAxisLabel(side = 'left') {
    const svg = this.renderer.getSVG();
    const className = side === 'left' ? 'y-axis-label' : 'y-axis-label-right';
    
    svg.selectAll(`.${className}`).remove();

    // Skip if right axis doesn't exist
    if (side === 'right' && !this.yScaleRight) return;

    const axisVars = getChartVariablesByAxis(this.getState(), this.chartIndex, this.pageContext);
    const variable = side === 'left' ? axisVars.left?.[0] : axisVars.right?.[0];
    const meta = variable ? getVariableMetadata(this.getState(), variable) : null;
    const units = meta?.units || (side === 'left' ? this.units : '');
    const axisLabel = getChartAxisLabel(this.getState(), this.chartIndex, side, this.pageContext);
    const labelText = getAxisLabelText(axisLabel, units, variable);
    const x = this.height / 2;
    if (side === 'left') {
      svg.append('text')
        .attr('class', className)
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - this.margin.left)
        .attr('x', -x)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text(labelText);
    } else {
      const y = this.width + (this.margin.right / 2) + 15;
      svg.append('text')
        .attr('class', className)
        .style('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('y', y)
        .attr('x', -x)
        .style('font-size', '12px')
        .style('fill', '#666')
        .text(labelText);
    }
  }

  /**
   * Update or create the right Y-axis label from current state
   * (Convenience method that calls updateAxisLabel)
   */
  updateRightAxisLabel() {
    this.updateAxisLabel('right');
  }

  /**
   * Update or create the X-axis label.
   * Only shown for custom x-axis variables (Time is self-evident from tick format).
   */
  updateXAxisLabel() {
    const svg = this.renderer.getSVG();
    svg.selectAll('.x-axis-label').remove();

    if (!this.xAxisKey) return;

    const meta = getVariableMetadata(this.getState(), this.xAxisKey);
    const name = meta?.long_name || this.xAxisKey;
    const units = meta?.units || '';
    const labelText = units ? `${name} (${units})` : name;

    svg.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', this.width / 2)
      .attr('y', this.height + this.margin.bottom - 2)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(labelText);
  }

  /**
   * Get the active X-axis key (null means Time)
   */
  getXAxisKey() {
    return this.xAxisKey || null;
  }

  /**
   * Get the X-axis title text
   * Centralized for future x-axis selection changes
   * @param {Object} state - Redux state
   */
  getXAxisTitle(state) {
    const xAxisKey = getChartXAxisVariable(state, this.chartIndex, this.pageContext);
    if (!xAxisKey) return 'Time';
    const meta = getVariableMetadata(state, xAxisKey);
    return meta?.long_name || xAxisKey;
  }

  /**
   * Get X-axis tick formatter based on axis type
   */
  getXAxisTickFormat() {
    return this.xAxisKey ? null : d3.timeFormat('%H:%M');
  }

  /**
   * Get X value for a data point based on active axis
   * @param {Object} d - Data point
   * @returns {number|Date}
   */
  getXValue(d) {
    if (!d) return null;
    return this.xAxisKey ? d[this.xAxisKey] : d.Time;
  }

  /**
   * Build the chart title based on selected variables
   * @param {Object} state - Redux state
   * @returns {string}
   */
  getChartTitle(state) {
    const variables = getChartVariablesWithColors(state, this.chartIndex, this.pageContext);
    const xAxisTitle = this.getXAxisTitle(state);

    const xAxisKey = getChartXAxisVariable(state, this.chartIndex, this.pageContext);
    const yVars = (variables && variables.length)
      ? variables.filter(v => !(xAxisKey && v.key === xAxisKey))
      : [];
    const displayNames = yVars.length
      ? yVars.map(v => {
          const meta = getVariableMetadata(state, v.key);
          return meta?.long_name || v.key;
        })
      : [this.longName || this.state.variable];

    const count = displayNames.length;
    if (count === 1) {
      return `${displayNames[0]} over ${xAxisTitle}`;
    }
    if (count === 2) {
      return `${displayNames[0]}, ${displayNames[1]} over ${xAxisTitle}`;
    }
    if (count === 3) {
      return `${displayNames[0]}, ${displayNames[1]} & ${displayNames[2]} over ${xAxisTitle}`;
    }
    return `Multiple Metrics (${count}) over ${xAxisTitle}`;
  }

  /**
   * Add axis labels and title
   */
  addLabels() {
    const svg = this.renderer.getSVG();

    // Left Y-axis label
    this.updateAxisLabel('left');

    // Chart title
    svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', this.width / 2)
      .attr('y', -5)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '500')
      .style('fill', '#333')
      .text(this.getChartTitle(this.getState()));

    // Right axis label
    this.updateRightAxisLabel();

    // X-axis label (only for custom x-axis variable)
    this.updateXAxisLabel();
  }

  /**
   * Update chart with new data (when variable changes)
   */
  addNewData() {
    if (!this.chartInitialized) return;

    // console.log(`[LineChartStore ${this.chartIndex}] Updating chart with new data`);

    // Recreate scales
    this.createScales();

    // Update axes (not zoomed on data update)
    this.updateAllAxes(500, false);
    this.updateAxisLabel('left');
    this.updateAxisLabel('right');
    this.updateXAxisLabel();

    // Update gridlines - use correct selectors
    this.renderer.getSVG().select(".x-grid").remove();
    this.renderer.getSVG().select(".y-grid").remove();
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Update title
    this.renderer.getSVG().select(".chart-title").text(this.getChartTitle(this.getState()));

    // Redraw lines
    this.drawConfiguredLines(this.getState());

    // Update line end markers
    const lastValidData = this.findLastValidData();
    if (lastValidData) {
      const series = this.buildSeriesData(this.getState());
      this.renderer.updateLineEndMarkers(series, lastValidData, this.xScale, this.getXValue.bind(this));
    }

    // Reset progress to show full data, but preserve an active review position
    const reviewProgress = getTimelineProgress(this.getState());
    this.updateProgress(reviewProgress > 0 && reviewProgress < 1.0 ? reviewProgress : 1);

    // Defer resize to ensure chart fills container after layout
    setTimeout(() => this.onResize(), 0);
  }

  /**
   * Update progress (for timeline animation)
   * Uses a clip-rect to reveal the pre-rendered full path progressively,
   * avoiding expensive SVG path `d` attribute regeneration on every tick.
   * @param {number} progress - Progress from 0 to 1
   */
  updateProgress(progress) {
    if (!this.chartInitialized || !this.xScale || !this.state.data.length) return;

    // Custom x-axis charts: the clip-rect approach doesn't work because the
    // x-axis isn't time-ordered (data can zigzag left/right).  Instead, redraw
    // with a time-filtered subset so points appear chronologically.
    if (this.xAxisKey) {
      this.state.updateProgress(progress);
      this.renderer.updateProgressClip(this.width);

      const dataIndex = Math.min(
        this.state.data.length - 1,
        Math.max(0, Math.floor(this.state.data.length * progress) - 1)
      );

      // Skip redundant redraws when the data boundary hasn't moved
      if (progress < 1 && this._lastXAxisProgressIdx === dataIndex) return;
      this._lastXAxisProgressIdx = dataIndex;

      const progressTime = this.state.data[dataIndex].Time;
      const baseData = this._renderData;
      const progressData = baseData.filter(d => d.Time && d.Time <= progressTime);
      if (progressData.length === 0) return;

      // Build series with progress-filtered data
      const variables = getChartVariablesWithColors(this.getState(), this.chartIndex, this.pageContext);
      const series = [];
      if (!variables || variables.length === 0) {
        series.push({ data: progressData, variable: this.state.variable, yScale: this.yScale, color: NCAR_COLORS.primary });
      } else {
        variables.forEach(v => {
          if (v.key === this.xAxisKey) return;
          const yScale = v.axis === 'right' && this.yScaleRight ? this.yScaleRight : this.yScale;
          series.push({ data: progressData, variable: v.key, yScale, color: v.color || NCAR_COLORS.primary });
        });
      }

      this.renderer.drawMultiLines(series, this.xScale, this.getXValue.bind(this), 0);
      const lastPoint = progressData[progressData.length - 1];
      this.renderer.updateLineEndMarkers(series, lastPoint, this.xScale, this.getXValue.bind(this));
      return;
    }

    this.state.updateProgress(progress);

    if (progress <= 0) {
      this.renderer.updateProgressClip(0);
      return;
    }

    // Find the data point at current progress
    const dataIndex = Math.min(
      this.state.data.length - 1,
      Math.max(0, Math.floor(this.state.data.length * progress) - 1)
    );
    const progressTime = this.state.data[dataIndex].Time;

    // If zoomed, clamp progress to zoom window so clip doesn't reveal full dataset
    let targetTime = progressTime;
    let zoomStart = null;
    let zoomEnd = null;
    if (this.currentZoomDomain && this.currentZoomDomain.x && this.currentZoomDomain.x[0] && this.currentZoomDomain.x[1]) {
      zoomStart = this.currentZoomDomain.x[0];
      zoomEnd = this.currentZoomDomain.x[1];
      if (progressTime < zoomStart) targetTime = zoomStart;
      if (progressTime > zoomEnd) targetTime = zoomEnd;
    }

    // Update line end markers to last visible data point (respecting zoom window)
    let lastPoint = this.state.data[dataIndex];
    if (zoomStart && zoomEnd) {
      for (let i = dataIndex; i >= 0; i--) {
        const d = this.state.data[i];
        if (!d || !d.Time) continue;
        if (d.Time < zoomStart) break;
        if (d.Time <= targetTime && this.state.hasValidData(d)) {
          lastPoint = d;
          break;
        }
      }
    }

    const xValue = this.getXValue(lastPoint);
    if (xValue !== null && xValue !== undefined) {
      this.renderer.updateProgressClip(this.xScale(xValue));
    }

    if (this.state.hasValidData(lastPoint)) {
      const series = this.buildSeriesData(this.getState());
      this.renderer.updateLineEndMarkers(series, lastPoint, this.xScale, this.getXValue.bind(this));
    }
  }

  /**
   * Draw lines based on chart configuration
   * Always draws full data; progress visibility is handled by clip-rect.
   * @param {Object} state
   */
  drawConfiguredLines(state) {
    const series = this.buildSeriesData(state);
    this.renderer.drawMultiLines(series, this.xScale, this.getXValue.bind(this), 0);
  }

  /**
   * Build series data with colors and scales for visualization
   * Helper method used for both drawing lines and updating markers
   * @param {Object} state - Redux state
   * @returns {Array} Series array with {data, variable, yScale, color}
   */
  buildSeriesData(state) {
    const variables = getChartVariablesWithColors(state, this.chartIndex, this.pageContext);
    // Use timeline-filtered data cached by createScales()
    const data = this._renderData;

    const series = [];

    // If no variables configured, fall back to default behavior
    if (!variables || variables.length === 0) {
      series.push({
        data,
        variable: this.state.variable,
        yScale: this.yScale,
        color: NCAR_COLORS.primary
      });
    } else {
      // Build series from configured variables with their colors and scales
      variables.forEach(v => {
        // Skip the x-axis variable — it defines the horizontal axis, not a line
        if (this.xAxisKey && v.key === this.xAxisKey) return;
        const yScale = v.axis === 'right' && this.yScaleRight ? this.yScaleRight : this.yScale;
        series.push({
          data,
          variable: v.key,
          yScale,
          color: v.color || NCAR_COLORS.primary
        });
      });
    }

    return series;
  }

  /**
   * Reset zoom
   */
  resetZoom() {
    // Reset all charts so they stay in sync
    ALL_CHART_INSTANCES.forEach(chart => {
      chart.isManualZoom = false;
      this.dispatch(chartResetZoom(chart.chartIndex, chart.pageContext));
    });
  }

  /**
   * Find last valid data point
   */
  findLastValidData() {
    for (let i = this.state.data.length - 1; i >= 0; i--) {
      const entry = this.state.data[i];
      if (this.state.hasValidData(entry)) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Get heading from a data entry
   */
  getHeading(entry) {
    if (!entry) return undefined;
    return entry.THDG ?? entry.thdg;
  }

  /**
   * Handle window resize
   */
  onResize() {
    if (!this.chartInitialized) return;

    // console.log(`[LineChartStore ${this.chartIndex}] Handling resize`); // DEBUG

    // Update dimensions
    this.updateDimensions();

    // Update renderer dimensions
    this.renderer.updateDimensions({
      width: this.width,
      height: this.height,
      margin: this.margin
    });

    // Recreate scales
    this.createScales();

    // Re-apply zoom domain if present
    if (this.currentZoomDomain) {
      const { x, y, yRight } = this.currentZoomDomain;
      if (x) this.xScale.domain(x);
      if (y) this.yScale.domain(y);
      if (yRight && this.yScaleRight) this.yScaleRight.domain(yRight);
    }

    const isZoomed = !!(this.currentZoomDomain && this.currentZoomDomain.x);

    // Update all visual elements (keep zoom state on resize)
    this.updateAllAxes(500, isZoomed);
    this.updateRightAxisLabel();
    this.renderer.getSVG().select(".x-grid").remove();
    this.renderer.getSVG().select(".y-grid").remove();
    this.renderer.getSVG().select(".zero-line").remove();
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);
    this.drawConfiguredLines(this.getState());
    this.updateProgress(this.state.progress ?? 1);

    // Update interactions (vertical line height)
    this.interactions.updateVerticalLineHeight(this.height);

    // Update brush dimensions
    if (this.renderer.brush && this.renderer.brushGroup) {
      this.renderer.brush.extent([[0, 0], [this.width, this.height]]);
      this.renderer.brushGroup.call(this.renderer.brush);
    }
  }

  /**
   * Update data (implements IChart interface)
   */
  updateData(data, variable) {
    this.state.updateData(data, variable);
    if (this.chartInitialized) {
      this.addNewData();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log(`[LineChartStore ${this.chartIndex}] Destroying`);

    // Remove resize listener
    window.removeEventListener('resize', this.resizeHandler);

    // Remove ResizeObserver
    if (this._resizeObserver) {
      const container = document.querySelector(this.selector);
      if (container) this._resizeObserver.unobserve(container);
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // Disconnect from store
    super.destroy();

    // Clear SVG
    if (this.renderer && this.renderer.getSVG()) {
      this.renderer.getSVG().selectAll("*").remove();
    }

    // Remove from global registry to keep tooltips in sync with active charts
    const idx = ALL_CHART_INSTANCES.indexOf(this);
    if (idx !== -1) {
      ALL_CHART_INSTANCES.splice(idx, 1);
    }
  }
}

// Export chart instances globally for external access (e.g., FullscreenOverlay)
window.ALL_CHART_INSTANCES = ALL_CHART_INSTANCES;
