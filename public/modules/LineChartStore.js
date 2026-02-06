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
  getTimelineWindow
} from '../store/selectors/selectors.js';
import { chartZoom, chartResetZoom } from '../store/actions/uiActions.js';
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
    // Timeline window sync — only when user hasn't brush-zoomed
    const timelineWindow = getTimelineWindow(state, this.pageContext);
    if (!this.isManualZoom && flightData && flightData.timeRange && timelineWindow && timelineWindow.start !== undefined && timelineWindow.end !== undefined) {
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
    const configStr = JSON.stringify(variables);
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
        console.warn(`[LineChartStore ${this.chartIndex}] No variable selected for chart. Skipping chart initialization.`);
        return;
      }
      if (!this.chartInitialized) {
        this.setVariable(variable, this.longName);
      } else {
        this.addNewData();
      }
    }
    // Handle chart config changes (variables added/removed/axis changed)
    if (this.chartInitialized && changes.configStr) {
      this.changeDetector.update('configStr', configStr);

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

      // Update Title
      const titleElem = this.renderer.getSVG().select('.chart-title');
      if (titleElem.size() > 0 && variables.length > 0) {
        const firstVar = variables[0].key;
        const firstMeta = getVariableMetadata(this.getState(), firstVar);
        titleElem.text(firstMeta?.long_name || firstVar);
      }

      this.drawConfiguredLines(state);
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

      if (zoomDomain) {
        // Apply zoom for all axes
        if (zoomDomain.x) this.xScale.domain(zoomDomain.x);
        if (zoomDomain.y) this.yScale.domain(zoomDomain.y);
        if (zoomDomain.yRight && this.yScaleRight) this.yScaleRight.domain(zoomDomain.yRight);
      } else {
        // Reset to full domain — recalculate all scales from data
        this.createScales();
      }

      // Update axes with zoom awareness
      this.updateAllAxes(500, !!zoomDomain);

      // Update gridlines - use correct selectors
      this.renderer.getSVG().select(".x-grid").remove();
      this.renderer.getSVG().select(".y-grid").remove();
      this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

      // Redraw line with new domain
      this.drawConfiguredLines(this.getState());

      // Update plane icon and progress clip to last visible data point in current zoom window
      if (zoomDomain && zoomDomain.x && zoomDomain.x[0] && zoomDomain.x[1]) {
        let planeData = null;
        const xStart = zoomDomain.x[0].getTime();
        const xEnd = zoomDomain.x[1].getTime();
        for (let i = this.state.data.length - 1; i >= 0; i--) {
          const d = this.state.data[i];
          if (!d || !d.Time) continue;
          const t = d.Time.getTime();
          if (t >= xStart && t <= xEnd && isValidNumber(d[this.state.variable])) {
            planeData = d;
            break;
          }
        }

        if (planeData) {
          this.renderer.updatePlaneIcon({
            x: this.xScale(planeData.Time),
            y: this.yScale(planeData[this.state.variable])
          }, this.getHeading(planeData));
          this.renderer.updateProgressClip(this.xScale(planeData.Time));
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
      this.isManualZoom = true;
      this.dispatch(chartZoom(this.chartIndex, { x: xDomain, y: yDomain, yRight: yRightDomain }, this.pageContext));

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
    if (this.yScaleRight) {
      this.renderer.createDualAxes(this.xScale, this.yScale, this.yScaleRight, this.height, this.showXLabel);
    } else {
      this.renderer.createAxes(this.xScale, this.yScale, this.height, this.showXLabel);
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

    // Add plane icon
    const lastValidData = this.findLastValidData();
    if (lastValidData) {
      this.renderer.addPlaneIcon({
        x: this.xScale(lastValidData.Time),
        y: this.yScale(lastValidData[this.state.variable])
      }, this.getHeading(lastValidData));
    }

    // Double-click to reset zoom
    svg.on("dblclick", () => {
      this.resetZoom();
    });

    // Initialize with full data visible (progress = 1)
    this.updateProgress(1);

    console.log(`[LineChartStore ${this.chartIndex}] Chart initialized`);
  }

  /**
   * Create D3 scales
   */
  createScales() {
    // Determine axis variables from config
    const axisVars = getChartVariablesByAxis(this.getState(), this.chartIndex, this.pageContext);
    const leftVars = axisVars.left && axisVars.left.length ? axisVars.left : [this.state.variable];
    const rightVars = axisVars.right || [];

    // Use data with Time values (we'll check variable validity per-variable)
    const dataWithTime = this.state.data.filter(d => d.Time);

    if (dataWithTime.length === 0) {
      console.warn(`[LineChartStore ${this.chartIndex}] No data with Time values for creating scales`);
      return;
    }

    // Time scale (X-axis)
    const timeExtent = d3.extent(dataWithTime, d => d.Time);
    this.xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, this.width]);

    // Left Y scale extent across all left variables
    let leftMin = Infinity, leftMax = -Infinity;
    dataWithTime.forEach(d => {
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
      dataWithTime.forEach(d => {
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
    if (this.yScaleRight) {
      this.renderer.updateDualAxes(this.xScale, this.yScale, this.yScaleRight, this.showXLabel, duration, isZoomed);
    } else {
      this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, duration, isZoomed);
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
      .text(this.longName || this.state.variable);

    // Right axis label
    this.updateRightAxisLabel();
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

    // Update gridlines - use correct selectors
    this.renderer.getSVG().select(".x-grid").remove();
    this.renderer.getSVG().select(".y-grid").remove();
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Update title
    this.renderer.getSVG().select(".chart-title").text(this.longName);

    // Redraw lines
    this.drawConfiguredLines(this.getState());

    // Update plane icon
    const lastValidData = this.findLastValidData();
    if (lastValidData) {
      this.renderer.updatePlaneIcon({
        x: this.xScale(lastValidData.Time),
        y: this.yScale(lastValidData[this.state.variable])
      }, this.getHeading(lastValidData));
    }

    // Reset progress to show full data
    this.updateProgress(1);

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

    // Update clip-rect width to reveal line up to target time
    this.renderer.updateProgressClip(this.xScale(targetTime));

    // Update plane icon to last visible data point (respecting zoom window)
    let lastPoint = this.state.data[dataIndex];
    if (zoomStart && zoomEnd) {
      for (let i = dataIndex; i >= 0; i--) {
        const d = this.state.data[i];
        if (!d || !d.Time) continue;
        if (d.Time < zoomStart) break;
        if (d.Time <= targetTime && isValidNumber(d[this.state.variable])) {
          lastPoint = d;
          break;
        }
      }
    }

    const value = lastPoint[this.state.variable];
    if (isValidNumber(value)) {
      this.renderer.updatePlaneIcon({
        x: this.xScale(lastPoint.Time),
        y: this.yScale(value)
      }, this.getHeading(lastPoint));
    }
  }

  /**
   * Draw lines based on chart configuration
   * Always draws full data; progress visibility is handled by clip-rect.
   * @param {Object} state
   */
  drawConfiguredLines(state) {
    const variables = getChartVariablesWithColors(state, this.chartIndex, this.pageContext);
    const data = this.state.data;

    console.log(`[LineChartStore ${this.chartIndex}] drawConfiguredLines:`, {
      variables,
      fallbackVar: this.state.variable,
      configsPath: `ui.charts.${this.pageContext}.configs.${this.chartIndex}`,
      actualConfig: state.ui?.charts?.[this.pageContext]?.configs?.[this.chartIndex]
    });

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
        const yScale = v.axis === 'right' && this.yScaleRight ? this.yScaleRight : this.yScale;
        series.push({
          data,
          variable: v.key,
          yScale,
          color: v.color || NCAR_COLORS.primary
        });
      });
    }

    this.renderer.drawMultiLines(series, this.xScale, 0);
  }

  /**
   * Reset zoom
   */
  resetZoom() {
    this.isManualZoom = false;
    this.dispatch(chartResetZoom(this.chartIndex, this.pageContext));
  }

  /**
   * Find last valid data point
   */
  findLastValidData() {
    for (let i = this.state.data.length - 1; i >= 0; i--) {
      const entry = this.state.data[i];
      const value = entry[this.state.variable];
      if (isValidNumber(value)) {
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

    // Update all visual elements (not zoomed on resize)
    this.updateAllAxes(500, false);
    this.updateRightAxisLabel();
    this.renderer.getSVG().select(".x-grid").remove();
    this.renderer.getSVG().select(".y-grid").remove();
    this.renderer.getSVG().select(".zero-line").remove();
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);
    this.drawConfiguredLines(this.getState());

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
