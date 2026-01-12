/**
 * StateChangeDetector - Utility class for tracking state changes
 * Eliminates repetitive prev-value tracking boilerplate across components
 * 
 * @example
 * // Instead of:
 * this.prevFlightId = null;
 * this.prevVariable = null;
 * if (flightId !== this.prevFlightId || variable !== this.prevVariable) {
 *   this.prevFlightId = flightId;
 *   this.prevVariable = variable;
 * }
 * 
 * // Use:
 * this.changeDetector = new StateChangeDetector({ flightId: null, variable: null });
 * const changes = this.changeDetector.detectChanges({ flightId, variable });
 * if (changes.flightId || changes.variable) {
 *   this.changeDetector.updateAll({ flightId, variable });
 * }
 */
export class StateChangeDetector {
  /**
   * @param {Object} initialState - Initial state values to track
   */
  constructor(initialState = {}) {
    this.prev = { ...initialState };
  }

  /**
   * Check if a single value has changed
   * @param {string} key - State key to check
   * @param {*} value - New value to compare
   * @returns {boolean} True if value changed
   */
  hasChanged(key, value) {
    return this.prev[key] !== value;
  }

  /**
   * Detect changes for multiple keys
   * @param {Object} newValues - Object with new values { key: value, ... }
   * @returns {Object} Object with change flags { key: boolean, ... }
   * 
   * @example
   * const changes = detector.detectChanges({ flightId: 123, variable: 'atx' });
   * // Returns: { flightId: true, variable: false }
   */
  detectChanges(newValues) {
    const changes = {};
    for (const key in newValues) {
      changes[key] = this.prev[key] !== newValues[key];
    }
    return changes;
  }

  /**
   * Check if any value in the set has changed
   * @param {Object} newValues - Object with new values
   * @returns {boolean} True if any value changed
   */
  hasAnyChanged(newValues) {
    for (const key in newValues) {
      if (this.prev[key] !== newValues[key]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update a single tracked value
   * @param {string} key - Key to update
   * @param {*} value - New value
   */
  update(key, value) {
    this.prev[key] = value;
  }

  /**
   * Update multiple tracked values at once
   * @param {Object} updates - Object with updates { key: value, ... }
   */
  updateAll(updates) {
    Object.assign(this.prev, updates);
  }

  /**
   * Get current stored value
   * @param {string} key - Key to retrieve
   * @returns {*} Stored value
   */
  get(key) {
    return this.prev[key];
  }

  /**
   * Reset all tracked values to initial state
   * @param {Object} initialState - New initial state (optional)
   */
  reset(initialState = {}) {
    this.prev = { ...initialState };
  }
}
