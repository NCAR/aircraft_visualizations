/**
 * Handles chart interactions - mouse events, tooltips, and chart syncing
 * @class ChartInteractions
 */

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
    this.circleMarker = null;
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

    // Initialize circle marker
    this.circleMarker = this.svg.append("circle")
      .attr("class", "chart-marker")
      .attr("r", 4)
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
    const closestData = this.state.getClosestData(xValue, xScale);

    if (closestData && closestData[this.state.variable] !== null) {
      const xPos = xScale(closestData.Time);
      const yPos = yScale(closestData[this.state.variable]);

      // Update vertical line
      this.verticalLine
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("opacity", 1);

      // Update circle marker
      this.circleMarker
        .attr("cx", xPos)
        .attr("cy", yPos)
        .attr("opacity", 1);

      // Build tooltip with all chart values (time only, no date)
      const formatTime = d3.timeFormat("%H:%M:%S");
      let tooltipHtml = `<strong>${formatTime(closestData.Time)} UTC </strong><br><hr>`;
      
      const activeCharts = this.allCharts.filter(chart =>
        chart &&
        chart.renderer &&
        chart.renderer.svgElement &&
        chart.renderer.svgElement.node &&
        chart.renderer.svgElement.node().isConnected
      );

      activeCharts.forEach(chart => {
        const chartData = chart.state.getClosestData(closestData.Time, chart.xScale);
        if (chartData && chartData[chart.state.variable] !== null) {
          let units = chart.units ? ` ${chart.units}` : '';
          // Convert unit text to symbols
          units = units.replace(/deg_C/g, '°C').replace(/degree_T/g, '°').replace(/degree/g, '°').replace(/deg_K/g, '°K').replace(/deg_F/g, '°F');
          tooltipHtml += `<em>${chart.longName}:</em> ${chartData[chart.state.variable]}${units}<br>`;
        }
      });

      // Calculate tooltip position - flip to left if too close to right edge
      const tooltipWidth = 200; // Estimated tooltip width
      const windowWidth = window.innerWidth;
      const tooltipLeft = (event.pageX + tooltipWidth + 10 > windowWidth) 
        ? event.pageX - tooltipWidth - 10 
        : event.pageX + 10;

      // Update tooltip
      this.tooltip
        .style("left", `${tooltipLeft}px`)
        .style("top", `${event.pageY - 20}px`)
        .style("opacity", 1)
        .html(tooltipHtml);

      // Sync with other charts
      this.syncCharts(closestData.Time, event.pageX, event.pageY);
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
    if (this.circleMarker) {
      this.circleMarker.attr("opacity", 0);
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
        if (chart.interactions.circleMarker) {
          chart.interactions.circleMarker.attr("opacity", 0);
        }
        if (chart.interactions.tooltip) {
          chart.interactions.tooltip.style("opacity", 0);
        }
      }
    });
  }

  /**
   * Sync vertical line, circle markers, and tooltip across all charts
   * @param {Date} time - Time value to sync to
   * @param {number} pageX - Mouse X position
   * @param {number} pageY - Mouse Y position
   */
  syncCharts(time, pageX, pageY) {
    // Build comprehensive tooltip with all chart values (time only, no date)
    const formatTime = d3.timeFormat("%H:%M:%S");
    let tooltipHtml = `<strong>${formatTime(time)} UTC </strong><br><hr>`;
    
    this.allCharts.forEach(chart => {
      if (chart.state  && chart.xScale) {
        const chartData = chart.state.getClosestData(time, chart.xScale);
        if (chartData && chartData[chart.state.variable] !== null) {
            let units = chart.units ? ` ${chart.units}` : '';
            // Convert unit text to symbols
            units = units.replace(/deg_C/g, '°C').replace(/degree_T/g, '°').replace(/degree/g, '°').replace(/deg_K/g, '°K').replace(/deg_F/g, '°F');
            tooltipHtml += `<em>${chart.longName}:</em> ${parseFloat(chartData[chart.state.variable]).toFixed(2)}${units}<br>`;
        }
      }
    });

    // Calculate tooltip position - flip to left if too close to right edge
    const tooltipWidth = 200; // Estimated tooltip width
    const windowWidth = window.innerWidth;
    const tooltipLeft = (pageX + tooltipWidth + 10 > windowWidth) 
      ? pageX - tooltipWidth - 10 
      : pageX + 10;

    // Update all charts with synced indicators
    this.allCharts.forEach(chart => {
      if (chart !== this.parentChart && chart.interactions && chart.state && chart.xScale && chart.yScale) {
        const closestData = chart.state.getClosestData(time, chart.xScale);

        if (closestData && closestData[chart.state.variable] !== null) {
          const xPos = chart.xScale(closestData.Time);
          const yPos = chart.yScale(closestData[chart.state.variable]);

          // Update vertical line in other chart
          if (chart.interactions.verticalLine) {
            chart.interactions.verticalLine
              .attr("x1", xPos)
              .attr("x2", xPos)
              .attr("opacity", 1);
          }

          // Update circle marker in other chart
          if (chart.interactions.circleMarker) {
            chart.interactions.circleMarker
              .attr("cx", xPos)
              .attr("cy", yPos)
              .attr("opacity", 1);
          }

          // Update tooltip in other chart
          if (chart.interactions.tooltip) {
            chart.interactions.tooltip
              .style("left", `${tooltipLeft}px`)
              .style("top", `${pageY - 20}px`)
              .style("opacity", 1)
              .html(tooltipHtml);
          }
        }
      }
    });
  }

  /**
   * Sync zoom level across all charts
   * @param {Array} xDomain - X domain [min, max]
   */
  syncZoom(xDomain) {
    this.allCharts.forEach(chart => {
      if (chart !== this.parentChart && chart.xScale) {
        chart.xScale.domain(xDomain);

        // Update axis
        if (chart.renderer && chart.renderer.xAxis) {
          chart.renderer.updateAxes(chart.xScale, chart.yScale, chart.showXLabel);
        }

        // Update line
        if (chart.renderer && chart.state) {
          chart.renderer.drawLine(
            chart.state.getFilteredData(),
            chart.xScale,
            chart.yScale,
            chart.state.variable
          );
        }

        // Update gridlines if method exists
        if (chart.updateGridlines) {
          chart.updateGridlines();
        }
      }
    });
  }

  /**
   * Add interactive rectangle for mouse events
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Function} onMouseMove - Mouse move handler
   * @param {Function} onMouseOut - Mouse out handler
   */
  addInteractiveRect(width, height, onMouseMove, onMouseOut) {
    this.svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mousemove", onMouseMove)
      .on("mouseout", onMouseOut);
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
