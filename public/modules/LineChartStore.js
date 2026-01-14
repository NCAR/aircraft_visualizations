/**
 * LineChart - Store-connected version
 * Refactored to use Redux-like store for state management
 */

import { IChart } from '../interfaces/IChart.js';
import { ChartState } from './chart/ChartState.js';
import { ChartRenderer } from './chart/ChartRenderer.js';
import { ChartInteractions } from './chart/ChartInteractions.js';
import {
  getCurrentFlightData,
  getChartVariable,
  getTimelineProgress,
  getChartZoomDomain,
  getVariableMetadata
} from '../store/selectors/selectors.js';
import { chartZoom, chartResetZoom } from '../store/actions/uiActions.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';
import { debounce } from './shared/utils.js';

// NCAR Design System Colors
const NCAR_COLORS = {
  primary: '#0057C2',    // NCAR Blue
  accent: '#FAA119'      // NCAR Orange
};

// Global store for all chart instances (for syncing interactions)
let ALL_CHART_INSTANCES = [];

/**
 * LineChart - Store-connected time-series chart
 * Extends IChart and reacts to store state changes
 */
export default class LineChartStore extends IChart {
  constructor(svgSelector, store, chartIndex, showXLabel = false) {
    super(store, chartIndex);

    this.selector = svgSelector;
    this.svgContainer = d3.select(svgSelector);
    this.showXLabel = showXLabel;
    this.chartInitialized = false;
    this.yticks = 5;
    this.idleTimeout = null;
    this.isBrushClearing = false; // Flag to track programmatic brush clearing

    // Track previous state to detect changes
    this.changeDetector = new StateChangeDetector({
      flightId: null,
      variable: null,
      progress: null,
      data: null,
      zoomDomain: null
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

    // Add resize event listener with debouncing
    this.resizeHandler = debounce(() => this.onResize(), 250);
    window.addEventListener('resize', this.resizeHandler);

    // Add this chart instance to global registry
    ALL_CHART_INSTANCES.push(this);

    // Connect to store and initialize with current state
    this.connect();
    this.onStateChange(this.getState());

    console.log(`[LineChartStore ${chartIndex}] Created`);
  }

  /**
   * Handle store state changes
   * Called whenever store state updates
   */
  onStateChange(state) {
    const flightId = state.selection.flightId;
    const variable = getChartVariable(state, this.chartIndex);
    const progress = getTimelineProgress(state);
    const zoomDomain = getChartZoomDomain(state, this.chartIndex);
    const flightData = getCurrentFlightData(state);

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
      console.log(`[LineChartStore ${this.chartIndex}] No data available`);
      return;
    }

    // Check if flight data changed
    const changes = this.changeDetector.detectChanges({
      flightId,
      variable,
      data: flightData.timeseries
    });

    if (changes.flightId || changes.variable || changes.data) {
      // console.log(`[LineChartStore ${this.chartIndex}] Data/variable changed`, changes);

      // Update state
      this.state.updateData(flightData.timeseries, variable);
      this.changeDetector.updateAll({
        flightId,
        variable,
        data: flightData.timeseries
      });

      // Get variable metadata for display name and units
      const metadata = getVariableMetadata(state, variable);
      this.longName = metadata?.long_name || variable;
      this.long_name = this.longName;
      this.units = metadata?.units || variable;

      // Initialize or update chart
      if (!this.chartInitialized) {
        this.setVariable(variable, this.longName);
      } else {
        this.addNewData();
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

      if (zoomDomain) {
        // Apply zoom
        this.xScale.domain(zoomDomain);
        // console.log(`[LineChartStore ${this.chartIndex}] Applied zoom domain:`, zoomDomain);
      } else if (flightData.timeRange) {
        // Reset to full domain
        this.xScale.domain([flightData.timeRange.start, flightData.timeRange.end]);
        // console.log(`[LineChartStore ${this.chartIndex}] Reset to full domain:`, [flightData.timeRange.start, flightData.timeRange.end]);
      }

      // Update axes with zoom awareness
      this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, !!zoomDomain);

      // Update gridlines - use correct selectors
      this.renderer.getSVG().select(".x-grid").remove();
      this.renderer.getSVG().select(".y-grid").remove();
      this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

      // Redraw line with new domain
      this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);

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

    this.margin = { top: 20, right: 30, bottom: this.showXLabel ? 50 : 30, left: 50 };

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
    const hasValidData = this.state.data.some(entry => {
      const value = entry[cleanName];
      return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
    });

    if (!hasValidData) {
      console.error(`[LineChartStore ${this.chartIndex}] No valid data for variable ${cleanName}`);
      return;
    }

    // Initialize chart
    this.initChart();
    this.chartInitialized = true;
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
    this.renderer.createAxes(this.xScale, this.yScale, this.height, this.showXLabel);

    // Add gridlines
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Add axis labels and title
    this.addLabels();

    // Create clip path for brushing
    this.renderer.createClipPath(this.width, this.height);

    // Draw initial line
    this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);

    // Add interactions (tooltip and vertical line)
    this.interactions.initTooltip();
    this.interactions.initVerticalLine(this.height);

    const svg = this.renderer.getSVG();

    // Add brush for zooming first
    this.renderer.addBrush(this.width, this.height, this.updateChart.bind(this));

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
      });
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
    // Filter valid data for scale domain calculation
    const validData = this.state.data.filter(d =>
      d[this.state.variable] !== null &&
      d[this.state.variable] !== undefined &&
      !isNaN(d[this.state.variable]) &&
      isFinite(d[this.state.variable])
    );

    if (validData.length === 0) {
      console.warn(`[LineChartStore ${this.chartIndex}] No valid data for creating scales`);
      return;
    }

    // Time scale (X-axis)
    const timeExtent = d3.extent(this.state.data, d => d.Time);
    this.xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, this.width]);

    // Value scale (Y-axis)
    const valueExtent = d3.extent(validData, d => d[this.state.variable]);
    const padding = (valueExtent[1] - valueExtent[0]) * 0.1;
    this.yScale = d3.scaleLinear()
      .domain([valueExtent[0] - padding, valueExtent[1] + padding])
      .range([this.height, 0]);

    // Aliases for backward compatibility
    this.x = this.xScale;
    this.y = this.yScale;
  }

  /**
   * Add axis labels and title
   */
  addLabels() {
    const svg = this.renderer.getSVG();

    // Y-axis label (uses units to prevent overflow)
    svg.append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - this.margin.left)
      .attr("x", 0 - (this.height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(this.units || this.state.variable);

    // Chart title
    svg.append("text")
      .attr("class", "chart-title")
      .attr("x", this.width / 2)
      .attr("y", -5)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "500")
      .style("fill", "#333")
      .text(this.longName || this.state.variable);
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
    this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, false);

    // Update gridlines - use correct selectors
    this.renderer.getSVG().select(".x-grid").remove();
    this.renderer.getSVG().select(".y-grid").remove();
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Update labels (y-axis shows units, title shows longName)
    this.renderer.getSVG().select(".y-axis-label").text(this.units || this.state.variable);
    this.renderer.getSVG().select(".chart-title").text(this.longName);

    // Redraw line
    this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);

    // Update plane icon
    const lastValidData = this.findLastValidData();
    if (lastValidData) {
      this.renderer.updatePlaneIcon({
        x: this.xScale(lastValidData.Time),
        y: this.yScale(lastValidData[this.state.variable])
      });
    }

    // Reset progress to show full data
    this.updateProgress(1);
  }

  /**
   * Update progress (for timeline animation)
   * @param {number} progress - Progress from 0 to 1
   */
  updateProgress(progress) {
    if (!this.chartInitialized || !this.state.variable) return;

    this.state.updateProgress(progress);
    const filteredData = this.state.filterDataByProgress();

    // Redraw line with filtered data (showing data up to current progress)
    this.renderer.drawLine(filteredData, this.xScale, this.yScale, this.state.variable);

    // Update plane icon to last data point
    if (filteredData.length > 0) {
      const lastPoint = filteredData[filteredData.length - 1];
      const value = lastPoint[this.state.variable];

      if (value !== null && value !== undefined && !isNaN(value)) {
        this.renderer.updatePlaneIcon({
          x: this.xScale(lastPoint.Time),
          y: this.yScale(value)
        });
      }
    }
  }

  /**
   * Handle brush zoom
   */
  updateChart(event) {
    const extent = event.selection;

    // console.log(`[LineChartStore ${this.chartIndex}] updateChart called:`, { extent }); // DEBUG

    // Ignore brush clear events that we triggered programmatically
    if (!extent && this.isBrushClearing) {
      // console.log(`[LineChartStore ${this.chartIndex}] Ignoring programmatic brush clear`); // DEBUG
      this.isBrushClearing = false;
      return;
    }

    if (!extent) {
      // Reset zoom via store action
      // console.log(`[LineChartStore ${this.chartIndex}] Resetting zoom`); // DEBUG
      this.dispatch(chartResetZoom(this.chartIndex));
    } else {
      // Zoom to selection via store action
      const newXDomain = [
        this.xScale.invert(extent[0]),
        this.xScale.invert(extent[1])
      ];
      // console.log(`[LineChartStore ${this.chartIndex}] Zooming to domain:`, newXDomain); // DEBUG
      this.dispatch(chartZoom(this.chartIndex, newXDomain));

      // Set flag before clearing brush to ignore the resulting event
      this.isBrushClearing = true;
      this.renderer.getSVG().select(".brush").call(this.renderer.brush.move, null);
    }
  }

  /**
   * Reset zoom
   */
  resetZoom() {
    this.dispatch(chartResetZoom(this.chartIndex));
  }

  /**
   * Update zoom domain (called from store state change)
   */
  updateZoom(domain) {
    if (!this.xScale) return;
    this.xScale.domain(domain);
    // isZoomed is true when domain is applied (not full range)
    this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, true);
    this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);
  }

  /**
   * Find last valid data point
   */
  findLastValidData() {
    for (let i = this.state.data.length - 1; i >= 0; i--) {
      const entry = this.state.data[i];
      const value = entry[this.state.variable];
      if (value !== null && value !== undefined && !isNaN(value) && isFinite(value)) {
        return entry;
      }
    }
    return null;
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
    this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, false);
    this.renderer.getSVG().select(".x-grid").remove();
    this.renderer.getSVG().select(".y-grid").remove();
    this.renderer.getSVG().select(".zero-line").remove();
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);
    this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);

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

    // Disconnect from store
    super.destroy();

    // Clear SVG
    if (this.renderer && this.renderer.getSVG()) {
      this.renderer.getSVG().selectAll("*").remove();
    }
  }
}
