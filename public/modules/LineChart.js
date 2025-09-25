import { variableRealTime, UNITS, SPACER } from './chartselect.js';
import {loadData } from './loadData.js';
export let SELCHART;
export let CHARTS = []; // Array to store all chart instances
export let CHARTS_SVG = []; // Array to store SVG elements of all charts
export default class LineChart {
  constructor(svgSelector, videoSelector, data, long_name, showXLabel=false, timeline=true) {
      this.timeline = timeline;
      this.svg = d3.select(svgSelector);
      this.selector = svgSelector;
      this.video = document.getElementById(videoSelector);
      this.data = data;
      this.showXLabel = showXLabel;
      this.long_name = long_name;
            // FIX: Initialize variable as null first
      this.variable = null;
      this.currentVariable = null; // Add this for clarity
      

      this.planeIconUrl = 'icons/plane.png';
      this.updateDimensions();
      this.iconWidth = 16;
      this.yticks =5;
      //this.initChart();
      this.initialXDomain = this.getInitialXDomain();
      this.progress = 0;
      //append to CHARTS_SVG array
      CHARTS_SVG.push(this.svg);
      //this.addClickListener(); stopping click listener
      // Add resize event listener
      window.addEventListener('resize', () => this.onResize());
      
  }
  addClickListener() {
    this.svg.on('click', () => {
      d3.selectAll('.line-chart').classed('selected', false);
      // Add 'selected' class to the clicked chart
      d3.select(this.selector).select('.line-chart').classed('selected', true);
      SELCHART = this;
      console.log(`Chart selected: ${this.selector}`);
    });
  }
  axis(scale, orientation = 'bottom') {
    if (orientation === 'bottom') {
      return d3.axisBottom(scale.range([20, this.width - 20]));
    } else if (orientation === 'left') {
      return d3.axisLeft(scale);
    }
  }
  initChart() {
      const {svg} = this;
      // Append the svg object to the body of the page
      this.svg = svg.append("svg")
          .attr("class", "line-chart")
          .attr("width", this.width + this.margin.left + this.margin.right)
          .attr("height", this.height + this.margin.top + this.margin.bottom)
          .append("g")
          .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

      this.createAxes();
      this.addGridLabels();
      // Add the vertical line
    this.verticalLine = this.svg.append("line")
    .attr("class", "vertical-line")
    .attr("y1", 0)
    .attr("y2", this.height)
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", .5); // Initially hidden

  // Add the tooltip
  this.tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("opacity", .5); // Initially hidden

  // Add mouse event listeners
  this.svg.append("rect")
    .attr("width", this.width)
    .attr("height", this.height)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("mousemove", this.onMouseMove.bind(this))
    .on("mouseout", this.onMouseOut.bind(this));

      //add axis labels https://observablehq.com/@jeantimex/simple-line-chart-with-axis-labels
      // Add brushing
          // A function that updates the chart for given boundaries
      this.brush = d3.brushX()                   // Add the brush feature using the d3.brush function
        .extent( [ [0,0], [this.width,this.height] ] )  // initialize the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
        .on("end", this.updateChart.bind(this))               // Each time the brush selection changes, trigger the 'updateChart' function
      // Add a clipPath: everything out of this area won't be drawn.
      this.clip = this.svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", this.width )
        .attr("height", this.height )
        .attr("x", 0)
        .attr("y", 0);
      // Add the line
      //Create the line variable: where both the line and the brush take place
      this.line = this.svg.append('g')
        .attr("clip-path", "url(#clip)")
      console.log('Variables in this.data:', Object.keys(this.data[0] || {}));
      console.log(this.data.map(d => d['atx']));
      this.line.append("path")
          .datum(this.data)
          .attr("class", "line")  
          .attr("fill", "none")
          .attr("stroke", "steelblue")
          .attr("stroke-width", 1.5)
          .attr("d", d3.line()
              .defined(d => d[this.variable] !== null) 
              .x(d => this.x(d.Time))
              .y(d => this.y(d[this.variable]))
          );
      // Add the brushing
      this.line.append("g")
          .attr("class", "brush")
          .call(this.brush);
      // --- FIX: Find the last valid data point ---
      const lastValidData = this.data.slice().reverse().find(d => 
          d.Time && d[this.variable] !== null && d[this.variable] !== undefined && isFinite(d[this.variable])
      );
      // Add the plane icon
// Add the plane icon
      this.planeIcon = this.svg.append("image")
          .attr("xlink:href", this.planeIconUrl)
          .attr("width", this.iconWidth)
          .attr("height", this.iconWidth)
          // Use the *last* data point for the initial draw.
          .attr("x", this.x(this.data[this.data.length - 1].Time) - this.iconWidth / 2) 
          .attr("y", this.y(this.data[this.data.length - 1][this.variable]) - this.iconWidth / 2);

      // A function that set idleTimeOut to null
      // --- FIX: Only set position if valid data exists ---
      // --- FIX: Position the icon ONLY if a valid data point was found ---
      if (lastValidData) {
          this.planeIcon
              // X position based on Time
              .attr("x", this.x(lastValidData.Time) - this.iconWidth / 2) 
              // Y position based on the variable's value
              .attr("y", this.y(lastValidData[this.variable]) - this.iconWidth / 2);  
      } else {
          // Hide the icon if there's no valid data for this variable/flight combination
          this.planeIcon.style("opacity", 0);
          console.warn(`No valid data found for variable ${this.variable} to position the plane icon.`);
      }

    // If user double clicks, reinitialize the chart
    this.svg.on("dblclick", () => {
      this.syncCharts(null, null, null, this.initialXDomain); // Sync reset
    });
    this.updateProgress(0, this.data[0].time);

}
//Function to find x domain
getInitialXDomain() {
  // Get the initial x domain based on the data
  return d3.extent(this.data, d => d.Time); 
}

syncCharts(time, pageX, pageY, xDomain) {
  // Sync the vertical line, tooltip, and zoom level across all charts
  CHARTS.forEach(chart => {
    if (chart !== this) {
      const closestData = chart.getClosestData(time);
      if (closestData) {
        chart.verticalLine
          .attr("x1", chart.x(closestData.Time))
          .attr("x2", chart.x(closestData.Time))
          .attr("opacity", 1);
        // Update the tooltip in other charts
        chart.tooltip
          .style("left", `${pageX + 10}px`)
          .style("top", `${pageY - 20}px`)
          .style("opacity", 1) // Ensure opacity is set to 1
          .html(`
            <strong>Time:</strong> ${closestData.Time}<br>
            <strong>${chart.long_name}:</strong> ${closestData[chart.variable]}
          `);
      } else {
        //If no data is present, hide the tooltip
        chart.tooltip.style("opacity", 0);
      }
      // Sync zoom level
      if (xDomain) {
        chart.x.domain(xDomain);
        chart.xAxis.transition().duration(1000).call(chart.axis(chart.x, 'bottom').ticks(d3.timeMinute.every(30)));
        chart.line.select("path")
          .transition()
          .duration(1000)
          .attr("d", d3.line()
            .defined(d => d[chart.variable] !== null)
            .x(d => chart.x(d.Time))
            .y(d => chart.y(d[chart.variable]))
          );
        chart.updateGridlines();
      }
    }
  });
}
onMouseOut() {
  // Hide the vertical line and tooltip
  this.verticalLine.attr("opacity", 0);
  this.tooltip.style("opacity", 0);

  // Hide the vertical line in other charts
  CHARTS.forEach(chart => {
    if (chart !== this) {
      chart.verticalLine.attr("opacity", 0);
    }
  });
}

getClosestData(xValue) {
  // Find the closest data point to the given x value using the current x scale
  return this.data.reduce((prev, curr) => {
    return Math.abs(this.x(curr.Time) - this.x(xValue)) < Math.abs(this.x(prev.Time) - this.x(xValue)) ? curr : prev;
  });
}
idled() {
  this.idleTimeout = null;
}
createAxes() {
// Add Y axis
  console.log(this.data)
  this.y = d3.scaleLinear()
    .domain([d3.min(this.data, d => d[this.variable]), d3.max(this.data, d => d[this.variable])])
    .range([this.height, 0]);
  this.yAxisGenerator = this.axis(this.y, 'left')
    .ticks(this.yticks);

  this.yAxis = this.svg.append("g")
    .attr("class", "y-axis")
    .call(this.yAxisGenerator);


  // Add X axis
  this.x = d3.scaleUtc().domain(d3.extent(this.data, d => d.Time)).range([0, this.width]);
    this.xAxisGenerator = this.axis(this.x, 'bottom')
        .ticks(d3.utcMinute.every(30)); // Set ticks every 15 minutes

    this.xAxis = this.svg.append("g")
        .attr("transform", `translate(0,${this.height})`)
        .call(this.xAxisGenerator);
}

addGridLabels() {
  // Add grid lines
  const makeXGridlines = () => d3.axisBottom(this.x).ticks(d3.timeMinute.every(30));
  const makeYGridlines = () => d3.axisLeft(this.y).ticks(this.yticks);

   // Add X axis label
  if (this.showXLabel) {
    this.svg.append("text")
      .attr("class", "x-axis-label")
      .attr("text-anchor", "middle")
      .attr("x", this.width / 2)
      .attr("y", this.height + this.margin.top + 20)
      .text("Time");
    }
  // Add Y axis label
  this.svg.append("text")
    .attr("class", "y-axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("font-size", "12px")
    .attr("y", -this.margin.left+20)
    .attr("x", - this.height / 2 )
    .text(UNITS[this.long_name]);
  // Add X gridlines
  this.svg.append("g")
    .attr("class", "x-grid grid")
    .attr("transform", `translate(0,${this.height})`)
    .call(makeXGridlines()
        .tickSize(-this.height)
        .tickFormat(""));

  // Add Y gridlines
  this.svg.append("g")
    .attr("class", "y-grid grid")
    .call(makeYGridlines()
        .tickSize(-this.width)
        .tickFormat(""));

  this.svg.append("text")
    .attr("class", "chart-title")
    .attr("text-anchor", "middle")
    .attr("x", this.width / 2)
    .attr("y", -2)
    .attr("font-size", "12px")
    .text(this.long_name);
}

updateChart(event) {
  const extent = event.selection;

  // If no selection, back to initial coordinate. Otherwise, update X axis domain
  if (!extent) {
    if (!this.idleTimeout) return this.idleTimeout = setTimeout(this.idled.bind(this), 350); // This allows to wait a little bit
    this.x.domain(d3.extent(this.data, d => d.Time));
  } else {
    const newXDomain = [this.x.invert(extent[0]), this.x.invert(extent[1])];
    this.x.domain(newXDomain);
    this.line.select(".brush").call(this.brush.move, null); // This removes the grey brush area as soon as the selection has been done
    this.syncCharts(null, null, null, newXDomain); // Sync zoom level
  }

  // Update axis and line position
  this.xAxis.transition().duration(1000).call(this.axis(this.x, 'bottom').ticks(d3.timeMinute.every(30)));
  this.line.select("path")
    .transition()
    .duration(1000)
    .attr("d", d3.line()
      .defined(d => d[this.variable] !== null)
      .x(d => this.x(d.Time))
      .y(d => this.y(d[this.variable]))
    );
  this.updateGridlines();
};

onMouseMove(event) {
  const [mouseX] = d3.pointer(event);
  const xValue = this.x.invert(mouseX); // Get the corresponding x value
  const closestData = this.getClosestData(xValue); // Find the closest data point

  if (closestData) {
    // Update the vertical line
    this.verticalLine
      .attr("x1", this.x(closestData.Time))
      .attr("x2", this.x(closestData.Time))
      .attr("opacity", 1);

    // Update the tooltip
    this.tooltip
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY - 20}px`)
      .style("opacity", 1)
      .html(`
        <strong>Time:</strong> ${closestData.Time}<br>
        <strong>${this.long_name}:</strong> ${closestData[this.variable]}
      `);

    // Sync with other charts
    this.syncCharts(closestData.Time, event.pageX, event.pageY, this.x.domain()); // Pass xDomain
  }
}

updateGridlines(duration = 1000) {
  // Update X gridlines
  this.svg.select(".x-grid")
    .transition()
    .duration(duration)
    .attr("transform", `translate(0,${this.height})`)
    .call(d3.axisBottom(this.x)
      .ticks(d3.timeMinute.every(30))
      .tickSize(-this.height)
      .tickFormat(""));

  // Update Y gridlines
  this.svg.select(".y-grid")
    .transition()
    .duration(duration)
    .call(d3.axisLeft(this.y)
      .ticks(this.yticks)
      .tickSize(-this.width)
      .tickFormat(""));
}


//Filter the data to the current time of the video
dataFilter(){
  // Calculate the number of data points to display based on the progress
  const totalDataPoints = this.data ? this.data.length : 0;
  const dataPointsToShow = Math.floor(this.progress * totalDataPoints);

  // Filter the data to show only the portion corresponding to the video's progress
  return this.data.slice(0, dataPointsToShow).filter(d => !isNaN(d[this.variable]));
}

updateLinePos(curDat){
  // Update the line chart
  this.line.select(".line").datum(curDat)
  .attr("d", d3.line()
      .defined(d => d[this.variable] !== null)
      .x(d => this.x(d.Time))
      .y(d => this.y(d[this.variable]))
  );

  // Update the plane icon position
  if (curDat.length > 0) {
  const latestData = curDat[curDat.length - 1];
  this.planeIcon
      .attr("x", this.x(latestData.Time) - this.iconWidth / 2)
      .attr("y", this.y(latestData[this.variable]) - this.iconWidth / 2);
  }
}
updateProgress(progress, dataTime) {
    if (!this.timeline) return; // Keep this check if needed

     this.progress = progress;
    
    // Filter the data to show only the portion corresponding to the current time
    const currentData = this.dataFilter();

    // 2. Update the line chart and plane icon
    this.updateLinePos(currentData);
}

// initVideoSync() {
//   if (!this.timeline) return;
//   this.video.addEventListener('timeupdate', () => {
//       const currentTime = this.video.currentTime;
//       const duration = this.video.duration;
//       this.progress = currentTime / duration;

//       // Filter the data to show only the portion corresponding to the video's progress
//       const currentData = this.dataFilter()
//       this.updateLinePos(currentData);
//   });
// }
updateDimensions() {
  const parentContainer = document.querySelector("#graph-container"); // Get the parent container
  const containerWidth = parentContainer.getBoundingClientRect().width; // Get the width of the parent container
  const containerHeight = parentContainer.getBoundingClientRect().height; // Get the height of the parent container
  if (this.showXLabel){ 
    this.margin = { top: 20, right: 20, bottom: 50, left: 50 };
  }
  else {
    this.margin = { top: 20, right: 20, bottom: 0, left: 50 };
    
  }
  
  this.width = containerWidth- this.margin.left - this.margin.right;
  this.height = containerHeight / SPACER - this.margin.top //-this.margin.bottom;
  
}
updateAxes() {
  this.x.range([0, this.width]);
  this.y.range([this.height, 0]);
  this.x.domain(d3.extent(this.data, d => d.Time));
  this.y.domain([d3.min(this.data, d => d[this.variable]), d3.max(this.data, d => d[this.variable])]);
  // Update the x-axis
  this.xAxis
    .attr("transform", `translate(0,${this.height})`)
    .call(this.axis(this.x, 'bottom').ticks(d3.utcMinute.every(30)));
  
  // Update the y-axis
  this.yAxis.call(d3.axisLeft(this.y).ticks(this.yticks));
  this.svg.select(".x-axis-label")
    .attr("x", this.width / 2)
    .attr("y", this.height + this.margin.top + 20);
  this.svg.select(".y-axis-label")
    .attr("y", -this.margin.left + 20)
    .attr("x", - this.height / 2 );
}
onResize() {
  // Update dimensions
  this.updateDimensions();
  
  // Update SVG dimensions
  d3.select(this.selector).select("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom);
  // Update the clip path dimensions
  this.clip
      .attr("width", this.width)
      .attr("height", this.height);
  this.updateAxes();
  this.updateGridlines(0);
  //this.xAxis.transition().call(this.axis(this.x, 'bottom').ticks(d3.timeMinute.every(15)));
  this.line.select("path")
    .transition()
    .attr("d", d3.line()
    .defined(d => d[this.variable] !== null) 
      .x(d => this.x(d.Time))
      .y(d => this.y(d[this.variable]))
    );
    
    
    // Update the brush extent
    this.brush.extent([[0, 0], [this.width, this.height]]);


    // Reapply the brush to the chart
    this.svg.select(".brush")
        .call(this.brush);
  
}
/**
 * Updates the chart with new data by performing the following actions:
 * - Updates the chart dimensions.
 * - Updates the axes and gridlines.
 * - Updates the y-axis label and chart title based on the current unit and long name.
 * - Filters the current data and updates the line position accordingly.
 * - Resets the brush extent to match the updated chart dimensions.
 * - Initializes the x-axis domain for the updated data.
 */
addNewData() {
  // Update the chart with the new data
  this.updateDimensions();
  this.createAxes(); 
  this.updateAxes();
  this.updateGridlines(0);
  this.svg.select(".y-axis-label").text(UNITS[this.long_name]);
  this.svg.select(".chart-title").text(this.long_name);
  const currentData = this.dataFilter()
  this.updateLinePos(currentData);
  this.brush.extent([[0, 0], [this.width, this.height]]);
  this.svg.select(".brush").call(this.brush);
  this.initialXDomain = this.getInitialXDomain();
}

/**
 * Updates the chart data and variable based on the provided new data and variable name.
 *
 * @param {Array} newData - The new dataset to update the chart with.
 * @param {string} long_name - The long name of the variable to be used for data source lookup.
 */
updateData(newData, clean_name,long_name=null) {
  this.data = newData;
  this.variable = clean_name;
  this.long_name= long_name;
  this.addNewData()
}

// Add this method to set the variable and initialize the chart
setVariable(cleanName,long_name=null) {
    console.log('setVariable called with:', { cleanName });
    console.log('Available data columns:', Object.keys(this.data[0] || {}));
    
    // Validate that the variable exists in the data
    if (!this.data || this.data.length === 0) {
        console.error('No data available');
        return;
    }
    
    const availableColumns = Object.keys(this.data[0]);
    console.log('Looking for variable:', cleanName, 'in columns:', availableColumns);
    
    if (!availableColumns.includes(cleanName)) {
        console.error(`Variable ${cleanName} not found in data. Available columns:`, availableColumns);
        
        // Try to find a similar variable name
        const lowerCleanName = cleanName.toLowerCase();
        const matchingColumn = availableColumns.find(col => 
            col.toLowerCase() === lowerCleanName ||
            col.toLowerCase().includes(lowerCleanName) ||
            lowerCleanName.includes(col.toLowerCase())
        );
        
        if (matchingColumn) {
            console.log(`Using similar column: ${matchingColumn} for ${cleanName}`);
            this.variable = matchingColumn;
            this.currentVariable = matchingColumn;
        } else {
            //look for column named ?column? and rename to variable
            const columnName = availableColumns.find(col => col.toLowerCase().includes('column'));
            if (columnName) {
                console.warn(`No exact match for ${cleanName}, using column named ${columnName}`);
                this.variable = cleanName;
                this.currentVariable = cleanName;
             }
            else{ // Use the found column name
            console.error('No similar column found, chart creation aborted');
            return;}
        }
    } else {
        this.variable = cleanName;
        this.currentVariable = cleanName;
    }
    
    this.long_name = long_name;

    console.log('Variable set to:', this.variable);
    
    // Validate that the variable has some valid data
    const hasValidData = this.data.some(entry => {
        const value = entry[this.variable];
        return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
    });
    
    if (!hasValidData) {
        console.error(`No valid data for variable ${this.variable}`);
        return;
    }
    
    // Now initialize the chart
    if (!this.chartInitialized) {
        this.initChart();
        this.chartInitialized = true;
        this.initialXDomain = this.getInitialXDomain();
    } else {
        this.updateChart();
    }
}
}



export function setSelectedChart(chart) {
  SELCHART = chart;
}

export function removeLineCharts(charts) {
  // Clear the contents of the container elements
  const chartContainers = ["#chart1", "#chart2", "#chart3", "#chart4"];
  chartContainers.forEach(container => {
    const element = document.querySelector(container);
    if (element) {
      element.innerHTML = '';
    }
  });

  // Clear the charts array
  charts.length = 0; // Use length assignment to clear the array
  console.log('Charts removed:', charts);
}