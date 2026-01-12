/**
 * ITimelineAware - Interface for components that respond to timeline updates
 * This is a mixin interface (not extending IComponent)
 * Components can implement this to respond to timeline progress
 */

export class ITimelineAware {
  /**
   * Update component based on timeline progress
   * MUST be implemented by implementing class
   * @param {number} progress - Progress from 0 to 1
   * @param {Date} currentTime - Current time in data timeline
   */
  updateFlightTime(progress, currentTime) {
    throw new Error(`${this.constructor.name} must implement updateFlightTime(progress, currentTime)`);
  }
}

/**
 * Check if an object implements ITimelineAware
 * @param {Object} obj - Object to check
 * @returns {boolean} True if implements interface
 */
export function isTimelineAware(obj) {
  return obj && typeof obj.updateFlightTime === 'function';
}
