/**
 * Manages chart data and state
 * Handles data filtering, progress tracking, and data queries
 * @class ChartState
 */
export class ChartState {
  /**
   * Creates chart state instance
   * @param {Array<Object>} data - Time-series data
   * @param {string|null} variable - Variable name to display
   */
  constructor(data, variable) {
    this.data = data;
    this.variable = variable;
    this.currentVariable = null;
    this.progress = 0;
    this.initialXDomain = null;
  }

  /**
   * Set the current variable to display
   * @param {string} variable - Variable name
   */
  setVariable(variable) {
    this.variable = variable;
    this.currentVariable = variable;
  }

  /**
   * Filter data based on current progress (for timeline animation)
   * @returns {Array<Object>} Filtered data up to current progress
   */
  filterDataByProgress() {
    if (!this.data) return [];
    const totalDataPoints = this.data.length;
    const dataPointsToShow = Math.floor(this.progress * totalDataPoints);
    return this.data.slice(0, dataPointsToShow)
      .filter(d => d[this.variable] !== null && !isNaN(d[this.variable]));
  }

  /**
   * Get all data for the current variable
   * @returns {Array<Object>} All data points with valid values
   */
  getFilteredData() {
    if (!this.data || !this.variable) return [];
    return this.data.filter(d => d[this.variable] !== null && !isNaN(d[this.variable]));
  }

  /**
   * Update the progress value (0 to 1)
   * @param {number} progress - Progress value between 0 and 1
   */
  updateProgress(progress) {
    this.progress = Math.max(0, Math.min(1, progress));
  }

  /**
   * Get the initial X domain (time extent)
   * @returns {Array} [minTime, maxTime]
   */
  getInitialXDomain() {
    if (!this.data || this.data.length === 0) return [0, 1];
    return d3.extent(this.data, d => d.Time);
  }

  /**
   * Find the closest data point to a given X value
   * @param {Date} xValue - Time value to search for
   * @param {Function} xScale - D3 scale function
   * @returns {Object|null} Closest data point
   */
  getClosestData(xValue, xScale) {
    if (!this.data || this.data.length === 0) return null;

    // Binary search — O(log n) instead of O(n) linear scan
    const bisect = d3.bisector(d => d.Time).left;
    const index = bisect(this.data, xValue);

    const d0 = this.data[index - 1];
    const d1 = this.data[index];

    if (!d0) return d1;
    if (!d1) return d0;
    return (xValue - d0.Time > d1.Time - xValue) ? d1 : d0;
  }

  /**
   * Update the data and variable
   * @param {Array<Object>} newData - New time-series data
   * @param {string} variable - Variable name
   */
  updateData(newData, variable) {
    this.data = newData;
    this.variable = variable;
    this.currentVariable = variable;
    this.progress = 0;
    this.initialXDomain = this.getInitialXDomain();
  }

  /**
   * Get data value at specific time
   * @param {Date} time - Time to query
   * @returns {number|null} Value at that time
   */
  getValueAtTime(time) {
    if (!this.data || !this.variable) return null;
    const point = this.data.find(d => d.Time.getTime() === time.getTime());
    return point ? point[this.variable] : null;
  }

  /**
   * Check if data is available
   * @returns {boolean} True if data exists
   */
  hasData() {
    return this.data && this.data.length > 0;
  }

  /**
   * Get data length
   * @returns {number} Number of data points
   */
  getDataLength() {
    return this.data ? this.data.length : 0;
  }
}
