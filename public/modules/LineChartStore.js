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
  getChartVariablesWithColors
} from '../store/selectors/selectors.js';
import { chartZoom, chartResetZoom } from '../store/actions/uiActions.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';
import { debounce, getAxisLabelText } from './shared/utils.js';
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
    const variable = getChartVariable(state, this.chartIndex, this.pageContext);
    const progress = getTimelineProgress(state);
    const zoomDomain = getChartZoomDomain(state, this.chartIndex, this.pageContext);
    const flightData = getCurrentPageData(state, this.pageContext);

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

      // Initialize or update chart
      if (!this.chartInitialized) {
        this.setVariable(variable, this.longName);
      } else {
        this.addNewData();
      }
    }

    // Handle chart config changes (variables added/removed/axis changed)
    if (this.chartInitialized && changes.configStr) {
      console.log(`[LineChartStore ${this.chartIndex}] Config changed, updating chart`, variables);
      this.changeDetector.update('configStr', configStr);

      // Recreate scales for new variable configuration
      this.createScales();

      // Remove old right axis if it exists and we no longer need it
      if (!this.yScaleRight && this.renderer.yAxisRight) {
        this.renderer.getSVG().select('.y-axis-right').remove();
        this.renderer.getSVG().select('.y-axis-label-right').remove();
        this.renderer.yAxisRight = null;
      }

      // Update axes
      if (this.yScaleRight) {
        // If right axis doesn't exist yet, create it
        if (!this.renderer.yAxisRight) {
          this.renderer.yAxisRight = this.renderer.getSVG().append('g')
            .attr('class', 'y-axis-right')
            .attr('transform', `translate(${this.width},0)`)
            .call(d3.axisRight(this.yScaleRight).ticks(5));
        }
        this.renderer.updateDualAxes(this.xScale, this.yScale, this.yScaleRight, this.height, this.showXLabel);
      } else {
        this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 300, false);
      }

      // Update axis labels
      const axisVars = getChartVariablesByAxis(this.getState(), this.chartIndex, this.pageContext);
      const leftVar = axisVars.left?.[0];
      const leftMeta = leftVar ? getVariableMetadata(this.getState(), leftVar) : null;
      const leftUnits = leftMeta?.units || '';
      const leftAxisLabel = getChartAxisLabel(this.getState(), this.chartIndex, 'left', this.pageContext);

      // Update left axis label
      const leftLabelElem = this.renderer.getSVG().select('.y-axis-label');
      if (leftLabelElem.size() > 0) {
        leftLabelElem.text(getAxisLabelText(leftAxisLabel, leftUnits, leftVar));
      }

      // Update right axis label
      if (this.yScaleRight) {
        const rightVar = axisVars.right?.[0];
        const rightMeta = rightVar ? getVariableMetadata(this.getState(), rightVar) : null;
        const rightUnits = rightMeta?.units || '';
        const rightAxisLabel = getChartAxisLabel(this.getState(), this.chartIndex, 'right', this.pageContext);

        const rightLabelElem = this.renderer.getSVG().select('.y-axis-label-right');
        if (rightLabelElem.size() > 0) {
          // Update existing label
          rightLabelElem.text(getAxisLabelText(rightAxisLabel, rightUnits, rightVar));
        } else {
          // Add label if it doesn't exist
          this.renderer.getSVG().append('text')
            .attr('class', 'y-axis-label-right')
            .attr('transform', 'rotate(-90)')
            .attr('y', this.width + this.margin.right/2)
            .attr('x', 0 - (this.height / 2))
            .attr('dy', '0em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text(getAxisLabelText(rightAxisLabel, rightUnits, rightVar));
        }
      }

      // Update chart title
      const titleElem = this.renderer.getSVG().select('.chart-title');
      if (titleElem.size() > 0 && variables.length > 0) {
        const firstVar = variables[0].key;
        const firstMeta = getVariableMetadata(this.getState(), firstVar);
        const firstLongName = firstMeta?.long_name || firstVar;
        titleElem.text(firstLongName);
      }

      // Redraw lines with new configuration
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
        // Apply zoom
        this.xScale.domain(zoomDomain);
        // console.log(`[LineChartStore ${this.chartIndex}] Applied zoom domain:`, zoomDomain);
      } else if (flightData.timeRange) {
        // Reset to full domain
        this.xScale.domain([flightData.timeRange.start, flightData.timeRange.end]);
        // console.log(`[LineChartStore ${this.chartIndex}] Reset to full domain:`, [flightData.timeRange.start, flightData.timeRange.end]);
      }

      // Update axes with zoom awareness
      if (this.yScaleRight) {
        this.renderer.updateDualAxes(this.xScale, this.yScale, this.yScaleRight, this.showXLabel, 500, !!zoomDomain);
      } else {
        this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, !!zoomDomain);
      }

      // Update gridlines - use correct selectors
      this.renderer.getSVG().select(".x-grid").remove();
      this.renderer.getSVG().select(".y-grid").remove();
      this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

      // Redraw line with new domain
      this.drawConfiguredLines(this.getState());

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

    this.margin = { top: 20, right: 54, bottom: this.showXLabel ? 50 : 30, left: 50 };

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
    if (this.yScaleRight) {
      this.renderer.createDualAxes(this.xScale, this.yScale, this.yScaleRight, this.height, this.showXLabel);
    } else {
      this.renderer.createAxes(this.xScale, this.yScale, this.height, this.showXLabel);
    }

    // Add gridlines
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Add axis labels and title
    this.addLabels();

    // Create clip path for brushing
    this.renderer.createClipPath(this.width, this.height);

    // Draw initial lines
    this.drawConfiguredLines(this.getState());

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
    const allVars = [...leftVars, ...rightVars];

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
        if (val !== null && val !== undefined && isFinite(val) && !isNaN(val)) {
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
          if (val !== null && val !== undefined && isFinite(val) && !isNaN(val)) {
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
   * Add axis labels and title
   */
  addLabels() {
    const svg = this.renderer.getSVG();

    // Y-axis label (uses units to prevent overflow)
    const leftAxisLabel = getChartAxisLabel(this.getState(), this.chartIndex, 'left', this.pageContext);
    svg.append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - this.margin.left)
      .attr("x", 0 - (this.height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(getAxisLabelText(leftAxisLabel, this.units, this.state.variable));

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

    // Right axis label if present
    if (this.yScaleRight) {
      const axisVars = getChartVariablesByAxis(this.getState(), this.chartIndex, this.pageContext);
      const rightVar = axisVars.right?.[0];
      const meta = rightVar ? getVariableMetadata(this.getState(), rightVar) : null;
      const rightUnits = meta?.units || '';
      const rightAxisLabel = getChartAxisLabel(this.getState(), this.chartIndex, 'right', this.pageContext);
      
      // Add label to the SVG (rotated vertically on the right side)
      svg.append('text')
        .attr('class', 'y-axis-label-right')
        .attr('transform', 'rotate(-90)')
        .attr('y', this.width + this.margin.right/2)
        .attr('x', 0 - (this.height / 2))
        .attr('dy', '-1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text(getAxisLabelText(rightAxisLabel, rightUnits, rightVar));
    }
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
    if (this.yScaleRight) {
      this.renderer.updateDualAxes(this.xScale, this.yScale, this.yScaleRight, this.showXLabel, 500, false);
    } else {
      this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, false);
    }

    // Update gridlines - use correct selectors
    this.renderer.getSVG().select(".x-grid").remove();
    this.renderer.getSVG().select(".y-grid").remove();
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Update labels (y-axis shows units or overrides, title shows longName)
    const leftAxisLabel = getChartAxisLabel(this.getState(), this.chartIndex, 'left', this.pageContext);
    this.renderer.getSVG().select(".y-axis-label").text(getAxisLabelText(leftAxisLabel, this.units, this.state.variable));
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
  }

  /**
   * Update progress (for timeline animation)
   * @param {number} progress - Progress from 0 to 1
   */
  updateProgress(progress) {
    if (!this.chartInitialized || !this.state.variable) return;

    this.state.updateProgress(progress);
    const filteredData = this.state.filterDataByProgress();

    // Redraw lines with filtered data (showing data up to current progress)
    this.drawConfiguredLines(this.getState(), filteredData);

    // Update plane icon to last data point
    if (filteredData.length > 0) {
      const lastPoint = filteredData[filteredData.length - 1];
      const value = lastPoint[this.state.variable];

      if (value !== null && value !== undefined && !isNaN(value)) {
        this.renderer.updatePlaneIcon({
          x: this.xScale(lastPoint.Time),
          y: this.yScale(value)
        }, this.getHeading(lastPoint));
      }
    }
  }

  /**
   * Draw lines based on chart configuration
   * Uses per-variable colors from the store config
   * @param {Object} state
   * @param {Array} overrideData - optional filtered data
   */
  drawConfiguredLines(state, overrideData = null) {
    const variables = getChartVariablesWithColors(state, this.chartIndex, this.pageContext);
    const data = overrideData || this.state.data;

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
      this.dispatch(chartResetZoom(this.chartIndex, this.pageContext));
    } else {
      // Zoom to selection via store action
      const newXDomain = [
        this.xScale.invert(extent[0]),
        this.xScale.invert(extent[1])
      ];
      // console.log(`[LineChartStore ${this.chartIndex}] Zooming to domain:`, newXDomain); // DEBUG
      this.dispatch(chartZoom(this.chartIndex, newXDomain, this.pageContext));

      // Set flag before clearing brush to ignore the resulting event
      this.isBrushClearing = true;
      this.renderer.getSVG().select(".brush").call(this.renderer.brush.move, null);
    }
  }

  /**
   * Reset zoom
   */
  resetZoom() {
    this.dispatch(chartResetZoom(this.chartIndex, this.pageContext));
  }

  /**
   * Update zoom domain (called from store state change)
   */
  updateZoom(domain) {
    if (!this.xScale) return;
    this.xScale.domain(domain);
    // isZoomed is true when domain is applied (not full range)
    if (this.yScaleRight) {
      this.renderer.updateDualAxes(this.xScale, this.yScale, this.yScaleRight, this.showXLabel, 500, true);
    } else {
      this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, true);
    }
    this.drawConfiguredLines(this.getState());
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
    if (this.yScaleRight) {
      this.renderer.updateDualAxes(this.xScale, this.yScale, this.yScaleRight, this.showXLabel, 500, false);
    } else {
      this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel, 500, false);
    }
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
