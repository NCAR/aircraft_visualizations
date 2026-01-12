/**
 * IChart - Interface for chart components
 * Extends IComponent with chart-specific methods
 */

import { IComponent } from './IComponent.js';

export class IChart extends IComponent {
  /**
   * @param {Store} store - Store instance
   * @param {number} chartIndex - Chart index (0-3)
   */
  constructor(store, chartIndex) {
    super(store);

    if (typeof chartIndex !== 'number' || chartIndex < 0 || chartIndex > 3) {
      throw new Error('Chart index must be a number between 0 and 3');
    }

    this.chartIndex = chartIndex;
  }

  /**
   * Update chart with new data
   * MUST be implemented by subclass
   * @param {Array} data - Timeseries data
   * @param {string} variable - Variable to display
   */
  updateData(data, variable) {
    throw new Error(`${this.constructor.name} must implement updateData(data, variable)`);
  }

  /**
   * Update chart progress (for timeline animation)
   * MUST be implemented by subclass
   * @param {number} progress - Progress from 0 to 1
   */
  updateProgress(progress) {
    throw new Error(`${this.constructor.name} must implement updateProgress(progress)`);
  }

  /**
   * Update zoom domain
   * SHOULD be implemented by subclass
   * @param {Array<Date>} domain - [startDate, endDate]
   */
  updateZoom(domain) {
    // Optional - subclass can override
    console.warn(`${this.constructor.name} does not implement updateZoom`);
  }

  /**
   * Reset zoom to initial domain
   * SHOULD be implemented by subclass
   */
  resetZoom() {
    // Optional - subclass can override
    console.warn(`${this.constructor.name} does not implement resetZoom`);
  }
}
