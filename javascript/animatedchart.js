class LineChart {
  constructor(svgSelector, videoSelector, data, long_name, showXLabel=false) {
      this.svg = d3.select(svgSelector);
      this.selector = svgSelector;
      this.video = document.getElementById(videoSelector);
      this.data = data;
      this.showXLabel = showXLabel;
      this.long_name = long_name;
      this.variable= variableDataSources[long_name]
      this.planeIconUrl = 'plane.png';
      this.updateDimensions();
      this.iconWidth = 16;
      this.yticks =5;
      this.initChart();
      this.progress = 0;
      
      // Add resize event listener
      window.addEventListener('resize', () => this.onResize());
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
      this.initVideoSync();

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

      // Add the plane icon
      this.planeIcon = this.svg.append("image")
          .attr("xlink:href", this.planeIconUrl)
          .attr("width", this.iconWidth)
          .attr("height", this.iconWidth)
          .attr("x", this.x(this.data[this.data.length - 1].Time) - this.iconWidth / 2) 
          .attr("y", this.y(this.data[this.data.length - 1].data) - this.iconWidth / 2);  
      // A function that set idleTimeOut to null


    // If user double clicks, reinitialize the chart
    this.svg.on("dblclick", () => {
      this.x.domain(d3.extent(this.data, d => d.Time));
      this.xAxis.transition().call(this.axis(this.x, 'bottom').ticks(d3.utcMinute.every(30)));
      this.line.select("path")
      .transition()
      .attr("d", d3.line()
        .defined(d => d[this.variable] !== null) 
        .x(d => this.x(d.Time))
        .y(d => this.y(d[this.variable]))
      );
      this.updateGridlines(0);
    });

}
idled() {
  this.idleTimeout = null;
}
createAxes() {
// Add Y axis
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
    this.x.domain([4,8]);
  } else {
    this.x.domain([this.x.invert(extent[0]), this.x.invert(extent[1])]);
    this.line.select(".brush").call(this.brush.move, null); // This removes the grey brush area as soon as the selection has been done
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

initVideoSync() {
  this.video.addEventListener('timeupdate', () => {
      const currentTime = this.video.currentTime;
      const duration = this.video.duration;
      this.progress = currentTime / duration;

      // Filter the data to show only the portion corresponding to the video's progress
      const currentData = this.dataFilter()
      this.updateLinePos(currentData);
  });
}
updateDimensions() {
  if (this.showXLabel){ 
    this.margin = { top: 20, right: 20, bottom: 50, left: 50 };
  }
  else {
    this.margin = { top: 20, right: 20, bottom: 0, left: 50 };
    
  }
  
  this.width = window.innerWidth/2 - this.margin.left - this.margin.right;
  this.height = window.innerHeight / 8 - this.margin.top //- this.margin.bottom;
  
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
addNewData() {
  // Update the chart with the new data
  this.updateDimensions();
  this.updateAxes();
  this.updateGridlines(0);
  this.svg.select(".y-axis-label").text(UNITS[this.long_name]);
  this.svg.select(".chart-title").text(this.long_name);
  const currentData = this.dataFilter()
  this.updateLinePos(currentData);
  this.brush.extent([[0, 0], [this.width, this.height]]);
  this.svg.select(".brush").call(this.brush);
}
updateData(newData, long_name) {
  this.data = newData;
  this.variable = variableDataSources[long_name];
  this.long_name= long_name;
  this.addNewData()
}
updateDataSource(dataSource, variable) {
  this.json = dataSource;
  this.variable = variable;
  // Fetch new data and update the chart
  fetch(this.json)
    .then(response => response.json())
    .then(data => {
        const timeArray = data.coords.Time.data;
        const dataArray = data.data;
        const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
        this.data= dataArray.map((value, index) => ({
            Time: parseTime(timeArray[index]),
            data: +value
        }));
    this.addNewData();
    }).catch(error => {
        console.error('Error fetching the JSON file:', error);
  });}
  setVariable(long_name) {
    this.variable = variableDataSources[long_name];
    this.long_name = long_name;
    this.addNewData();
  }


}

document.getElementById('variable-select').addEventListener('change', function() {
  const selectedVariable = this.value;
  updateChartVariable(selectedVariable);
});

let flight = 'TF06';




function updateChartFlight(flight, variable,chart) {
  const dataSource = `${flight.toLowerCase()}.json`;
    // Update the chart with the new data source
  chart.updateData(dataSource, variable);
 
}

function updateChartVariable(variable) {
  const baseFileName = variableDataSources[variable];
  if (baseFileName) {

    charts[0].setVariable(variable);
  } else {
    console.error('Data source not found for variable:', variable);
  }
}
function loadData(dataSource, callback) {
  fetch(dataSource)
    .then(response => response.text())
    .then(text => {
      const cleanedText = text.replace(/NaN/g, 'null'); // Replace NaN with null
      const data = JSON.parse(cleanedText);
      const timeArray = data.coords.Time.data;
      const dataArray = data.data_vars;
      const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
      const parsedData = timeArray.map((time, index) => {
        const entry = { Time: parseTime(time) };
        for (const variable in dataArray) {
          let value = +dataArray[variable].data[index];
          if (value === -32767) {
            value = null; // Replace -32767 with null
          }
          entry[variable] = value;
        }
        return entry;
      });
      callback(parsedData);
    })
    .catch(error => {
      console.error('Error fetching the JSON file:', error);
    });
}



let charts = [];
const initialData = `${flight.toLowerCase()}.json`;
loadData(initialData, (parsedData) => {
  charts.push(new LineChart("#my_dataviz", "myVideo", parsedData, 'Temperature'))
  charts.push(new LineChart("#chart2", "myVideo", parsedData, "Wind Speed"));
  charts.push(new LineChart("#chart3", "myVideo", parsedData, "Wind Direction"));
  charts.push(new LineChart("#chart4", "myVideo", parsedData, "Fast Response Ozone Mixing Ratio", true));
});
//charts.push(new LineChart("#my_dataviz", "myVideo", `ATX${flight.toLowerCase()}.json`, 'Temperature (C)'))
//charts.push(new LineChart("#chart2", "myVideo", `WIC${flight.toLowerCase()}.json`, "Wind Speed (m/s)"));

console.log(charts);
document.getElementById('flight-select').addEventListener('change', function() {
  flight= this.value;
  this.progress=1;
  
  const newDataSource = `${flight.toLowerCase()}.json`;
  loadData(newDataSource, (parsedData) => {
    let count = 0;
    for (const long_name in variableDataSources) {
      if (count < charts.length) {
        console.log(long_name, count);
        console.log(charts[count]);
        charts[count].setVariable(long_name);
        charts[count].updateData(parsedData,long_name);
        charts[count].initVideoSync();
        
        count++;
      } else {
        console.error('Index out of bounds: charts array does not have enough elements');
      }
    }
});
});
