/**
 * FullscreenExpansion - Expands cards within the page flow
 * Not an overlay - pushes other content and expands in-place
 */

export class FullscreenExpansion {
  constructor() {
    this.activeCard = null;
    this.vizGrid = null;
    this.wasInDashboard = false;

    this.init();
  }

  init() {
    this.vizGrid = document.querySelector('.viz-grid');
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Delegate clicks so dynamically loaded buttons work
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.expand-btn');
      if (!btn) return;
      e.stopPropagation();
      const card = btn.closest('.viz-card');
      if (!card) return;
      if (this.activeCard === card) {
        this.close();
      } else {
        this.open(card);
      }
    });
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeCard) {
        this.close();
      }
    });
  }

  open(card) {
    if (this.activeCard) this.close();

    this.activeCard = card;
    // Lazily resolve viz-grid in case page content was injected after init
    if (!this.vizGrid) {
      this.vizGrid = card.closest('.viz-grid');
    }
    if (!this.vizGrid) return;

    // In dashboard mode, move the timeline to the footer so it shows at the bottom
    const pageEl = document.querySelector('.unified-page');
    this.wasInDashboard = pageEl?.dataset.mode === 'dashboard';
    if (this.wasInDashboard && window.relocateTimelineControls) {
      window.relocateTimelineControls('visualization');
    }

    // Lock body scroll and mark card as expanded
    document.body.classList.add('expansion-active');
    card.classList.add('expansion-active');

    // Toggle expand button to close state
    const expandBtn = card.querySelector('.expand-btn');
    if (expandBtn) {
      expandBtn.classList.add('is-expanded');
    }

    // Hide other cards
    this.vizGrid.querySelectorAll('.viz-card').forEach(c => {
      if (c !== card) {
        c.classList.add('expansion-hidden');
      }
    });

    // Resize content after browser paints
    requestAnimationFrame(() => {
      this.resizeContent();
      if (window.applyCardThemes) {
        requestAnimationFrame(window.applyCardThemes);
      }
    });

    console.log('[FullscreenExpansion] Expanded card');
  }

  close() {
    if (!this.activeCard) return;

    const card = this.activeCard;

    // Remove expanded state
    document.body.classList.remove('expansion-active');
    card.classList.remove('expansion-active');

    // Toggle expand button back to expand state
    const expandBtn = card.querySelector('.expand-btn');
    if (expandBtn) {
      expandBtn.classList.remove('is-expanded');
    }

    // Show other cards
    this.vizGrid.querySelectorAll('.viz-card').forEach(c => {
      c.classList.remove('expansion-hidden');
    });

    // If we were in dashboard mode, move the timeline back to the toolbar
    if (this.wasInDashboard && window.relocateTimelineControls) {
      window.relocateTimelineControls('dashboard');
      this.wasInDashboard = false;
    }

    this.activeCard = null;

    // Resize content after layout restores
    requestAnimationFrame(() => {
      this.resizeContent();
      if (window.applyCardThemes) {
        requestAnimationFrame(window.applyCardThemes);
      }
    });

    console.log('[FullscreenExpansion] Closed expansion');
  }

  resizeContent() {
    // Resize charts
    if (window.ALL_CHART_INSTANCES) {
      window.ALL_CHART_INSTANCES.forEach(chart => {
        if (chart.onResize) chart.onResize();
      });
    }
    
    // Resize map
    if (window.flightMap?.map) {
      window.flightMap.map.resize();
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.fullscreenExpansion = new FullscreenExpansion();
});