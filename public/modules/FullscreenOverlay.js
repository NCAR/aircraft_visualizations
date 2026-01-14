/**
 * FullscreenOverlay - Handles fullscreen expansion of cards
 * Moves the actual card into an overlay modal with smooth transitions
 */

export class FullscreenOverlay {
  constructor() {
    this.currentExpandedCard = null;
    this.originalParent = null;
    this.originalNextSibling = null;
    this.overlay = null;
    this.overlayContent = null;
    
    this.init();
    console.log('[FullscreenOverlay] Initialized');
  }

  /**
   * Initialize the overlay and event listeners
   */
  init() {
    // Create overlay element (background dimmer)
    this.overlay = document.createElement('div');
    this.overlay.className = 'fullscreen-overlay';
    this.overlay.id = 'fullscreen-overlay';
    
    // Create content container
    this.overlayContent = document.createElement('div');
    this.overlayContent.className = 'fullscreen-overlay-content';
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullscreen-overlay-close';
    closeBtn.setAttribute('aria-label', 'Close fullscreen');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
    
    this.overlayContent.appendChild(closeBtn);
    this.overlay.appendChild(this.overlayContent);
    document.body.appendChild(this.overlay);
    
    // Close on overlay background click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.close();
      }
    });
    
    // Setup expand buttons
    this.setupExpandButtons();
  }

  /**
   * Setup event listeners for all expand buttons
   */
  setupExpandButtons() {
    const expandButtons = document.querySelectorAll('.expand-btn.expand-overlay');
    
    expandButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.viz-card');
        if (card) {
          this.open(card);
        }
      });
    });
    
    console.log(`[FullscreenOverlay] Setup ${expandButtons.length} expand buttons`);
  }

  /**
   * Open fullscreen overlay with card
   * Moves the actual card element into the overlay
   * @param {HTMLElement} card - The card element to expand
   */
  open(card) {
    if (this.currentExpandedCard === card) {
      return; // Already open
    }

    // Store original parent and position
    this.originalParent = card.parentElement;
    this.originalNextSibling = card.nextSibling;
    
    // Move card into overlay (not clone - actual element)
    const closeBtn = this.overlayContent.querySelector('.fullscreen-overlay-close');
    this.overlayContent.innerHTML = '';
    this.overlayContent.appendChild(closeBtn);
    this.overlayContent.appendChild(card);
    
    this.currentExpandedCard = card;
    
    // Show overlay with transition
    this.overlay.classList.add('active');
    card.classList.add('fullscreen-card');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Get card title for accessibility
    const cardTitle = card.querySelector('.card-title');
    const title = cardTitle ? cardTitle.textContent : 'Expanded View';
    this.overlayContent.setAttribute('aria-label', `Fullscreen ${title}`);
    
    // Trigger chart resize after overlay transition completes
    setTimeout(() => {
      // Trigger onResize for all chart instances
      if (window.ALL_CHART_INSTANCES && Array.isArray(window.ALL_CHART_INSTANCES)) {
        window.ALL_CHART_INSTANCES.forEach(chart => {
          if (typeof chart.onResize === 'function') {
            chart.onResize();
          }
        });
        console.log('[FullscreenOverlay] Called onResize for all charts');
      }
      
      // Trigger map reload if this is the map card
      if (card.classList.contains('map-card')) {
        if (window.flightMap && window.flightMap.map) {
          window.flightMap.map.invalidateSize();
          console.log('[FullscreenOverlay] Called invalidateSize() on Leaflet map');
        }
      }
    }, 350); // Wait for transition to complete
    
    console.log('[FullscreenOverlay] Opened:', title);
  }

  /**
   * Close the fullscreen overlay
   * Moves the card back to its original position
   */
  close() {
    if (!this.overlay.classList.contains('active')) {
      return;
    }

    const card = this.currentExpandedCard;
    if (!card || !this.originalParent) {
      return;
    }

    // Move card back to original position
    if (this.originalNextSibling) {
      this.originalParent.insertBefore(card, this.originalNextSibling);
    } else {
      this.originalParent.appendChild(card);
    }

    // Remove fullscreen styling
    card.classList.remove('fullscreen-card');
    this.overlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling

    // Trigger chart resize after overlay transition completes
    setTimeout(() => {
      // Trigger onResize for all chart instances
      if (window.ALL_CHART_INSTANCES && Array.isArray(window.ALL_CHART_INSTANCES)) {
        window.ALL_CHART_INSTANCES.forEach(chart => {
          if (typeof chart.onResize === 'function') {
            chart.onResize();
          }
        });
        console.log('[FullscreenOverlay] Called onResize for all charts on close');
      }
    }, 350); // Wait for transition to complete

    // Trigger map reload if this was the map card
    if (card.classList.contains('map-card') && window.flightMap && window.flightMap.map) {
      window.flightMap.map.invalidateSize();
      console.log('[FullscreenOverlay] Called invalidateSize() on Leaflet map after close');
    }

    this.currentExpandedCard = null;
    this.originalParent = null;
    this.originalNextSibling = null;
    
    console.log('[FullscreenOverlay] Closed');
  }

  /**
   * Destroy the overlay
   */
  destroy() {
    if (this.overlay) {
      this.overlay.remove();
    }
    console.log('[FullscreenOverlay] Destroyed');
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.fullscreenOverlay = new FullscreenOverlay();
});


