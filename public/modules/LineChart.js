import { variableRealTime, UNITS, SPACER } from './chartselect.js';
import { loadData } from './loadData.js';
import { ChartState } from './chart/ChartState.js';
import { ChartRenderer } from './chart/ChartRenderer.js';
import { ChartInteractions } from './chart/ChartInteractions.js';

// NCAR Design System Colors
const NCAR_COLORS = {
  primary: '#0057C2',    // NCAR Blue
  accent: '#FAA119'      // NCAR Orange
};

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export let SELCHART;
export let CHARTS = []; // Array to store all chart instances
export let CHARTS_SVG = []; // Array to store SVG elements of all charts

/**
 * LineChart - Main orchestrator class for time-series charts
 * Delegates to ChartState, ChartRenderer, and ChartInteractions modules
 */
export default class LineChart {
  constructor(svgSelector, videoSelector, data, long_name, showXLabel = false, timeline = true) {
    this.timeline = timeline;
    this.selector = svgSelector;
    this.svgContainer = d3.select(svgSelector);
    this.video = document.getElementById(videoSelector);
    this.showXLabel = showXLabel;
    this.longName = long_name;
    this.long_name = long_name; // Backward compatibility
    this.chartInitialized = false;
    this.yticks = 5;
    this.idleTimeout = null;

    // Initialize dimensions
    this.updateDimensions();

    // Initialize modules
    this.state = new ChartState(data, null);
    this.renderer = new ChartRenderer(svgSelector, {
      width: this.width,
      height: this.height,
      margin: this.margin
    }, NCAR_COLORS);
    this.interactions = new ChartInteractions(null, this.state, CHARTS, NCAR_COLORS);
    this.interactions.parentChart = this;

    // Scales
    this.xScale = null;
    this.yScale = null;
    this.x = null; // Alias for backward compatibility
    this.y = null; // Alias for backward compatibility

    // Add to global arrays
    CHARTS_SVG.push(this.svgContainer);

    // Add resize event listener with debouncing
    this.resizeHandler = debounce(() => this.onResize(), 250);
    window.addEventListener('resize', this.resizeHandler);

    CHARTS.push(this);
  }

  /**
   * Set variable and initialize chart
   */
  setVariable(cleanName, long_name = null) {
    console.log('setVariable called with:', { cleanName });

    if (!this.state.data || this.state.data.length === 0) {
      console.error('No data available');
      return;
    }

    const availableColumns = Object.keys(this.state.data[0]);
    console.log('Looking for variable:', cleanName, 'in columns:', availableColumns);

    // Validate variable exists
    let variableToUse = cleanName;
    if (!availableColumns.includes(cleanName)) {
      console.error(`Variable ${cleanName} not found in data`);

      // Try to find similar variable
      const lowerCleanName = cleanName.toLowerCase();
      const matchingColumn = availableColumns.find(col =>
        col.toLowerCase() === lowerCleanName ||
        col.toLowerCase().includes(lowerCleanName) ||
        lowerCleanName.includes(col.toLowerCase())
      );

      if (matchingColumn) {
        console.log(`Using similar column: ${matchingColumn}`);
        variableToUse = matchingColumn;
      } else {
        const columnName = availableColumns.find(col => col.toLowerCase().includes('column'));
        if (columnName) {
          console.warn(`Using column named ${columnName}`);
          variableToUse = cleanName;
        } else {
          console.error('No column found, chart creation aborted');
          return;
        }
      }
    }

    this.state.setVariable(variableToUse);
    this.longName = long_name || cleanName;
    this.long_name = this.longName;

    // Validate data
    const hasValidData = this.state.data.some(entry => {
      const value = entry[variableToUse];
      return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
    });

    if (!hasValidData) {
      console.error(`No valid data for variable ${variableToUse}`);
      return;
    }

    // Initialize chart if not already done
    if (!this.chartInitialized) {
      this.initChart();
      this.chartInitialized = true;
    } else {
      this.addNewData();
    }
  }

  /**
   * Initialize the chart
   */
  initChart() {
    // Initialize SVG
    this.renderer.initSVG();
    this.interactions.svg = this.renderer.getSVG();

    // Create scales
    this.createScales();

    // Create axes
    this.renderer.createAxes(this.xScale, this.yScale, this.height, this.showXLabel);
    
    // Verify x-axis domain after creation
    const axisXDomain = this.xScale.domain();
    const axisXRange = this.xScale.range();
    console.log('[LineChart] X-axis domain after createAxes:', {
      start: axisXDomain[0].toISOString(),
      end: axisXDomain[1].toISOString(),
      spanHours: ((axisXDomain[1] - axisXDomain[0]) / (1000 * 60 * 60)).toFixed(2),
      rangeWidth: axisXRange[1] - axisXRange[0],
      pixelsPerHour: ((axisXRange[1] - axisXRange[0]) / ((axisXDomain[1] - axisXDomain[0]) / (1000 * 60 * 60))).toFixed(2)
    });

    // Add gridlines
    this.renderer.addGridlines(this.xScale, this.yScale, this.width, this.height);

    // Add axis labels and title
    this.addLabels();

    // Create clip path for brushing
    this.renderer.createClipPath(this.width, this.height);

    // Draw initial line
    this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);

