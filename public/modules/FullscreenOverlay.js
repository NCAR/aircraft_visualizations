/**
 * FullscreenExpansion - Expands cards within the page flow
 * Not an overlay - pushes other content and expands in-place
 */

export class FullscreenExpansion {
  constructor() {
    this.activeCard = null;
    this.vizGrid = null;
    
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
    
    // Add expanded state to grid and card
    this.vizGrid.classList.add('expansion-mode');
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
    
    // Scroll to top of viz-grid smoothly
    this.vizGrid.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'end',
      inline: 'nearest'
    });
    
    // Resize content after transition
    setTimeout(() => {
      this.resizeContent();
      // Update theme colors after expansion
      if (window.applyCardThemes) {
        requestAnimationFrame(window.applyCardThemes);
      }
    }, 350);
    
    console.log('[FullscreenExpansion] Expanded card');
  }

  close() {
    if (!this.activeCard) return;
    
    const card = this.activeCard;
    
    // Remove expanded state
    this.vizGrid.classList.remove('expansion-mode');
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
    
    // Resize content after transition completes
    setTimeout(() => {
      this.resizeContent();
      // Update theme colors after closing
      if (window.applyCardThemes) {
        requestAnimationFrame(window.applyCardThemes);
      }
    }, 350);
    
    this.activeCard = null;
    
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