/**
 * ChartContainerManager - Manages dynamic chart container
 * Handles creating/destroying charts based on Redux state
 */

import { IComponent } from '../interfaces/IComponent.js';
import LineChartStore from './LineChartStore.js';
import {
  getVisibleChartCount,
  getChartConfigs
} from '../store/selectors/selectors.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';
import { debounce } from './shared/utils.js';

export default class ChartContainerManager extends IComponent {
  /**
   * @param {string} containerSelector - CSS selector for container element
   * @param {Store} store - Redux store instance
   * @param {string|null} pageContext - Page context ('dashboard' or 'realtime')
   */
  constructor(containerSelector, store, pageContext = null) {
    super(store, pageContext);

    this.containerSelector = containerSelector;
    this.container = document.querySelector(containerSelector);
    this.charts = new Map(); // chartIndex -> LineChartStore instance
    this.chartElements = new Map(); // chartIndex -> DOM element

    this.changeDetector = new StateChangeDetector({
      visibleCount: null
    });

    // Bind resize handler
    this.resizeHandler = debounce(() => this.handleResize(), 250);
    window.addEventListener('resize', this.resizeHandler);

    // Connect to store
    this.connect();

    // Initialize with current state
    this.onStateChange(this.getState());

    // Trigger resize after page fully loads to ensure correct dimensions
    if (document.readyState === 'complete') {
      setTimeout(() => this.handleResize(), 100);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.handleResize(), 100);
      });
    }

    console.log('[ChartContainerManager] Created');
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const visibleCount = getVisibleChartCount(state, this.pageContext);

    const changes = this.changeDetector.detectChanges({
      visibleCount
    });

    if (changes.visibleCount) {
      this.updateChartLayout(state);
      this.changeDetector.updateAll({
        visibleCount
      });
    }
  }

  /**
   * Update chart layout based on visible count
   */
  updateChartLayout(state) {
    const configs = getChartConfigs(state, this.pageContext);
    const visibleCount = getVisibleChartCount(state, this.pageContext);

    // Update container data attribute for CSS grid
    this.container.setAttribute('data-chart-count', visibleCount);

    // Determine which charts to show/hide/create
    const currentIndices = new Set(this.charts.keys());
    const neededIndices = new Set(configs.map(c => c.index));

    // Remove charts that are no longer visible
    currentIndices.forEach(index => {
      if (!neededIndices.has(index)) {
        this.removeChart(index);
      }
    });

    // Add or update charts that should be visible
    configs.forEach(config => {
      if (!this.charts.has(config.index)) {
        this.createChart(config);
      } else {
        this.updateChartVisibility(config.index, true);
        // Update showXLabel for existing charts
        const chart = this.charts.get(config.index);
        if (chart && chart.showXLabel !== config.showXLabel) {
          chart.showXLabel = config.showXLabel;
        }
      }

      // Update display order
      const element = this.chartElements.get(config.index);
      if (element) {
        element.style.order = config.index;
      }
    });

    // Trigger resize to recalculate dimensions after DOM settles
    // Use requestAnimationFrame + setTimeout to ensure CSS layout is complete
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.handleResize();
        // Second resize after a longer delay to catch any late layout shifts
        setTimeout(() => this.handleResize(), 200);
      }, 50);
    });

    console.log(`[ChartContainerManager] Updated layout: ${visibleCount} charts visible`);
  }

  /**
   * Create a new chart
   */
  createChart(config) {
    const { index, showXLabel } = config;

    // Create DOM element
    const chartDiv = document.createElement('div');
    chartDiv.id = `chart${index + 1}`;
    chartDiv.className = 'chart-item';
    chartDiv.style.order = index;

    this.container.appendChild(chartDiv);
    this.chartElements.set(index, chartDiv);

    // Create chart instance with page context
    const chart = new LineChartStore(
      `#chart${index + 1}`,
      this.store,
      index,
      showXLabel,
      this.pageContext
    );

    this.charts.set(index, chart);
    console.log(`[ChartContainerManager] Created chart ${index}`);
  }

  /**
   * Remove a chart
   */
  removeChart(index) {
    const chart = this.charts.get(index);
    if (chart) {
      chart.destroy();
      this.charts.delete(index);
    }

    const element = this.chartElements.get(index);
    if (element) {
      element.remove();
      this.chartElements.delete(index);
    }

    console.log(`[ChartContainerManager] Removed chart ${index}`);
  }

  /**
   * Update chart visibility
   */
  updateChartVisibility(index, visible) {
    const element = this.chartElements.get(index);
    if (element) {
      element.classList.toggle('chart-hidden', !visible);
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    this.charts.forEach(chart => {
      if (chart.onResize) {
        chart.onResize();
      }
    });
  }

  /**
   * Get all chart instances
   */
  getCharts() {
    return Array.from(this.charts.values());
  }

  /**
   * Cleanup
   */
  destroy() {
    window.removeEventListener('resize', this.resizeHandler);

    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();

    this.chartElements.forEach(element => element.remove());
    this.chartElements.clear();

    super.destroy();
    console.log('[ChartContainerManager] Destroyed');
  }
}
