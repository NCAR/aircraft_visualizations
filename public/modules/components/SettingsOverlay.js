/**
 * SettingsOverlay - Modal overlay for chart and visualization settings
 * Follows Redux-like store pattern and vanilla JS component architecture
 */

import { IComponent } from '../../interfaces/IComponent.js';
import { StateChangeDetector } from '../shared/StateChangeDetector.js';
import { setVisibleChartCount } from '../../store/actions/uiActions.js';
import { getVisibleChartCount } from '../../store/selectors/selectors.js';

export default class SettingsOverlay extends IComponent {
  constructor(store) {
    super(store);

    this.overlayElement = null;
    this.isOpen = false;

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      selectedChart: null,
      variables: null,
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
        <!-- Header -->
        <div class="settings-overlay-header">
          <div class="settings-title-group">
            <h2 class="settings-title">Settings</h2>
            <p class="settings-subtitle">Flight: RF01</p>
          </div>
          <button class="settings-close-btn" aria-label="Close settings">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Tabs Navigation -->
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
              <div class="plot-selector">
                <button class="plot-item plot-item-active" data-plot-index="0">Plot 1</button>
                <button class="plot-item" data-plot-index="1">Plot 2</button>
                <button class="plot-item" data-plot-index="2">Plot 3</button>
                <button class="plot-item" data-plot-index="3">Plot 4</button>
                <button class="plot-item" data-plot-index="4">Plot 5</button>
                <button class="plot-item" data-plot-index="5">Plot 6</button>
                <button class="plot-item" data-plot-index="6">Plot 7</button>
                <button class="plot-item" data-plot-index="7">Plot 8</button>
              </div>
              <p class="settings-hint">Select plot to make edits. Hidden plots are grayed out.</p>
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
              <div class="variables-table-container">
                <table class="variables-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Long Name</th>
                      <th>Category</th>
                      <th>Units</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- Variables populated by store -->
                  </tbody>
                </table>
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

    // Setup event listeners
    this.setupEventListeners();
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

    // Plot selector buttons
    const plotButtons = this.overlayElement.querySelectorAll('.plot-item');
    plotButtons.forEach(button => {
      button.addEventListener('click', () => {
        plotButtons.forEach(b => b.classList.remove('plot-item-active'));
        button.classList.add('plot-item-active');
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
  }

  /**
   * Update plot button visual states based on visibility
   */
  updatePlotButtonStates(visibleCount) {
    const plotButtons = this.overlayElement?.querySelectorAll('.plot-item');
    if (!plotButtons) return;

    plotButtons.forEach((btn, index) => {
      const isVisible = index < visibleCount;
      btn.classList.toggle('plot-item-visible', isVisible);
      btn.classList.toggle('plot-item-hidden', !isVisible);
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
