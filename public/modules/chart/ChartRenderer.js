/**
 * Handles D3.js rendering logic for charts
 * Manages SVG creation, axes, lines, and visual elements
 * @class ChartRenderer
 */
export class ChartRenderer {
  /**
   * Creates renderer instance
   * @param {string} selector - CSS selector for container
   * @param {Object} dimensions - Chart dimensions {width, height, margin}
   * @param {Object} colors - Color scheme {primary, accent}
   */
  constructor(selector, dimensions, colors) {
    this.selector = selector;
    this.dimensions = dimensions;
    this.colors = colors;
    this.svg = null;
    this.line = null;
    this.xAxis = null;
    this.yAxis = null;
    this.brush = null;
    this.clip = null;
    this.planeIcon = null;
    this.iconWidth = 16;
    this.planeIconUrl = 'icons/plane.png';
  }

  /**
   * Initialize SVG canvas
   * @returns {Object} D3 SVG selection
   */
  initSVG() {
    const { width, height, margin } = this.dimensions;
    const svgContainer = d3.select(this.selector);

    this.svg = svgContainer.append("svg")
      .attr("class", "line-chart")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    return this.svg;
  }

  /**
   * Create X and Y axes
   * @param {Function} xScale - D3 X scale
   * @param {Function} yScale - D3 Y scale
   * @param {number} height - Chart height
   * @param {boolean} showXLabel - Whether to show X axis labels
   */
  createAxes(xScale, yScale, height, showXLabel = false) {
    const { width } = this.dimensions;

    console.log('[ChartRenderer] createAxes - xScale domain:', {
      start: xScale.domain()[0].toISOString(),
      end: xScale.domain()[1].toISOString(),
      range: xScale.range()
    });

    // Create X axis
    this.xAxis = this.svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`);

    if (showXLabel) {
      this.xAxis.call(d3.axisBottom(xScale).ticks(d3.timeMinute.every(30)));
    } else {
      this.xAxis.call(d3.axisBottom(xScale).tickFormat(""));
    }

    // Create Y axis
    this.yAxis = this.svg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).ticks(5));
  }

  /**
   * Update axes with new scales
   * @param {Function} xScale - D3 X scale
   * @param {Function} yScale - D3 Y scale
   * @param {boolean} showXLabel - Whether to show X axis labels
   * @param {number} duration - Transition duration in ms (default 500)
   */
  updateAxes(xScale, yScale, showXLabel = false, duration = 500) {
    if (this.xAxis) {
      const xAxisCall = showXLabel
        ? d3.axisBottom(xScale).ticks(d3.timeMinute.every(30))
        : d3.axisBottom(xScale).tickFormat("");

      this.xAxis
        .transition()
        .duration(duration)
        .call(xAxisCall);
    }

    if (this.yAxis) {
      this.yAxis
        .transition()
        .duration(duration)
        .call(d3.axisLeft(yScale).ticks(5));
    }
  }

  /**
   * Add gridlines to chart
   * @param {Function} xScale - D3 X scale
   * @param {Function} yScale - D3 Y scale
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   */
  addGridlines(xScale, yScale, width, height) {
    // X gridlines
    this.svg.append("g")
      .attr("class", "x-grid grid")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
        .ticks(d3.timeMinute.every(30))
        .tickSize(-height)
        .tickFormat(""));

    // Y gridlines
    this.svg.append("g")
      .attr("class", "y-grid grid")
      .call(d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(-width)
        .tickFormat(""));
  }

  /**
   * Create clip path for brushing
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   */
  createClipPath(width, height) {
    this.clip = this.svg.append("defs").append("svg:clipPath")
      .attr("id", "clip")
      .append("svg:rect")
      .attr("width", width)
      .attr("height", height)
      .attr("x", 0)
      .attr("y", 0);
  }

  /**
   * Draw line on chart
   * @param {Array} data - Data to plot
   * @param {Function} xScale - D3 X scale
   * @param {Function} yScale - D3 Y scale
   * @param {string} variable - Variable name to plot
   * @param {number} duration - Transition duration (default 0 for immediate update)
   */
  drawLine(data, xScale, yScale, variable, duration = 0) {
    const lineGenerator = d3.line()
      .defined(d =>
        d[variable] !== null &&
        d[variable] !== undefined &&
        !isNaN(d[variable]) &&
        isFinite(d[variable])
      )
      .x(d => xScale(d.Time))
      .y(d => yScale(d[variable]));

    if (!this.line) {
      // First time: create line group
      this.line = this.svg.append('g')
        .attr("clip-path", "url(#clip)");

      this.line.append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", this.colors.primary)
        .attr("stroke-width", 2);
    }

    // Update line with optional transition
    const linePath = this.line.select("path").datum(data);

    if (duration > 0) {
      linePath
        .transition()
        .duration(duration)
        .attr("d", lineGenerator);
    } else {
      linePath.attr("d", lineGenerator);
    }
  }

  /**
   * Add brush for zooming
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Function} onBrushEnd - Callback for brush end event
   */
  addBrush(width, height, onBrushEnd) {
    this.brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .on("end", onBrushEnd);

    if (this.line) {
      this.line.append("g")
        .attr("class", "brush")
        .call(this.brush);
    }
  }

  /**
   * Add plane icon to chart
   * @param {Object} position - {x, y} position
   */
  addPlaneIcon(position) {
    this.planeIcon = this.svg.append("image")
      .attr("xlink:href", this.planeIconUrl)
      .attr("width", this.iconWidth)
      .attr("height", this.iconWidth)
      .attr("x", position.x - this.iconWidth / 2)
      .attr("y", position.y - this.iconWidth / 2);

    return this.planeIcon;
  }

  /**
   * Update plane icon position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  updatePlaneIcon(x, y) {
    if (this.planeIcon) {
      this.planeIcon
        .attr("x", x - this.iconWidth / 2)
        .attr("y", y - this.iconWidth / 2);
    }
  }

  /**
   * Update dimensions and redraw
   * @param {Object} newDimensions - New dimensions {width, height, margin}
   */
  updateDimensions(newDimensions) {
    this.dimensions = newDimensions;
    const { width, height, margin } = newDimensions;

    if (this.svg) {
      const svgParent = this.svg.node().parentNode;
      d3.select(svgParent)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    }
  }

  /**
   * Clear all rendered elements
   */
  clear() {
    if (this.svg) {
      d3.select(this.selector).selectAll('*').remove();
    }
    this.svg = null;
    this.line = null;
    this.xAxis = null;
    this.yAxis = null;
    this.brush = null;
    this.clip = null;
    this.planeIcon = null;
  }

  /**
   * Get SVG element
   * @returns {Object} D3 SVG selection
   */
  getSVG() {
    return this.svg;
  }
}
