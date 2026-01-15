/**
 * FullscreenExpansion - Expands cards within the page flow
 * Not an overlay - pushes other content and expands in-place
 */

export class FullscreenExpansion {
  constructor() {
    this.activeCard = null;
    this.vizGrid = null;
    this.closeButton = null;
    
    this.init();
  }

  init() {
    this.vizGrid = document.querySelector('.viz-grid');
    this.createCloseButton();
    this.attachEventListeners();
  }

  createCloseButton() {
    // Create close button (will be positioned inside the expanded card)
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'expansion-close-btn';
    this.closeButton.setAttribute('aria-label', 'Close expanded view');
    this.closeButton.innerHTML = '✕';
    this.closeButton.style.display = 'none';
  }

  attachEventListeners() {
    // Close button click
    this.closeButton.addEventListener('click', () => this.close());
    
    // Expand buttons
    document.querySelectorAll('.expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.viz-card');
        if (card) {
          if (this.activeCard === card) {
            this.close();
          } else {
            this.open(card);
          }
        }
      });
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
    
    // Add expanded state to grid and card
    this.vizGrid.classList.add('expansion-mode');
    card.classList.add('expansion-active');
    
    // Hide other cards
    this.vizGrid.querySelectorAll('.viz-card').forEach(c => {
      if (c !== card) {
        c.classList.add('expansion-hidden');
      }
    });
    
    // Add close button to card header
    const cardHeader = card.querySelector('.card-header');
    if (cardHeader) {
      cardHeader.appendChild(this.closeButton);
      this.closeButton.style.display = 'flex';
    }
    
    // Scroll to top of viz-grid smoothly
    this.vizGrid.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'end',
      inline: 'nearest'
    });
    
    // Resize content after transition
    setTimeout(() => this.resizeContent(), 350);
    
    console.log('[FullscreenExpansion] Expanded card');
  }

  close() {
    if (!this.activeCard) return;
    
    const card = this.activeCard;
    
    // Remove expanded state
    this.vizGrid.classList.remove('expansion-mode');
    card.classList.remove('expansion-active');
    
    // Show other cards
    this.vizGrid.querySelectorAll('.viz-card').forEach(c => {
      c.classList.remove('expansion-hidden');
    });
    
    // Hide close button
    this.closeButton.style.display = 'none';
    
    // Resize content after transition completes
    setTimeout(() => this.resizeContent(), 350);
    
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
      window.flightMap.map.invalidateSize();
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.fullscreenExpansion = new FullscreenExpansion();
});