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
    this.variables = variable ? [variable] : []; // All configured Y-axis variable keys
    this.currentVariable = null;
    this.progress = 0;
    this.initialXDomain = null;
    this._sortedIndex = null;   // Sorted index for fast non-time lookups
    this._sortedIndexKey = null;
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
   * Set all configured Y-axis variable keys (for multi-variable charts)
   * @param {Array<string>} variables - Array of variable keys
   */
  setVariables(variables) {
    this.variables = variables && variables.length ? variables : (this.variable ? [this.variable] : []);
  }

  /**
   * Check if a data point has a valid value for any configured variable
   * @param {Object} dataPoint - Data point to check
   * @returns {boolean} True if at least one variable has a valid finite number
   */
  hasValidData(dataPoint) {
    if (!dataPoint) return false;
    const vars = this.variables.length ? this.variables : (this.variable ? [this.variable] : []);
    return vars.some(v => {
      const val = dataPoint[v];
      return val !== null && val !== undefined && isFinite(val) && !isNaN(val);
    });
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
   * Build a value-sorted index for a variable key, enabling O(log n) lookups
   * in getClosestData for non-time axes. Call this whenever the x-axis
   * variable or data changes.
   * @param {string|null} key - Variable key to index (null clears the index)
   */
  buildSortedIndex(key) {
    if (!key || !this.data || this.data.length === 0) {
      this._sortedIndex = null;
      this._sortedIndexKey = null;
      return;
    }
    this._sortedIndex = this.data
      .map((d, i) => ({ value: d[key], idx: i }))
      .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value) && isFinite(item.value))
      .sort((a, b) => a.value - b.value);
    this._sortedIndexKey = key;
  }

  /**
   * Find the closest data point to a given X value
   * @param {Date|number} xValue - X value to search for
   * @param {Function} xScale - D3 scale function
   * @param {string|null} xKey - Data key for X axis (null for Time)
   * @returns {Object|null} Closest data point
   */
  getClosestData(xValue, xScale, xKey = null) {
    if (!this.data || this.data.length === 0) return null;

    const key = xKey || 'Time';

    // If using Time (sorted), use binary search
    if (key === 'Time') {
      const bisect = d3.bisector(d => d.Time).left;
      const index = bisect(this.data, xValue);

      const d0 = this.data[index - 1];
      const d1 = this.data[index];

      if (!d0) return d1;
      if (!d1) return d0;
      return (xValue - d0.Time > d1.Time - xValue) ? d1 : d0;
    }

    // Use sorted index for O(log n) lookup when available
    if (this._sortedIndex && this._sortedIndexKey === key) {
      const bisect = d3.bisector(d => d.value).left;
      const i = bisect(this._sortedIndex, xValue);
      const left = i > 0 ? this._sortedIndex[i - 1] : null;
      const right = i < this._sortedIndex.length ? this._sortedIndex[i] : null;
      if (!left) return right ? this.data[right.idx] : null;
      if (!right) return this.data[left.idx];
      return (xValue - left.value > right.value - xValue)
        ? this.data[right.idx]
        : this.data[left.idx];
    }

    // Fallback: linear scan (data is time-ordered, not sorted by this key)
    let closest = null;
    let minDiff = Infinity;
    this.data.forEach(d => {
      const v = d[key];
      if (v === null || v === undefined || isNaN(v) || !isFinite(v)) return;
      const diff = Math.abs(v - xValue);
      if (diff < minDiff) {
        minDiff = diff;
        closest = d;
      }
    });
    return closest;
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