    // Add brush for zooming
    this.renderer.addBrush(this.width, this.height, this.updateChart.bind(this));

    // Add plane icon
    const lastValidData = this.findLastValidData();
    if (lastValidData) {
      this.renderer.addPlaneIcon({
        x: this.xScale(lastValidData.Time),
        y: this.yScale(lastValidData[this.state.variable])
      });
    }

    // Add interactions
    this.interactions.initTooltip();
    this.interactions.initVerticalLine(this.height);
    this.interactions.addInteractiveRect(
      this.width,
      this.height,
      (event) => this.interactions.onMouseMove(event, this.xScale, this.yScale, this.longName),
      () => this.interactions.onMouseOut()
    );

    // Double-click to reset zoom
    this.renderer.getSVG().on("dblclick", () => {
      this.resetZoom();
    });

    // Initialize with full data visible (progress = 1)
    // Timeline will control progress from 0 to 1 during playback
    if (this.timeline) {
      this.updateProgress(1);
    }

    // Final logging after chart initialization
    console.log('[LineChart] CHART INITIALIZATION COMPLETE:', {
      selector: this.selector,
      variable: this.state.variable,
      dataLength: this.state.data.length,
      chartInitialized: this.chartInitialized,
      xDomain: {
        start: this.xScale.domain()[0].toISOString(),
        end: this.xScale.domain()[1].toISOString(),
        spanHours: ((this.xScale.domain()[1] - this.xScale.domain()[0]) / (1000 * 60 * 60)).toFixed(2)
      }
    });
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
      console.warn('No valid data for creating scales');
      return;
    }

    // Get the extents
    const timeExtent = d3.extent(this.state.data, d => d.Time);
    
    console.log('[LineChart] createScales - state.data details:', {
      totalLength: this.state.data.length,
      validDataLength: validData.length,
      firstEntry: this.state.data[0] ? {
        Time: this.state.data[0].Time.toISOString(),
        variable: this.state.data[0][this.state.variable]
      } : 'none',
      lastEntry: this.state.data[this.state.data.length - 1] ? {
        Time: this.state.data[this.state.data.length - 1].Time.toISOString(),
        variable: this.state.data[this.state.data.length - 1][this.state.variable]
      } : 'none'
    });

    this.xScale = d3.scaleUtc()
      .domain(timeExtent)
      .range([0, this.width]);

    // Log x-axis domain for debugging
    const xDomain = this.xScale.domain();
    const spanHours = ((xDomain[1] - xDomain[0]) / (1000 * 60 * 60)).toFixed(2);
    console.log(`[LineChart] X-axis domain in createScales:`, {
      start: xDomain[0].toISOString(),
      end: xDomain[1].toISOString(),
      spanHours,
      dataLength: this.state.data.length,
      extentMatch: timeExtent[0].toISOString() === xDomain[0].toISOString() ? 'YES' : 'NO'
    });

    const yMin = d3.min(validData, d => d[this.state.variable]);
    const yMax = d3.max(validData, d => d[this.state.variable]);

    this.yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([this.height, 0])
      .nice(); // Add nice rounding for better axis labels

    // Aliases for backward compatibility
    this.x = this.xScale;
    this.y = this.yScale;
  }

  /**
   * Add labels and title
   */
  addLabels() {
    const svg = this.renderer.getSVG();

    // X-axis label
    if (this.showXLabel) {
      svg.append("text")
        .attr("class", "x-axis-label")
        .attr("text-anchor", "middle")
        .attr("x", this.width / 2)
        .attr("y", this.height + this.margin.top + 20)
        .attr("font-size", "12px")
        .text("Time");
    }

    // Y-axis label
    svg.append("text")
      .attr("class", "y-axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("font-size", "12px")
      .attr("y", -this.margin.left + 20)
      .attr("x", -this.height / 2)
      .text(UNITS[this.longName] || '');

    // Chart title
    svg.append("text")
      .attr("class", "chart-title")
      .attr("text-anchor", "middle")
      .attr("x", this.width / 2)
      .attr("y", -2)
      .attr("font-size", "12px")
      .text(this.longName);
  }

  /**
   * Update chart on brush/zoom
   */
  updateChart(event) {
    const extent = event.selection;

    if (!extent) {
      if (!this.idleTimeout) {
        this.idleTimeout = setTimeout(() => this.idleTimeout = null, 350);
        return;
      }
      this.xScale.domain(d3.extent(this.state.data, d => d.Time));
      console.log('[LineChart] Brush cleared, reset to full domain:', {
        start: this.xScale.domain()[0].toISOString(),
        end: this.xScale.domain()[1].toISOString()
      });
    } else {
      const newXDomain = [this.xScale.invert(extent[0]), this.xScale.invert(extent[1])];
      this.xScale.domain(newXDomain);
      console.log('[LineChart] Zoomed to:', {
        start: newXDomain[0].toISOString(),
        end: newXDomain[1].toISOString()
      });
      this.renderer.getSVG().select(".brush").call(this.renderer.brush.move, null);
      this.interactions.syncZoom(newXDomain);
    }

    // Update axes and line
    this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel);
    this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);
    this.updateGridlines();
  }

  /**
   * Reset zoom to initial domain
   */
  resetZoom() {
    const initialDomain = this.state.getInitialXDomain();
    console.log('[LineChart] resetZoom called, domain:', {
      start: initialDomain[0].toISOString(),
      end: initialDomain[1].toISOString()
    });
    this.xScale.domain(initialDomain);
    this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel);
    this.renderer.drawLine(this.state.data, this.xScale, this.yScale, this.state.variable);
    this.updateGridlines();
    this.interactions.syncZoom(initialDomain);
  }

  /**
   * Update gridlines
   */
  updateGridlines(duration = 1000) {
    const svg = this.renderer.getSVG();

    svg.select(".x-grid")
      .transition()
      .duration(duration)
      .call(d3.axisBottom(this.xScale)
        .ticks(d3.timeMinute.every(30))
        .tickSize(-this.height)
        .tickFormat(""));

    svg.select(".y-grid")
      .transition()
      .duration(duration)
      .call(d3.axisLeft(this.yScale)
        .ticks(this.yticks)
        .tickSize(-this.width)
        .tickFormat(""));
  }

  /**
   * Update progress (for timeline animation)
   * @param {number} progress - Progress value from 0 to 1
   */
  updateProgress(progress) {
    // Only update if timeline control is enabled
    if (!this.timeline) {
      console.warn('Timeline not enabled for this chart');
      return;
    }

    // Validate progress value
    if (typeof progress !== 'number' || progress < 0 || progress > 1) {
      console.error('Invalid progress value:', progress);
      return;
    }

    // Update state
    this.state.updateProgress(progress);
    const currentData = this.state.filterDataByProgress();

    // Update line with filtered data
    this.renderer.drawLine(currentData, this.xScale, this.yScale, this.state.variable);

    // Update plane icon to latest data point
    if (currentData.length > 0) {
      const latestData = currentData[currentData.length - 1];
      if (latestData && this.state.variable in latestData) {
        this.renderer.updatePlaneIcon(
          this.xScale(latestData.Time),
          this.yScale(latestData[this.state.variable])
        );
      }
    }
  }

  /**
   * Update data
   */
  updateData(newData, clean_name, long_name = null) {
    this.state.updateData(newData, clean_name);
    this.longName = long_name || clean_name;
    this.long_name = this.longName;
    this.addNewData();
  }

  /**
   * Add new data and update chart
   */
  addNewData() {
    this.updateDimensions();
    this.createScales();

    // Reset interactions (hide tooltips and vertical lines)
    if (this.interactions) {
      this.interactions.reset();
    }

    // Update axes with transition
    this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel);
    
    // Log the new domain after data change
    const newDomain = this.xScale.domain();
    console.log('[LineChart] After addNewData, x-axis domain:', {
      start: newDomain[0].toISOString(),
      end: newDomain[1].toISOString(),
      spanHours: ((newDomain[1] - newDomain[0]) / (1000 * 60 * 60)).toFixed(2)
    });

    // Update gridlines immediately (no transition for data changes)
    this.updateGridlines(0);

    // Update labels
    const svg = this.renderer.getSVG();
    svg.select(".y-axis-label").text(UNITS[this.longName] || '');
    svg.select(".chart-title").text(this.longName);

    // IMPORTANT: Reset progress to 1 to show full data immediately
    this.state.updateProgress(1);

    // Draw line with full data
    const fullData = this.state.data.filter(d => 
      d[this.state.variable] !== null &&
      d[this.state.variable] !== undefined &&
      !isNaN(d[this.state.variable]) &&
      isFinite(d[this.state.variable])
    );
    
    this.renderer.drawLine(fullData, this.xScale, this.yScale, this.state.variable);

    // Update plane icon to last data point
    const lastValidData = this.findLastValidData();
    if (lastValidData) {
      this.renderer.updatePlaneIcon(
        this.xScale(lastValidData.Time),
        this.yScale(lastValidData[this.state.variable])
      );
    }

    // Reset brush extent if it exists
    if (this.renderer.brush) {
      this.renderer.brush.extent([[0, 0], [this.width, this.height]]);
      const svg = this.renderer.getSVG();
      svg.select(".brush").call(this.renderer.brush);
    }

    // Final sanity check after adding new data
    const finalDomain = this.xScale.domain();
    const finalRange = this.xScale.range();
    console.log('[LineChart] FINAL STATE after addNewData:', {
      xDomainStart: finalDomain[0].toISOString(),
      xDomainEnd: finalDomain[1].toISOString(),
      xDomainSpanHours: ((finalDomain[1] - finalDomain[0]) / (1000 * 60 * 60)).toFixed(2),
      xRangeStart: finalRange[0],
      xRangeEnd: finalRange[1],
      pixelWidth: finalRange[1] - finalRange[0],
      progress: this.state.progress,
      chartVariable: this.state.variable
    });
  }

  /**
   * Update dimensions
   */
  updateDimensions() {
    const parentContainer = document.querySelector("#graph-container");
    if (!parentContainer) return;

    const containerWidth = parentContainer.getBoundingClientRect().width;
    const containerHeight = parentContainer.getBoundingClientRect().height;

    this.margin = this.showXLabel
      ? { top: 20, right: 20, bottom: 50, left: 50 }
      : { top: 20, right: 20, bottom: 0, left: 50 };

    this.width = containerWidth - this.margin.left - this.margin.right;
    this.height = containerHeight / SPACER - this.margin.top;

    if (this.renderer) {
      this.renderer.updateDimensions({
        width: this.width,
        height: this.height,
        margin: this.margin
      });
    }
  }

  /**
   * Handle window resize
   */
  onResize() {
    this.updateDimensions();

    // Update SVG dimensions
    d3.select(this.selector).select("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom);

    // Update scales
    this.xScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);

    // Update axes
    this.renderer.updateAxes(this.xScale, this.yScale, this.showXLabel);

    // Update gridlines
    this.updateGridlines(0);

    // Update interactions
    this.interactions.updateVerticalLineHeight(this.height);

    // Update brush extent
    if (this.renderer.brush) {
      this.renderer.brush.extent([[0, 0], [this.width, this.height]]);
      this.renderer.getSVG().select(".brush").call(this.renderer.brush);
    }
  }

  /**
   * Find last valid data point
   */
  findLastValidData() {
    return this.state.data.slice().reverse().find(d =>
      d.Time &&
      d[this.state.variable] !== null &&
      d[this.state.variable] !== undefined &&
      isFinite(d[this.state.variable])
    );
  }

  /**
   * Get initial X domain (for backward compatibility)
   */
  getInitialXDomain() {
    return this.state.getInitialXDomain();
  }

  /**
   * Axis helper (for backward compatibility)
   */
  axis(scale, orientation = 'bottom') {
    if (orientation === 'bottom') {
      return d3.axisBottom(scale);
    } else if (orientation === 'left') {
      return d3.axisLeft(scale);
    }
  }

  /**
   * Destroy chart and cleanup
   */
  destroy() {
    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }

    // Clean up modules
    if (this.interactions) {
      this.interactions.destroy();
    }

    if (this.renderer) {
      this.renderer.clear();
    }

    // Remove SVG from DOM
    if (this.svgContainer) {
      this.svgContainer.selectAll("*").remove();
    }

    // Clear data
    this.state.data = null;

    // Remove from global arrays
    const index = CHARTS.indexOf(this);
    if (index > -1) {
      CHARTS.splice(index, 1);
    }

    // Remove from CHARTS_SVG array
    const svgIndex = CHARTS_SVG.indexOf(this.svgContainer);
    if (svgIndex > -1) {
      CHARTS_SVG.splice(svgIndex, 1);
    }
  }
}

/**
 * Set selected chart
 */
export function setSelectedChart(chart) {
  SELCHART = chart;
}

/**
 * Remove all line charts
 */
export function removeLineCharts(charts) {
  charts.forEach(chart => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });

  const chartContainers = ["#chart1", "#chart2", "#chart3", "#chart4"];
  chartContainers.forEach(container => {
    const element = document.querySelector(container);
    if (element) {
      element.innerHTML = '';
    }
  });

  charts.length = 0;
}
