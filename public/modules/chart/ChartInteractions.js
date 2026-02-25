/**
 * Handles chart interactions - mouse events, tooltips, and chart syncing
 * @class ChartInteractions
 */
import {
  getChartVariablesWithColors,
  getVariableMetadata
} from '../../store/selectors/selectors.js';

// Global tooltip - shared across all chart instances
let globalTooltip = null;

export class ChartInteractions {
  /**
   * Creates interactions instance
   * @param {Object} svg - D3 SVG selection
   * @param {Object} state - ChartState instance
   * @param {Array} allCharts - Array of all chart instances for syncing
   * @param {Object} colors - Color scheme
   */
  constructor(svg, state, allCharts, colors) {
    this.svg = svg;
    this.state = state;
    this.allCharts = allCharts;
    this.colors = colors;
    this.tooltip = null;
    this.verticalLine = null;
    this.parentChart = null; // Reference to parent LineChart
  }

  /**
   * Initialize tooltip (reuse global tooltip if it exists)
   * @returns {Object} D3 tooltip selection
   */
  initTooltip() {
    if (!globalTooltip) {
      globalTooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "5px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", "9999");
    }
    
    this.tooltip = globalTooltip;
    return this.tooltip;
  }

  /**
   * Initialize vertical line indicator
   * @param {number} height - Chart height
   * @returns {Object} D3 line selection
   */
  initVerticalLine(height) {
    this.verticalLine = this.svg.append("line")
      .attr("class", "vertical-line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", this.colors.accent)
      .attr("stroke-width", 1)
      .attr("opacity", 0);


    return this.verticalLine;
  }

  /**
   * Handle mouse move event
   * @param {Event} event - Mouse event
   * @param {Function} xScale - D3 X scale
   * @param {Function} yScale - D3 Y scale
   * @param {string} longName - Variable display name
   */
  onMouseMove(event, xScale, yScale, longName) {
    const [mouseX] = d3.pointer(event);
    const xValue = xScale.invert(mouseX);
    const xKey = this.parentChart?.getXAxisKey ? this.parentChart.getXAxisKey() : null;
    const closestData = this.state.getClosestData(xValue, xScale, xKey);

    if (closestData && this.state.hasValidData(closestData)) {
      const xDatum = xKey ? closestData[xKey] : closestData.Time;
      const xPos = xScale(xDatum);
      const yPos = yScale(closestData[this.state.variable]);

      // Update vertical line
      this.verticalLine
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("opacity", 1);

      // Build comprehensive tooltip with all variables from all charts
      const xAxisTitle = this.parentChart?.getXAxisTitle ? this.parentChart.getXAxisTitle(this.parentChart.getState()) : 'Time';
      const tooltipHtml = this.buildTooltipHtml(closestData, xKey, xAxisTitle);

      // Calculate tooltip position - flip to left if too close to right edge
      const tooltipLeft = this.calcTooltipLeft(event.pageX);

      // Update tooltip
      this.tooltip
        .style("left", `${tooltipLeft}px`)
        .style("top", `${event.pageY - 20}px`)
        .style("opacity", 1)
        .html(tooltipHtml);

      // Sync vertical lines and circle markers on other charts
      this.syncCharts(xValue, xKey);
    }
  }

  /**
   * Handle mouse out event
   */
  onMouseOut() {
    // Hide this chart's indicators
    if (this.verticalLine) {
      this.verticalLine.attr("opacity", 0);
    }
    if (this.tooltip) {
      this.tooltip.style("opacity", 0);
    }

    // Hide indicators in all other charts
    this.allCharts.forEach(chart => {
      if (chart !== this.parentChart && chart.interactions) {
        if (chart.interactions.verticalLine) {
          chart.interactions.verticalLine.attr("opacity", 0);
        }
        if (chart.interactions.tooltip) {
          chart.interactions.tooltip.style("opacity", 0);
        }
      }
    });
  }

  /**
   * Sync vertical line and circle markers across all other charts
   * Tooltip is handled once in onMouseMove (single global tooltip)
   * @param {Date|number} xValue - X value to sync to
   * @param {string|null} xKey - X-axis key (null for Time)
   */
  syncCharts(xValue, xKey) {
    this.allCharts.forEach(chart => {
      if (chart !== this.parentChart && chart.interactions && chart.state && chart.xScale && chart.yScale) {
        const chartXKey = chart.getXAxisKey ? chart.getXAxisKey() : null;
        if (chartXKey !== xKey) return;

        const closestData = chart.state.getClosestData(xValue, chart.xScale, chartXKey);

        if (closestData && chart.state.hasValidData(closestData)) {
          const xDatum = chartXKey ? closestData[chartXKey] : closestData.Time;
          const xPos = chart.xScale(xDatum);
          const yPos = chart.yScale(closestData[chart.state.variable]);

          // Update vertical line in other chart
          if (chart.interactions.verticalLine) {
            chart.interactions.verticalLine
              .attr("x1", xPos)
              .attr("x2", xPos)
              .attr("opacity", 1);
          }

        }
      }
    });
  }

  /**
   * Build tooltip HTML with all configured variables from all active charts
   * @param {Object} dataPoint - Data point to display
   * @param {string|null} xKey - X-axis key (null for Time)
   * @param {string} xAxisTitle - X-axis title for display
   * @returns {string} HTML string for tooltip
   */
  buildTooltipHtml(dataPoint, xKey, xAxisTitle) {
    if (!dataPoint) return '';
    let html = '';

    if (!xKey) {
      const formatTime = d3.timeFormat("%H:%M:%S");
      html = `<strong>${formatTime(dataPoint.Time)} UTC</strong><br><hr>`;
    } else {
      const meta = getVariableMetadata(this.parentChart?.getState?.(), xKey);
      const units = meta?.units ? ` ${meta.units}` : '';
      const value = dataPoint[xKey];
      const displayValue = (value !== null && value !== undefined && !isNaN(value))
        ? `${parseFloat(value).toFixed(2)}${units}`
        : 'N/A';
      html = `<strong>${xAxisTitle}:</strong> ${displayValue}<br><hr>`;
    }

    const activeCharts = this.allCharts.filter(chart =>
      chart &&
      chart.renderer &&
      chart.renderer.svgElement &&
      chart.renderer.svgElement.node &&
      chart.renderer.svgElement.node().isConnected
    );

    activeCharts.forEach(chart => {
      if (!chart.state || !chart.xScale) return;
      const chartXKey = chart.getXAxisKey ? chart.getXAxisKey() : null;
      if (chartXKey !== xKey) return;

      const chartData = chart.state.getClosestData(dataPoint[xKey || 'Time'], chart.xScale, chartXKey);
      if (!chartData) return;

      // Get all configured variables for this chart
      const variables = chart.getState
        ? getChartVariablesWithColors(chart.getState(), chart.chartIndex, chart.pageContext)
        : null;

      if (!variables || variables.length === 0) {
        // Fallback: single variable mode
        const val = chartData[chart.state.variable];
        if (val !== null && val !== undefined && !isNaN(val)) {
          let units = chart.units ? ` ${chart.units}` : '';
          units = this.formatUnits(units);
          html += `<em>${chart.longName}:</em> ${parseFloat(val).toFixed(2)}${units}<br>`;
        }
      } else {
        variables.forEach(v => {
          const val = chartData[v.key];
          if (val !== null && val !== undefined && !isNaN(val)) {
            const meta = chart.getState
              ? getVariableMetadata(chart.getState(), v.key)
              : null;
            const name = meta?.long_name || v.key;
            let units = meta?.units ? ` ${meta.units}` : '';
            units = this.formatUnits(units);
            html += `<span style="color:${v.color}">&#9679;</span> <em>${name}:</em> ${parseFloat(val).toFixed(2)}${units}<br>`;
          }
        });
      }
    });

    return html;
  }

  /**
   * Convert unit abbreviations to symbols
   * @param {string} units - Unit string
   * @returns {string} Formatted unit string
   */
  formatUnits(units) {
    return units
      .replace(/deg_C/g, '°C')
      .replace(/degree_T/g, '°')
      .replace(/degree/g, '°')
      .replace(/deg_K/g, '°K')
      .replace(/deg_F/g, '°F');
  }

  /**
   * Calculate tooltip X position, flipping left if too close to right edge
   * @param {number} pageX - Mouse X position on page
   * @returns {number} Tooltip left position in pixels
   */
  calcTooltipLeft(pageX) {
    const tooltipWidth = 200;
    const windowWidth = window.innerWidth;
    return (pageX + tooltipWidth + 10 > windowWidth)
      ? pageX - tooltipWidth - 10
      : pageX + 10;
  }

  /**
   * Reset interactions (hide indicators)
   */
  reset() {
    if (this.verticalLine) {
      this.verticalLine.attr("opacity", 0);
    }
    if (this.tooltip) {
      this.tooltip.style("opacity", 0);
    }
  }

  /**
   * Clean up interactions
   */
  destroy() {
    // Don't remove global tooltip - it's shared
    // Just hide it
    if (this.tooltip) {
      this.tooltip.style("opacity", 0);
      this.tooltip = null;
    }
    if (this.verticalLine) {
      this.verticalLine.remove();
      this.verticalLine = null;
    }
  }

  /**
   * Update vertical line height
   * @param {number} height - New height
   */
  updateVerticalLineHeight(height) {
    if (this.verticalLine) {
      this.verticalLine.attr("y2", height);
    }
  }
}
