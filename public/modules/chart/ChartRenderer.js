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
    this.yAxisRight = null;
    this.brush = null;
    this.clip = null;
    this.planeIcon = null;
    this.planeHeading = 0;
    this.iconWidth = 32;
    this.planeIconUrl = 'icons/plane.svg';
  }

  /**
   * Initialize SVG canvas
   * @returns {Object} D3 SVG selection
   */
  initSVG() {
    const { width, height, margin } = this.dimensions;
    const svgContainer = d3.select(this.selector);

    this.svgElement = svgContainer.append("svg")
      .attr("class", "line-chart")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "none")
      .style("width", "100%")
      .style("height", "100%")
      .style("display", "block");

    this.svg = this.svgElement.append("g")
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

    // console.log('[ChartRenderer] createAxes - xScale domain:', {
    //   start: xScale.domain()[0].toISOString(),
    //   end: xScale.domain()[1].toISOString(),
    //   range: xScale.range()
    // });

    // Check if axes already exist
    const xAxisExists = this.svg.select(".x-axis").size() > 0;
    const yAxisExists = this.svg.select(".y-axis").size() > 0;

    if (xAxisExists && yAxisExists) {
      // console.log('[ChartRenderer] Axes already exist, using existing elements');
      this.xAxis = this.svg.select(".x-axis");
      this.yAxis = this.svg.select(".y-axis");
      // Update them with current scales
      this.updateAxes(xScale, yScale, showXLabel, 0);
      return;
    }

    // Create X axis - only if doesn't exist
    if (!xAxisExists) {
      this.xAxis = this.svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);
    } else {
      this.xAxis = this.svg.select(".x-axis");
    }

    if (showXLabel) {
      this.xAxis.call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%H:%M')));
    } else {
      this.xAxis.call(d3.axisBottom(xScale).tickFormat(""));
    }

    // Create Y axis - only if doesn't exist
    if (!yAxisExists) {
      this.yAxis = this.svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).ticks(5));
    } else {
      this.yAxis = this.svg.select(".y-axis");
      this.yAxis.call(d3.axisLeft(yScale).ticks(5));
    }
  }

  /**
   * Create dual Y axes (left and right)
   * @param {Function} xScale
   * @param {Function} yLeftScale
   * @param {Function} yRightScale
   * @param {number} height
   * @param {boolean} showXLabel
   */
  createDualAxes(xScale, yLeftScale, yRightScale, height, showXLabel = false) {
    const { width } = this.dimensions;

    // X axis
    const xAxisExists = this.svg.select('.x-axis').size() > 0;
    if (!xAxisExists) {
      this.xAxis = this.svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`);
    } else {
      this.xAxis = this.svg.select('.x-axis');
      this.xAxis.attr('transform', `translate(0,${height})`);
    }
    if (showXLabel) {
      this.xAxis.call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%H:%M')));
    } else {
      this.xAxis.call(d3.axisBottom(xScale).tickFormat(''));
    }

    // Left Y axis
    const yLeftExists = this.svg.select('.y-axis').size() > 0;
    if (!yLeftExists) {
      this.yAxis = this.svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yLeftScale).ticks(5));
    } else {
      this.yAxis = this.svg.select('.y-axis');
      this.yAxis.call(d3.axisLeft(yLeftScale).ticks(5));
    }

    // Right Y axis
    const yRightExists = this.svg.select('.y-axis-right').size() > 0;
    if (!yRightExists) {
      this.yAxisRight = this.svg.append('g')
        .attr('class', 'y-axis-right')
        .attr('transform', `translate(${width},0)`)
        .call(d3.axisRight(yRightScale).ticks(5));
    } else {
      this.yAxisRight = this.svg.select('.y-axis-right');
      this.yAxisRight.attr('transform', `translate(${width},0)`).call(d3.axisRight(yRightScale).ticks(5));
    }
  }

  /**
   * Update axes with new scales
   * @param {Function} xScale - D3 X scale
   * @param {Function} yScale - D3 Y scale
   * @param {boolean} showXLabel - Whether to show X axis labels
   * @param {number} duration - Transition duration in ms (default 500)
   * @param {boolean} isZoomed - Whether chart is zoomed in (default false)
   */
  updateAxes(xScale, yScale, showXLabel = false, duration = 500, isZoomed = false) {
    const { height } = this.dimensions;
    
    if (this.xAxis) {
      let xAxisCall;
      
      // Ensure x-axis is always at the bottom
      this.xAxis.attr("transform", `translate(0,${height})`);
      
      // Show labels if showXLabel is true OR if chart is zoomed
      if (showXLabel || isZoomed) {
        // Always show max 10 ticks with time labels
        xAxisCall = d3.axisBottom(xScale)
          .ticks(10)
          .tickFormat(d3.timeFormat("%H:%M"));
      } else {
        // No labels at all
        xAxisCall = d3.axisBottom(xScale).tickFormat("");
      }

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
   * Update dual axes
   */
  updateDualAxes(xScale, yLeftScale, yRightScale, showXLabel = false, duration = 500, isZoomed = false) {
    const { height, width } = this.dimensions;
    if (this.xAxis) {
      this.xAxis.attr('transform', `translate(0,${height})`);
      let xAxisCall;
      if (showXLabel || isZoomed) {
        xAxisCall = d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%H:%M'));
      } else {
        xAxisCall = d3.axisBottom(xScale).tickFormat('');
      }
      this.xAxis.transition().duration(duration).call(xAxisCall);
    }
    if (this.yAxis) {
      this.yAxis.transition().duration(duration).call(d3.axisLeft(yLeftScale).ticks(5));
    }
    if (this.yAxisRight) {
      this.yAxisRight.attr('transform', `translate(${width},0)`).transition().duration(duration).call(d3.axisRight(yRightScale).ticks(5));
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
    // Check if gridlines already exist, if so just update them
    const xGridExists = this.svg.select(".x-grid").size() > 0;
    const yGridExists = this.svg.select(".y-grid").size() > 0;
    const zeroLineExists = this.svg.select(".zero-line").size() > 0;

    if (xGridExists && yGridExists) {
      // console.log('[ChartRenderer] Gridlines already exist, skipping append');
      // But update zero line position
      if (zeroLineExists) {
        const zeroY = yScale(0);
        this.svg.select(".zero-line")
          .attr("y1", zeroY)
          .attr("y2", zeroY);
      } else {
        this.addZeroLine(yScale, width);
      }
      return;
    }

    // X gridlines - only append if not exists
    if (!xGridExists) {
      this.svg.append("g")
        .attr("class", "x-grid grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
          .ticks(10)
          .tickSize(-height)
          .tickFormat(""));
    }

    // Y gridlines - only append if not exists
    if (!yGridExists) {
      this.svg.append("g")
        .attr("class", "y-grid grid")
        .call(d3.axisLeft(yScale)
          .ticks(5)
          .tickSize(-width)
          .tickFormat(""));
    }

    // Add zero line if not exists
    if (!zeroLineExists) {
      this.addZeroLine(yScale, width);
    }
  }

  /**
   * Add a special gridline at y=0
   * @param {Function} yScale - D3 Y scale
   * @param {number} width - Chart width
   */
  addZeroLine(yScale, width) {
    const zeroY = yScale(0);
    // Only add if zero is within the chart range
    if (zeroY >= 0 && zeroY <= this.dimensions.height) {
      this.svg.append("line")
        .attr("class", "zero-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", zeroY)
        .attr("y2", zeroY)
        .attr("stroke", "#000")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.4)
        .attr("shape-rendering", "crispEdges");
    }
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
   * Draw multiple lines with respective Y scales
   * Cleans up lines that are no longer in the series
   * @param {Array} series - [{ data, variable, yScale, color }]
   * @param {Function} xScale
   * @param {number} duration
   */
  drawMultiLines(series, xScale, duration = 0) {
    // Create container group
    let linesGroup = this.svg.select('.lines');
    if (linesGroup.empty()) {
      linesGroup = this.svg.append('g').attr('class', 'lines').attr('clip-path', 'url(#clip)');
    }

    // Track which variables are in the current series
    const currentVariables = new Set(series.map(s => s.variable));

    // Remove lines that are no longer in the series
    linesGroup.selectAll('path').each(function() {
      const path = d3.select(this);
      const classList = path.attr('class') || '';
      // Extract variable name from class (format: "line-variableName")
      const match = classList.match(/^line-(.+)$/);
      if (match) {
        const variable = match[1];
        if (!currentVariables.has(variable)) {
          path.remove();
        }
      }
    });

    // Draw/update lines for current series
    series.forEach(s => {
      const lineGen = d3.line()
        .defined(d => d[s.variable] !== null && d[s.variable] !== undefined && !isNaN(d[s.variable]) && isFinite(d[s.variable]))
        .x(d => xScale(d.Time))
        .y(d => s.yScale(d[s.variable]));

      const cls = `line-${s.variable}`;
      let path = linesGroup.select(`path.${cls}`);
      if (path.empty()) {
        path = linesGroup.append('path')
          .attr('class', cls)
          .attr('fill', 'none')
          .attr('stroke', s.color || this.colors.primary)
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.9);
      } else {
        // Update color in case it changed
        path.attr('stroke', s.color || this.colors.primary);
      }

      path.datum(s.data);
      if (duration > 0) {
        path.transition().duration(duration).attr('d', lineGen);
      } else {
        path.attr('d', lineGen);
      }
    });
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

    // Check if brush already exists
    const brushExists = this.svg.select(".brush").size() > 0;

    if (brushExists) {
      // console.log('[ChartRenderer] Brush already exists, using existing element');
      this.brushGroup = this.svg.select(".brush");
      this.brushGroup.call(this.brush);
      return;
    }

    // Append brush directly to SVG, not to line group (which has clip-path)
    // Note: Don't set pointer-events on brush group - let D3 handle it
    // This allows the hover area to receive events for tooltips
    if (this.svg) {
      this.brushGroup = this.svg.append("g")
        .attr("class", "brush")
        .call(this.brush);

      // console.log("Brush group created:", this.brushGroup.node());
    }
  }

  /**
   * Add plane icon to chart
   * @param {Object} position - {x, y} position
   * @param {number} [heading=0] - Optional heading in degrees
   */
  addPlaneIcon(position, heading = 0) {
    this.planeIcon = this.svg.append("image")
      .attr("xlink:href", this.planeIconUrl)
      .attr("width", this.iconWidth)
      .attr("height", this.iconWidth)
      .attr("x", position.x - this.iconWidth / 2)
      .attr("y", position.y - this.iconWidth / 2);

    this.planeHeading = heading ?? 0;
    this.applyPlaneTransform();

    return this.planeIcon;
  }

  /**
   * Update plane icon position
   * @param {Object} position - Position object {x, y}
   * @param {number} [heading] - Optional heading in degrees
   */
  updatePlaneIcon(position, heading) {
    if (this.planeIcon) {
      this.planeIcon
        .attr("x", position.x - this.iconWidth / 2)
        .attr("y", position.y - this.iconWidth / 2);

      if (heading !== undefined && heading !== null) {
        this.planeHeading = heading;
      }

      this.applyPlaneTransform();
    }
  }

  /**
   * Update heading without moving the icon
   * @param {number} heading - Heading in degrees
   */
  setPlaneHeading(heading) {
    if (heading === undefined || heading === null || !this.planeIcon) return;
    this.planeHeading = heading;
    this.applyPlaneTransform();
  }

  /**
   * Apply rotation around the icon center
   */
  applyPlaneTransform() {
    if (!this.planeIcon) return;

    const x = parseFloat(this.planeIcon.attr("x"));
    const y = parseFloat(this.planeIcon.attr("y"));

    if (Number.isNaN(x) || Number.isNaN(y)) return;

    const cx = x + this.iconWidth / 2;
    const cy = y + this.iconWidth / 2;
    const heading = this.planeHeading || 0;

    this.planeIcon.attr("transform", `rotate(${heading}, ${cx}, ${cy})`);
  }

  /**
   * Update dimensions and redraw
   * @param {Object} newDimensions - New dimensions {width, height, margin}
   */
  updateDimensions(newDimensions) {
    this.dimensions = newDimensions;
    const { width, height, margin } = newDimensions;

    if (this.svgElement) {
      // Update viewBox to match new dimensions for responsive scaling
      this.svgElement.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
    }

    // Update clip-path to match new dimensions
    if (this.clip) {
      this.clip.attr("width", width).attr("height", height);
    }

    // Update label positions to scale proportionally
    this.updateLabelPositions(width, height, margin);
  }

  /**
   * Update label positions when chart dimensions change
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Object} margin - Chart margins
   */
  updateLabelPositions(width, height, margin) {
    // Only update if SVG has been initialized
    if (!this.svg) return;

    // Update title position (top middle)
    this.svg.select(".chart-title")
      .attr("x", width / 2)
      .attr("y", -5);

    // Update y-axis label position (middle right)
    this.svg.select(".y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2));
  }

  /**
   * Remove duplicate axes and gridlines (cleanup utility)
   */
  removeDuplicates() {
    if (!this.svg) return;

    // Remove duplicate x-axes (keep first one)
    const xAxes = this.svg.selectAll(".x-axis");
    if (xAxes.size() > 1) {
      // console.log(`[ChartRenderer] Found ${xAxes.size()} x-axes, removing duplicates`);
      xAxes.each(function(d, i) {
        if (i > 0) d3.select(this).remove();
      });
    }

    // Remove duplicate y-axes (keep first one)
    const yAxes = this.svg.selectAll(".y-axis");
    if (yAxes.size() > 1) {
      // console.log(`[ChartRenderer] Found ${yAxes.size()} y-axes, removing duplicates`);
      yAxes.each(function(d, i) {
        if (i > 0) d3.select(this).remove();
      });
    }

    // Remove duplicate x-grids (keep first one)
    const xGrids = this.svg.selectAll(".x-grid");
    if (xGrids.size() > 1) {
      xGrids.each(function(d, i) {
        if (i > 0) d3.select(this).remove();
      });
    }

    // Remove duplicate y-grids (keep first one)
    const yGrids = this.svg.selectAll(".y-grid");
    if (yGrids.size() > 1) {
      yGrids.each(function(d, i) {
        if (i > 0) d3.select(this).remove();
      });
    }

    // Remove duplicate brushes (keep first one)
    const brushes = this.svg.selectAll(".brush");
    if (brushes.size() > 1) {
      brushes.each(function(d, i) {
        if (i > 0) d3.select(this).remove();
      });
    }

    // Remove duplicate hover areas (keep first one)
    const hoverAreas = this.svg.selectAll(".chart-hover-area");
    if (hoverAreas.size() > 1) {
      hoverAreas.each(function(d, i) {
        if (i > 0) d3.select(this).remove();
      });
    }

    // Update references to point to the remaining elements
    this.xAxis = this.svg.select(".x-axis");
    this.yAxis = this.svg.select(".y-axis");
    this.brushGroup = this.svg.select(".brush");
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
    this.yAxisRight = null;
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
