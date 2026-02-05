/**
 * ChartContainerManager - Manages dynamic chart container
 * Handles creating/destroying charts based on Redux state.
 * Chart creation is driven solely by visibleCount from ui.charts[page].
 * Individual chart rendering (variables, data) is handled by EChartStore
 * reading from ui.charts[page].configs.
 */

import { IComponent } from '../interfaces/IComponent.js';
// import EChartStore from './EChartStore.js';
import LineChartStore from './LineChartStore.js';
import { getVisibleChartCount } from '../store/selectors/selectors.js';
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
    // this.charts = new Map(); // chartIndex -> EChartStore instance
    this.chartElements = new Map(); // chartIndex -> DOM element

    this.changeDetector = new StateChangeDetector({
      visibleCount: null
    });

    // Bind resize handler for window resize events
    this.resizeHandler = debounce(() => this.handleResize(), 250);
    window.addEventListener('resize', this.resizeHandler);

    // Resize charts once the page layout is ready
    if (document.readyState === 'complete') {
      requestAnimationFrame(() => this.handleResize());
    } else {
      window.addEventListener('load', () => {
        requestAnimationFrame(() => this.handleResize());
      }, { once: true });
    }

    // Connect to store
    this.connect();

    // Initialize with current state
    this.onStateChange(this.getState());

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
      this.updateChartLayout(visibleCount);
      this.changeDetector.updateAll({
        visibleCount
      });
    }
  }

  /**
   * Update chart layout based on visible count.
   * Creates/removes charts for indices 0..visibleCount-1.
   * Each EChartStore reads its own variables from ui.charts configs.
   */
  updateChartLayout(visibleCount) {
    // Update container data attribute for CSS grid
    this.container.setAttribute('data-chart-count', visibleCount);

    // Determine which charts to show/hide/create
    const currentIndices = new Set(this.charts.keys());
    const neededIndices = new Set();
    for (let i = 0; i < visibleCount; i++) neededIndices.add(i);

    // Remove charts that are no longer visible
    currentIndices.forEach(index => {
      if (!neededIndices.has(index)) {
        this.removeChart(index);
      }
    });

    // Add or update charts that should be visible
    for (let i = 0; i < visibleCount; i++) {
      const showXLabel = true; // Always show x-axis labels on all charts

      if (!this.charts.has(i)) {
        this.createChart({ index: i, showXLabel });
      } else {
        this.updateChartVisibility(i, true);
        // Update showXLabel for existing charts
        const chart = this.charts.get(i);
        if (chart && chart.showXLabel !== showXLabel) {
          chart.showXLabel = showXLabel;
        }
      }

      // Update display order
      const element = this.chartElements.get(i);
      if (element) {
        element.style.order = i;
      }
    }

    // Resize after layout settles from adding/removing chart elements
    requestAnimationFrame(() => this.handleResize());
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
    // const chart = new EChartStore(
    //   chartDiv,
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
