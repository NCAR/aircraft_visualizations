/**
 * Common utility functions used across modules
 */

/**
 * Debounce function - delays execution until after wait period of inactivity
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per wait period
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, wait) {
  let waiting = false;
  return function executedFunction(...args) {
    if (!waiting) {
      func(...args);
      waiting = true;
      setTimeout(() => {
        waiting = false;
      }, wait);
    }
  };
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Get axis label text with fallback logic
 * Resolves custom label override -> units -> variable name
 * @param {string|null} customLabel - Custom label from store (can be null/empty)
 * @param {string|null} units - Variable units
 * @param {string|null} variableName - Variable name as final fallback
 * @returns {string} Resolved label text
 */
export function getAxisLabelText(customLabel, units, variableName) {
  if (customLabel && typeof customLabel === 'string' && customLabel.trim()) {
    return customLabel;
  }
  if (units && typeof units === 'string' && units.trim()) {
    return units;
  }
  if (units && typeof units !== 'string') {
    return String(units);
  }
  return variableName || '';
}
