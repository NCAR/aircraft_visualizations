/**
 * RealtimePage.js - SPA Page Module
 * Refactored from realtime.js to support SPA lifecycle (init/destroy)
 */

// Import chart components
import LineChart from '../modules/LineChart.js';
import { setSelectedChart, SELCHART, removeLineCharts, CHARTS } from '../modules/LineChart.js';
import { loadData, updateChartVariable, loadPostgresData } from '../modules/loadData.js';
import { PROJECT } from '../modules/chartselect.js';
import FlightMap from '../modules/FlightMap.js';

/**
 * Initialize the Realtime page
 * @param {Object} store - Redux-like store instance
 * @param {Object} context - Context from PageManager
 * @returns {Object} Page instance with destroy method
 */
export async function init(store, context = {}) {
  console.log('[RealtimePage] Initializing');

  // Track components for cleanup
  const components = {
    charts: [],
    flightMap: null
  };
  const eventListeners = [];

  // ========================================
  // Load Data and Initialize Charts
  // ========================================

  try {
    const selectedVariables = ['temperature', 'pressure', 'humidity'];
    const parsedData = await loadPostgresData(selectedVariables);

    // Create charts
    components.charts.push(new LineChart("#chart1", "myVideo", parsedData, 'Temperature', false, false));
    components.charts.push(new LineChart("#chart2", "myVideo", parsedData, "Altitude", false, false));
    components.charts.push(new LineChart("#chart3", "myVideo", parsedData, "Wind Speed", false, false));
    components.charts.push(new LineChart("#chart4", "myVideo", parsedData, "Wind Direction", true, false));

    console.log('[RealtimePage] Charts initialized:', components.charts.length);

  } catch (error) {
    console.error('[RealtimePage] Error loading data:', error);
  }

  // ========================================
  // Chart Click Handlers
  // ========================================

  function handleChartClick(event) {
    const chartElement = event.currentTarget;
    const chartId = chartElement.id;
    console.log('[RealtimePage] Chart clicked:', chartId);

    // Extract chart index from id (e.g., 'chart1' -> 0)
    const match = chartId.match(/chart(\d+)/);
    if (match) {
      const chartIndex = parseInt(match[1], 10) - 1;
      setSelectedChart(chartIndex);
    }
  }

  document.querySelectorAll('.line-chart').forEach(chart => {
    const clickHandler = handleChartClick;
    const hoverHandler = () => {
      chart.style.cursor = 'pointer';
    };

    chart.addEventListener('click', clickHandler);
    chart.addEventListener('mouseover', hoverHandler);

    eventListeners.push({ element: chart, event: 'click', handler: clickHandler });
    eventListeners.push({ element: chart, event: 'mouseover', handler: hoverHandler });
  });

  console.log('[RealtimePage] Page initialization complete');

  // ========================================
  // Return Page Instance with Destroy Method
  // ========================================

  return {
    name: 'realtime',
    components,

    /**
     * Destroy the page - cleanup all resources
     */
    destroy() {
      console.log('[RealtimePage] Destroying page');

      // Remove all event listeners
      eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });

      // Destroy charts
      if (components.charts && components.charts.length > 0) {
        removeLineCharts();
        components.charts = [];
      }

      // Destroy map if initialized
      if (components.flightMap && components.flightMap.destroy) {
        components.flightMap.destroy();
      }

      console.log('[RealtimePage] Page destroyed');
    }
  };
}

export default init;
