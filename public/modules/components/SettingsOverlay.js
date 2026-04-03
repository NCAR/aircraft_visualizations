/**
 * SettingsOverlay - Modal overlay for chart and visualization settings
 * Follows Redux-like store pattern and vanilla JS component architecture
 */

import { IComponent } from '../../interfaces/IComponent.js';
import { StateChangeDetector } from '../shared/StateChangeDetector.js';
import { LAYER_CONFIG } from '../shared/constants.js';
import { setMapLayerVisibility, setChartXAxisVariable, timelinePause, timelinePlay } from '../../store/actions/uiActions.js';
import { fetchFlightData } from '../../store/actions/dataActions.js';
import { fetchRealtimeData } from '../../store/actions/realtimeActions.js';
import { selectChart } from '../../store/actions/selectionActions.js';
import * as types from '../../store/actions/actionTypes.js';
import {
  getVisibleChartCount,
  getSelectedChartIndex,
  getPageVariables,
  getMapLayers,
  getChartAxisLabel,
  getChartXAxisVariable,
  getChartVariablesWithColors,
  getSelectedVariables,
  isTimelinePlaying
} from '../../store/selectors/selectors.js';
import VariablesListTable from './VariablesListTable.js';

export default class SettingsOverlay extends IComponent {
  constructor(store, pageContext = 'dashboard') {
    super(store, pageContext);

    // pageContext is now stored in parent class via IComponent
    this.overlayElement = null;
    this.isOpen = false;
    this.plotButtons = [];
    this.variablesTable = null;
    this._creatingVariablesTable = false;
    this._wasPlayingOnOpen = false;

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      selectedChart: null,
      visibleCount: null
    });

    // Create the overlay HTML (async)
    this.init();

    console.log(`[SettingsOverlay] Created for page: ${this.pageContext}`);
  }

  /**
   * Get the current page ('dashboard' or 'realtime')
   */
  getCurrentPage() {
    // Use the page context this overlay was created for
    return this.pageContext;
  }

  /**
   * Initialize the overlay by loading HTML and setting up
   */
  async init() {
    await this.createOverlay();
    
    // Connect to store after overlay is created
    this.connect();

    // Render initial state once connected
    this.onStateChange(this.getState());
  }

  /**
   * Load settings overlay HTML template
   */
  async createOverlay() {
    try {
      const response = await fetch('modules/components/settings-overlay.html');
      const html = await response.text();
      
      const temp = document.createElement('div');
      temp.innerHTML = html;
      this.overlayElement = temp.firstElementChild;
      
      // Add page-specific class and data attribute for isolation
      this.overlayElement.classList.add(`settings-overlay-${this.pageContext}`);
      this.overlayElement.dataset.page = this.pageContext;

      // Make container IDs unique per page context to avoid collisions
      // when both dashboard and realtime overlays exist simultaneously
      const varsContainer = this.overlayElement.querySelector('#available-variables-table');
      if (varsContainer) {
        varsContainer.id = `available-variables-table-${this.pageContext}`;
      }

      // Append to body
      document.body.appendChild(this.overlayElement);

      // Cache frequently used nodes - will be populated by generatePlotButtons
      this.plotButtons = [];

      // Setup event listeners
      this.setupEventListeners();

      // Setup plot styling controls
      this.setupPlotStylingControls();

      // Initialize plot buttons with default count
      this.generatePlotButtons(4);

      // Initialize layer toggle buttons
      this.generateLayerToggles();

      // Render the variable table immediately after overlay is created
      this.renderAvailableVariablesTable(this.getState());
    } catch (error) {
      console.error(`[SettingsOverlay:${this.pageContext}] Failed to load template:`, error);
    }
  }

  /**
   * Generate plot buttons dynamically based on visible count
   */
  generatePlotButtons(visibleCount) {
    const container = this.overlayElement?.querySelector('#plot-selector-container');
    if (!container) return;

    const state = this.getState();

    // Clear existing buttons
    container.innerHTML = '';

    // Create buttons for each visible plot
    for (let i = 0; i < visibleCount; i++) {
      const vars = getChartVariablesWithColors(state, i, this.pageContext);
      const varCount = vars.length;
      const metaText = varCount === 0 ? 'empty' : `${varCount} variable${varCount !== 1 ? 's' : ''}`;

      const button = document.createElement('button');
      button.className = 'plot-item';
      button.setAttribute('data-plot-index', i);
      button.innerHTML = `
        <span class="plot-item-name">Plot ${i + 1}</span>
        <span class="plot-item-meta">${metaText}</span>
      `;

      button.addEventListener('click', () => {
        const plotIndex = parseInt(button.getAttribute('data-plot-index'), 10);
        if (Number.isInteger(plotIndex)) {
          this.dispatch(selectChart(plotIndex, this.pageContext));
        }
      });

      container.appendChild(button);
    }

    // Recache the plot buttons
    this.plotButtons = Array.from(this.overlayElement.querySelectorAll('.plot-item'));

    // Update active state based on current selection
    const selectedChart = getSelectedChartIndex(state, this.pageContext);
    this.updateSelectedPlotButton(selectedChart);
  }

  /**
   * Generate layer toggle buttons for the Map tab
   */
  generateLayerToggles() {
    const container = this.overlayElement?.querySelector('#layer-toggles-container');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Get current layer states from store
    const state = this.getState();
    const layers = getMapLayers(state);

    // Create a toggle button for each layer
    // On dashboard, only show NEXRAD (other layers are realtime-only)
    Object.entries(LAYER_CONFIG).forEach(([layerId, config]) => {
      // Skip layers that are hidden from UI
      if (config.hiddenFromUI) {
        return;
      }

      // On dashboard, only show NEXRAD toggle
      if (this.pageContext !== 'realtime' && layerId !== 'nexrad') {
        return;
      }

      const isActive = layers[layerId] || false;

      const toggleItem = document.createElement('div');
      toggleItem.className = 'layer-toggle-item';
      toggleItem.setAttribute('data-layer-id', layerId);

      toggleItem.innerHTML = `
        <div class="layer-toggle-info">
          <span class="layer-toggle-name">${config.name}</span>
          <span class="layer-toggle-description">${config.description}</span>
        </div>
        <button class="layer-toggle-btn ${isActive ? 'layer-toggle-active' : ''}"
                data-layer-id="${layerId}"
                aria-pressed="${isActive}"
                title="Toggle ${config.name}">
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </button>
      `;

      // Add click handler to the toggle button
      const toggleBtn = toggleItem.querySelector('.layer-toggle-btn');
      toggleBtn.addEventListener('click', () => {
        const currentState = toggleBtn.classList.contains('layer-toggle-active');
        this.dispatch(setMapLayerVisibility(layerId, !currentState));
      });

      container.appendChild(toggleItem);
    });

    console.log('[SettingsOverlay] Layer toggles generated');
  }

  /**
   * Update layer toggle button states based on store
   * @param {Object} layers - Map of layerId to visibility boolean
   */
  updateLayerToggleStates(layers) {
    const container = this.overlayElement?.querySelector('#layer-toggles-container');
    if (!container) return;

    Object.entries(layers).forEach(([layerId, visible]) => {
      const toggleBtn = container.querySelector(`.layer-toggle-btn[data-layer-id="${layerId}"]`);
      if (toggleBtn) {
        toggleBtn.classList.toggle('layer-toggle-active', visible);
        toggleBtn.setAttribute('aria-pressed', visible);
      }
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Close button
    const closeBtn = this.overlayElement.querySelector('.settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click
    const backdrop = this.overlayElement.querySelector('.settings-overlay-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.close());
    }

    // Tab buttons
    const tabButtons = this.overlayElement.querySelectorAll('.settings-tab');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = button.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // Chart count controls
    this.setupChartCountControls();

    // Refresh preview snapshot when the details element is opened
    const previewDetails = this.overlayElement.querySelector('#plot-preview-details');
    if (previewDetails) {
      previewDetails.addEventListener('toggle', () => {
        if (previewDetails.open) {
          const state = this.getState();
          const chartIndex = getSelectedChartIndex(state, this.pageContext);
          this.updatePlotPreview(chartIndex);
        }
      });
    }

    console.log('[SettingsOverlay] Event listeners setup');
  }

  /**
   * Setup plot styling controls: clear button, label inputs, search
   */
  setupPlotStylingControls() {
    const clearBtn = this.overlayElement.querySelector('#plot-clear-btn');
    const leftLabelInput = this.overlayElement.querySelector('#plot-left-axis-label');
    const rightLabelInput = this.overlayElement.querySelector('#plot-right-axis-label');
    // Clear chart config
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const state = this.getState();
        const chartIndex = getSelectedChartIndex(state, this.pageContext);
        this.dispatch({
          type: types.CLEAR_CHART_CONFIG,
          payload: { chartIndex, page: this.pageContext }
        });
      });
    }

    // Axis label inputs
    if (leftLabelInput) {
      leftLabelInput.addEventListener('change', () => {
        const state = this.getState();
        const chartIndex = getSelectedChartIndex(state, this.pageContext);
        this.dispatch({
          type: types.SET_CHART_AXIS_LABEL,
          payload: { chartIndex, axis: 'left', label: leftLabelInput.value, page: this.pageContext }
        });
      });
    }
    if (rightLabelInput) {
      rightLabelInput.addEventListener('change', () => {
        const state = this.getState();
        const chartIndex = getSelectedChartIndex(state, this.pageContext);
        this.dispatch({
          type: types.SET_CHART_AXIS_LABEL,
          payload: { chartIndex, axis: 'right', label: rightLabelInput.value, page: this.pageContext }
        });
      });
    }

    // Search is handled by VariablesListTable internally (searchable: true)
  }

  /**
   * Render the available variables table with search filtering
   */
  renderAvailableVariablesTable(state) {
    const containerId = `available-variables-table-${this.pageContext}`;
    const container = this.overlayElement.querySelector(`#${containerId}`);
    if (!container) return;

    // Guard against re-entrant creation (constructor dispatch can trigger onStateChange)
    if (this._creatingVariablesTable) return;

    // Only instantiate VariablesListTable once
    if (!this.variablesTable) {
      const chartIndex = getSelectedChartIndex(state, this.pageContext);
      this._creatingVariablesTable = true;
      this.variablesTable = new VariablesListTable(this.store, {
        containerId,
        tableClass: 'available-variables-table',
        showCategory: true,
        showUnits: true,
        showActions: true,
        searchable: true,
        selectedChartIndex: chartIndex,
        pageContext: this.pageContext,
        itemsPerPage: 10,
        scrollable: true,
        onVariableSelect: (variableCleanName, chartIdx, state) => {
          const page = this.pageContext;
          // Add the variable to the chart
          this.dispatch({
            type: types.ADD_CHART_VARIABLE,
            payload: { chartIndex: chartIdx, variableKey: variableCleanName, axis: 'left', page }
          });

          if (page === 'realtime') {
            // Refetch realtime data to include the new variable's column
            this.dispatch(fetchRealtimeData());
          } else {
            // Fetch dashboard flight data for the variable if not already loaded
            const flightId = state.selection.flightId;
            const flightData = state.data.flightData[flightId];
            const alreadyLoaded = flightData?.loadedVariables?.has(variableCleanName);
            if (flightId && !alreadyLoaded) {
              this.dispatch(fetchFlightData(flightId, [variableCleanName]));
            }
          }
        }
      });
      this._creatingVariablesTable = false;
    } else {
      // Update chart index if changed (store subscription handles onStateChange)
      const chartIndex = getSelectedChartIndex(state, this.pageContext);
      this.variablesTable.setSelectedChartIndex(chartIndex);
    }
  }

  /**
   * Setup chart count control handlers
   */
  setupChartCountControls() {
    const decreaseBtn = this.overlayElement.querySelector('[data-action="decrease"]');
    const increaseBtn = this.overlayElement.querySelector('[data-action="increase"]');

    if (decreaseBtn) {
      decreaseBtn.addEventListener('click', () => {
        const state = this.getState();
        const current = getVisibleChartCount(state, this.pageContext);
        if (current > 1) {
          this.dispatch({
            type: types.SET_VISIBLE_CHART_COUNT,
            payload: { count: current - 1, page: this.pageContext }
          });
        }
      });
    }

    if (increaseBtn) {
      increaseBtn.addEventListener('click', () => {
        const state = this.getState();
        const current = getVisibleChartCount(state, this.pageContext);
        if (current < 8) {
          this.dispatch({
            type: types.SET_VISIBLE_CHART_COUNT,
            payload: { count: current + 1, page: this.pageContext }
          });
        }
      });
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update active tab button
    const tabButtons = this.overlayElement.querySelectorAll('.settings-tab');
    tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('settings-tab-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update active panel
    const panels = this.overlayElement.querySelectorAll('.settings-tab-panel');
    panels.forEach(panel => {
      panel.classList.remove('settings-tab-panel-active');
      if (panel.getAttribute('data-panel') === tabName) {
        panel.classList.add('settings-tab-panel-active');
      }
    });

    console.log('[SettingsOverlay] Switched to tab:', tabName);
  }

  /**
   * Open settings overlay
   */
  open() {
    if (!this.overlayElement) return;

    const state = this.getState();
    this._wasPlayingOnOpen = isTimelinePlaying(state);
    if (this._wasPlayingOnOpen) {
      this.dispatch(timelinePause());
    }

    this.overlayElement.classList.add('settings-overlay-open');
    this.isOpen = true;

    // Force full UI render — while the overlay was closed, onStateChange
    // tracked values without updating the DOM, so the change detector
    // considers everything up-to-date.  Reset it so the next call
    // re-renders plot buttons, plot styling, and the variables table.
    this.changeDetector.reset({ selectedChart: null, visibleCount: null });
    this.onStateChange(this.getState());

    console.log('[SettingsOverlay] Opened');
  }

  /**
   * Close settings overlay
   */
  close() {
    if (!this.overlayElement) return;
    
    this.overlayElement.classList.remove('settings-overlay-open');
    this.isOpen = false;

    if (this._wasPlayingOnOpen) {
      this.dispatch(timelinePlay());
    }
    this._wasPlayingOnOpen = false;
    
    console.log('[SettingsOverlay] Closed');
  }

  /**
   * Toggle settings overlay
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Handle store state changes.
   * Skips expensive DOM updates when the overlay is closed.
   */
  onStateChange(state) {
    if (!this.overlayElement) return;

    const visibleCount = getVisibleChartCount(state, this.pageContext);
    const selectedChart = getSelectedChartIndex(state, this.pageContext);

    const changes = this.changeDetector.detectChanges({
      selectedChart,
      visibleCount
    });

    // Skip all DOM work when overlay is closed — only track state
    if (!this.isOpen) {
      this.changeDetector.updateAll({ selectedChart, visibleCount });
      return;
    }

    // Update subtitle with current flight
    const flightId = state.selection.flightId;
    const subtitle = this.overlayElement.querySelector('.settings-subtitle');
    if (subtitle && flightId) {
      subtitle.textContent = `Flight: ${flightId}`;
    }

    // Update chart count display
    const countDisplay = this.overlayElement.querySelector('.chart-count-display');
    if (countDisplay) {
      countDisplay.textContent = `${visibleCount}`;
    }

    // Only regenerate plot buttons when visible count actually changed
    if (changes.visibleCount) {
      this.generatePlotButtons(visibleCount);
      this.updateChartCountButtonStates(visibleCount);
    }

    if (changes.selectedChart || changes.visibleCount) {
      this.updateSelectedPlotButton(selectedChart);
    }

    // Update layer toggle states
    const layers = getMapLayers(state);
    this.updateLayerToggleStates(layers);

    // Refresh variable count badges on plot buttons (variables may have changed)
    this.refreshPlotButtonMetas(state);

    // Render plot styling config UI (current variables list)
    this.renderPlotStyling(state);

    // Render available variables table
    this.renderAvailableVariablesTable(state);

    this.changeDetector.updateAll({ selectedChart, visibleCount });
  }

  /**
   * Render plot styling labels and variables list from store config
   */
  renderPlotStyling(state) {
    const chartIndex = getSelectedChartIndex(state, this.pageContext);
    const leftLabel = getChartAxisLabel(state, chartIndex, 'left', this.pageContext);
    const rightLabel = getChartAxisLabel(state, chartIndex, 'right', this.pageContext);
    const xAxisKey = getChartXAxisVariable(state, chartIndex, this.pageContext);

    // Update axis label inputs
    const leftLabelInput = this.overlayElement.querySelector('#plot-left-axis-label');
    const rightLabelInput = this.overlayElement.querySelector('#plot-right-axis-label');
    if (leftLabelInput) leftLabelInput.value = leftLabel || '';
    if (rightLabelInput) rightLabelInput.value = rightLabel || '';

    // Render current variables list
    this.renderCurrentVariablesList(state, chartIndex, xAxisKey);

    // Refresh preview snapshot (chart may have re-rendered with new variables)
    this.updatePlotPreview(chartIndex);
  }

  /**
   * Render the current variables list with colors and controls
   */
  renderCurrentVariablesList(state, chartIndex, xAxisKey) {
    const container = this.overlayElement.querySelector('#current-variables-list');
    if (!container) return;

    const variables = getChartVariablesWithColors(state, chartIndex, this.pageContext);
    const allVars = getPageVariables(state, this.pageContext);
    const selectedVars = getSelectedVariables(state, this.pageContext);
    const defaultVar = selectedVars[chartIndex];

    // Clear container
    container.innerHTML = '';

    // If chart config is empty but selectedVariables has a default, show it
    if (variables.length === 0 && defaultVar) {
      const meta = allVars.find(m => m.clean_name === defaultVar);
      const displayName = meta?.long_name || defaultVar;
      const units = meta?.units || '';
      const item = document.createElement('div');
      item.className = 'variable-item';
      item.setAttribute('data-key', defaultVar);
      const isXActive = xAxisKey === defaultVar;
      item.innerHTML = `
        <div class="variable-color-swatch" style="background-color: #666"></div>
        <div class="variable-info">
          <span class="variable-name">${displayName}</span>
          <span class="variable-units">${units ? `(${units})` : ''}</span>
        </div>
        <div class="variable-axis-toggle">
          <button class="axis-toggle-btn active${isXActive ? ' axis-toggle-btn--disabled' : ''}" data-axis="left" data-key="${defaultVar}" ${isXActive ? 'disabled' : ''}>L</button>
          <button class="axis-toggle-btn${isXActive ? ' axis-toggle-btn--disabled' : ''}" data-axis="right" data-key="${defaultVar}" ${isXActive ? 'disabled' : ''}>R</button>
          <button class="x-axis-toggle-btn ${isXActive ? 'active' : ''}" data-key="${defaultVar}" style="display:none">X</button>
        </div>
        <button class="variable-remove-btn" data-key="${defaultVar}" title="Remove variable">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      container.appendChild(item);
      this.attachVariableListHandlers(container, chartIndex);
      return;
    }

    if (variables.length === 0) {
      container.innerHTML = '<p class="no-variables-message">No variables added. Use the controls above to add variables to this plot.</p>';
      return;
    }

    // Create list of variables
    const list = document.createElement('div');
    list.className = 'variables-list';

    variables.forEach((v, index) => {
      // Get variable metadata for display
      const meta = allVars.find(m => m.clean_name === v.key);
      const displayName = meta?.long_name || v.key;
      const units = meta?.units || '';

      const item = document.createElement('div');
      item.className = 'variable-item';
      item.setAttribute('data-key', v.key);

      const isXActive = xAxisKey === v.key;
      item.innerHTML = `
        <div class="variable-color-swatch" style="background-color: ${v.color || '#666'}"></div>
        <div class="variable-info">
          <span class="variable-name">${displayName}</span>
          <span class="variable-units">${units ? `(${units})` : ''}</span>
        </div>
        <div class="variable-axis-toggle">
          <button class="axis-toggle-btn ${v.axis === 'left' ? 'active' : ''}${isXActive ? ' axis-toggle-btn--disabled' : ''}" data-axis="left" data-key="${v.key}" ${isXActive ? 'disabled' : ''}>L</button>
          <button class="axis-toggle-btn ${v.axis === 'right' ? 'active' : ''}${isXActive ? ' axis-toggle-btn--disabled' : ''}" data-axis="right" data-key="${v.key}" ${isXActive ? 'disabled' : ''}>R</button>
          <button class="x-axis-toggle-btn ${isXActive ? 'active' : ''}" data-key="${v.key}" style="display:none">X</button>
        </div>
        <button class="variable-remove-btn" data-key="${v.key}" title="Remove variable">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      list.appendChild(item);
    });

    container.appendChild(list);

    // Attach event handlers for axis toggle and remove buttons
    this.attachVariableListHandlers(container, chartIndex);
  }

  /**
   * Attach event handlers for the variables list
   */
  attachVariableListHandlers(container, chartIndex) {
    // Axis toggle buttons
    container.querySelectorAll('.axis-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (btn.disabled) return;
        const key = btn.getAttribute('data-key');
        const axis = btn.getAttribute('data-axis');
        if (key && axis) {
          this.dispatch({
            type: types.MOVE_CHART_VARIABLE_AXIS,
            payload: { chartIndex, variableKey: key, axis, page: this.pageContext }
          });
        }
      });
    });

    // Remove buttons
    container.querySelectorAll('.variable-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = btn.getAttribute('data-key');
        if (key) {
          const state = this.getState();
          const xAxisKey = getChartXAxisVariable(state, chartIndex, this.pageContext);
          if (xAxisKey === key) {
            this.dispatch(setChartXAxisVariable(chartIndex, null, this.pageContext));
          }
          this.dispatch({
            type: types.REMOVE_CHART_VARIABLE,
            payload: { chartIndex, variableKey: key, page: this.pageContext }
          });
        }
      });
    });

    // X-axis toggle buttons
    container.querySelectorAll('.x-axis-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        if (!key) return;

        const state = this.getState();
        const current = getChartXAxisVariable(state, chartIndex, this.pageContext);
        const nextKey = current === key ? null : key;
        this.dispatch(setChartXAxisVariable(chartIndex, nextKey, this.pageContext));

        if (nextKey) {
          if (this.pageContext === 'realtime') {
            this.dispatch(fetchRealtimeData());
          } else {
            const flightId = state.selection.flightId;
            const flightData = state.data.flightData[flightId];
            const alreadyLoaded = flightData?.loadedVariables?.has(nextKey);
            if (flightId && !alreadyLoaded) {
              this.dispatch(fetchFlightData(flightId, [nextKey]));
            }
          }
        }
      });
    });
  }

  // Plot button regeneration is now handled directly in onStateChange
  // only when visibleCount changes, avoiding unnecessary DOM rebuilds.

  /**
   * Highlight the selected plot button and refresh the preview
   */
  updateSelectedPlotButton(selectedChartIndex) {
    if (!this.plotButtons.length) return;
    this.plotButtons.forEach(btn => {
      const index = parseInt(btn.getAttribute('data-plot-index'), 10);
      const isActive = index === selectedChartIndex;
      btn.classList.toggle('plot-item-active', isActive);
    });
    this.updatePlotPreview(selectedChartIndex);
  }

  /**
   * Update the plot preview thumbnail for the selected chart index
   */
  updatePlotPreview(selectedChartIndex) {
    const previewDetails = this.overlayElement?.querySelector('#plot-preview-details');
    if (!previewDetails?.open) return;
    const previewContainer = this.overlayElement?.querySelector('#plot-preview');
    if (!previewContainer) return;

    if (selectedChartIndex === null || selectedChartIndex === undefined) {
      previewContainer.innerHTML = `
        <div class="plot-preview-placeholder">
          <span class="plot-preview-placeholder-text">Select a plot above to preview</span>
        </div>`;
      return;
    }

    const canvas = document.querySelector(`#chart${selectedChartIndex + 1} canvas.chart-canvas`);
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      previewContainer.innerHTML = `
        <div class="plot-preview-placeholder">
          <span class="plot-preview-placeholder-text">Plot ${selectedChartIndex + 1} — no data to preview</span>
        </div>`;
      return;
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      previewContainer.innerHTML = `<img src="${dataUrl}" alt="Preview of Plot ${selectedChartIndex + 1}">`;
    } catch (e) {
      previewContainer.innerHTML = `
        <div class="plot-preview-placeholder">
          <span class="plot-preview-placeholder-text">Preview unavailable</span>
        </div>`;
    }
  }

  /**
   * Update variable count badges on plot buttons without rebuilding them
   */
  refreshPlotButtonMetas(state) {
    this.plotButtons.forEach(btn => {
      const index = parseInt(btn.getAttribute('data-plot-index'), 10);
      if (!Number.isInteger(index)) return;
      const vars = getChartVariablesWithColors(state, index, this.pageContext);
      const varCount = vars.length;
      const metaText = varCount === 0 ? 'empty' : `${varCount} variable${varCount !== 1 ? 's' : ''}`;
      const meta = btn.querySelector('.plot-item-meta');
      if (meta) meta.textContent = metaText;
    });
  }

  /**
   * Update +/- button disabled states
   */
  updateChartCountButtonStates(visibleCount) {
    const decreaseBtn = this.overlayElement?.querySelector('[data-action="decrease"]');
    const increaseBtn = this.overlayElement?.querySelector('[data-action="increase"]');

    if (decreaseBtn) {
      decreaseBtn.disabled = visibleCount <= 1;
      decreaseBtn.classList.toggle('btn-disabled', visibleCount <= 1);
    }

    if (increaseBtn) {
      increaseBtn.disabled = visibleCount >= 8;
      increaseBtn.classList.toggle('btn-disabled', visibleCount >= 8);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.overlayElement) {
      this.overlayElement.remove();
    }
    super.destroy();
    console.log('[SettingsOverlay] Destroyed');
  }
}
