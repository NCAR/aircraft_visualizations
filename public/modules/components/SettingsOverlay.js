/**
 * SettingsOverlay - Modal overlay for chart and visualization settings
 * Follows Redux-like store pattern and vanilla JS component architecture
 */

import { IComponent } from '../../interfaces/IComponent.js';
import { StateChangeDetector } from '../shared/StateChangeDetector.js';
import VariablesListTable from './VariablesListTable.js';
import { setVisibleChartCount } from '../../store/actions/uiActions.js';
import { selectChart, updateChartVariable } from '../../store/actions/selectionActions.js';
import { fetchFlightData } from '../../store/actions/dataActions.js';
import {
  getVisibleChartCount,
  getSelectedChartIndex,
  getChartVariable,
  getVariables,
  getCurrentFlightId
} from '../../store/selectors/selectors.js';

export default class SettingsOverlay extends IComponent {
  constructor(store) {
    super(store);

    this.overlayElement = null;
    this.isOpen = false;
    this.plotButtons = [];
    this.variablesTable = null;

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      selectedChart: null,
      visibleCount: null
    });

    // Create the overlay HTML
    this.createOverlay();

    // Connect to store
    this.connect();

    console.log('[SettingsOverlay] Created');
  }

  /**
   * Create settings overlay DOM structure
   */
  createOverlay() {
    // Create main overlay container
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'settings-overlay-container';
    this.overlayElement.setAttribute('id', 'settings-overlay');

    this.overlayElement.innerHTML = `
      <div class="settings-overlay-backdrop"></div>
      <div class="settings-overlay-content">
        <!-- Settings Icon (Left) -->
        <div class="settings-icon-badge">
          <i class="fas fa-cog"></i>
        </div>
        
        <!-- Close Button (Right) -->
        <button class="settings-close-btn" aria-label="Close settings">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <!-- Tabs Navigation (Header) -->
        <div class="settings-tabs">
          <button class="settings-tab settings-tab-active" data-tab="plots">
            <span>Plots</span>
          </button>
          <button class="settings-tab" data-tab="camera">
            <span>Camera Imagery</span>
            <svg class="tab-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button class="settings-tab" data-tab="map">
            <span>Map</span>
            <svg class="tab-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="settings-content">
          
          <!-- Plots Tab -->
          <div class="settings-tab-panel settings-tab-panel-active" data-panel="plots">
            <div class="settings-section">
              <h3 class="settings-section-title">Number of Plots:</h3>
              <div class="chart-count-controls">
                <button class="chart-count-btn" data-action="decrease" title="Fewer plots">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <span class="chart-count-display">4 plots</span>
                <button class="chart-count-btn" data-action="increase" title="More plots">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
              <p class="settings-hint">Adjust the number of visible plots (1-8).</p>
            </div>

            <div class="settings-section">
              <h3 class="settings-section-title">Select Plot:</h3>
              <div class="plot-selector" id="plot-selector-container">
                <!-- Plot buttons will be dynamically generated here -->
              </div>
              <p class="settings-hint">Select plot to edit.</p>
            </div>

            <div class="settings-section">
              <h3 class="settings-section-title">Edit Formatting</h3>
              <div class="formatting-buttons">
                <button class="format-btn">Gridlines</button>
                <button class="format-btn">Tick Marks</button>
                <button class="format-btn">Line Color</button>
              </div>
            </div>

            <div class="settings-section">
              <h3 class="settings-section-title">Axis Settings</h3>
              <div class="axis-buttons">
                <button class="axis-btn">Axis 1</button>
                <button class="axis-btn">Axis 2</button>
                <button class="axis-btn">Labels</button>
              </div>
            </div>

            <div class="settings-section">
              <h3 class="settings-section-title">Add/Remove Variables:</h3>
              <div class="variables-table-container" id="settings-variables-table-container">
                <!-- Variables table will be injected here -->
              </div>
            </div>

            <p class="settings-footer-text">
              Click here to navigate to the <strong>Dashboard View</strong> for more customization
            </p>
          </div>

          <!-- Camera Imagery Tab -->
          <div class="settings-tab-panel" data-panel="camera">
            <div class="settings-section">
              <h3 class="settings-section-title">Camera Settings</h3>
              <p class="settings-placeholder">Camera imagery settings coming soon</p>
            </div>
          </div>

          <!-- Map Tab -->
          <div class="settings-tab-panel" data-panel="map">
            <div class="settings-section">
              <h3 class="settings-section-title">Map Settings</h3>
              <p class="settings-placeholder">Map settings coming soon</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append to body
    document.body.appendChild(this.overlayElement);

    // Cache frequently used nodes - will be populated by generatePlotButtons
    this.plotButtons = [];

    // Create variables table component
    this.variablesTable = new VariablesListTable(this.store, {
      containerId: 'settings-variables-table-container',
      tableClass: 'variables-table',
      showCategory: true,
      showUnits: true,
      showActions: true,
      searchable: true,
      itemsPerPage: 5,
      scrollable: true
    });

    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize plot buttons with default count
    this.generatePlotButtons(4);
  }

  /**
   * Generate plot buttons dynamically based on visible count
   */
  generatePlotButtons(visibleCount) {
    const container = this.overlayElement?.querySelector('#plot-selector-container');
    if (!container) return;

    // Clear existing buttons
    container.innerHTML = '';

    // Create buttons for each visible plot
    for (let i = 0; i < visibleCount; i++) {
      const button = document.createElement('button');
      button.className = 'plot-item';
      button.setAttribute('data-plot-index', i);
      button.textContent = `Plot ${i + 1}`;
      
      button.addEventListener('click', () => {
        const plotIndex = parseInt(button.getAttribute('data-plot-index'), 10);
        if (Number.isInteger(plotIndex)) {
          this.dispatch(selectChart(plotIndex));
          // Update variables table to reflect the new selected chart
          if (this.variablesTable) {
            this.variablesTable.setSelectedChartIndex(plotIndex);
          }
        }
      });

      container.appendChild(button);
    }

    // Recache the plot buttons
    this.plotButtons = Array.from(this.overlayElement.querySelectorAll('.plot-item'));
    
    // Update active state based on current selection
    const state = this.getState();
    const selectedChart = getSelectedChartIndex(state);
    this.updateSelectedPlotButton(selectedChart);
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

    console.log('[SettingsOverlay] Event listeners setup');
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
        const current = getVisibleChartCount(state);
        if (current > 1) {
          this.dispatch(setVisibleChartCount(current - 1));
        }
      });
    }

    if (increaseBtn) {
      increaseBtn.addEventListener('click', () => {
        const state = this.getState();
        const current = getVisibleChartCount(state);
        if (current < 8) {
          this.dispatch(setVisibleChartCount(current + 1));
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
      btn.classList.remove('settings-tab-active');
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('settings-tab-active');
      }
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
    
    this.overlayElement.classList.add('settings-overlay-open');
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
    
    console.log('[SettingsOverlay] Opened');
  }

  /**
   * Close settings overlay
   */
  close() {
    if (!this.overlayElement) return;
    
    this.overlayElement.classList.remove('settings-overlay-open');
    this.isOpen = false;
    document.body.style.overflow = '';
    
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
   * Handle store state changes
   */
  onStateChange(state) {
    // Update subtitle with current flight
    const flightId = state.selection.flightId;
    const subtitle = this.overlayElement?.querySelector('.settings-subtitle');
    if (subtitle && flightId) {
      subtitle.textContent = `Flight: ${flightId}`;
    }

    // Update chart count display
    const visibleCount = getVisibleChartCount(state);
    const countDisplay = this.overlayElement?.querySelector('.chart-count-display');
    if (countDisplay) {
      countDisplay.textContent = `${visibleCount} plot${visibleCount !== 1 ? 's' : ''}`;
    }

    // Update plot button states
    this.updatePlotButtonStates(visibleCount);

    // Update button disabled states
    this.updateChartCountButtonStates(visibleCount);

    const selectedChart = getSelectedChartIndex(state);
    this.updateSelectedPlotButton(selectedChart);

    // Update variables table selected chart
    if (this.variablesTable) {
      this.variablesTable.setSelectedChartIndex(selectedChart);
    }

    this.changeDetector.updateAll({
      selectedChart,
      visibleCount
    });
  }

  /**
   * Update plot button visual states based on visibility
   */
  updatePlotButtonStates(visibleCount) {
    if (!this.plotButtons.length) return;

    // Regenerate buttons when visible count changes
    this.generatePlotButtons(visibleCount);
  }

  /**
   * Highlight the selected plot button
   */
  updateSelectedPlotButton(selectedChartIndex) {
    if (!this.plotButtons.length) return;
    this.plotButtons.forEach(btn => {
      const index = parseInt(btn.getAttribute('data-plot-index'), 10);
      const isActive = index === selectedChartIndex;
      btn.classList.toggle('plot-item-active', isActive);
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
    if (this.variablesTable) {
      this.variablesTable.destroy();
    }
    if (this.overlayElement) {
      this.overlayElement.remove();
    }
    super.destroy();
    console.log('[SettingsOverlay] Destroyed');
  }
}
