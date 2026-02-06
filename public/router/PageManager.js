/**
 * PageManager - Page loading and lifecycle management for SPA
 * Handles loading page HTML partials and managing page module lifecycle
 */

export class PageManager {
  /**
   * @param {Object} options
   * @param {HTMLElement|string} options.container - Container element or selector
   * @param {Object} options.store - Redux-like store instance
   * @param {Object} [options.pages] - Page definitions { name: { html, module } }
   */
  constructor(options) {
    this.container = typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container;

    if (!this.container) {
      throw new Error('PageManager: container element not found');
    }

    this.store = options.store;
    this.pages = options.pages || {};
    this.currentPage = null;
    this.pageInstances = {};
    this.loadedModules = {};
  }

  /**
   * Register a page
   * @param {string} name - Page name (route identifier)
   * @param {Object} pageConfig - Page configuration
   * @param {string} pageConfig.html - Path to HTML partial
   * @param {string} pageConfig.module - Path to page module
   */
  registerPage(name, pageConfig) {
    this.pages[name] = pageConfig;
  }

  /**
   * Load and display a page
   * @param {string} pageName - Name of the page to load
   * @param {Object} [context={}] - Context passed to page init
   * @returns {Promise<Object|null>} Page instance or null
   */
  async loadPage(pageName, context = {}) {
    const pageConfig = this.pages[pageName];

    if (!pageConfig) {
      console.error(`[PageManager] Unknown page: ${pageName}`);
      return null;
    }

    // Check if we're reloading the same page (e.g., unified page with mode change)
    // If so, don't destroy/recreate - just update via setMode if available
    if (this.currentPage === pageName && this.pageInstances[pageName]) {
      const instance = this.pageInstances[pageName];
      console.log(`[PageManager] Same page ${pageName}, checking for mode update`);

      // If the page has a setMode function, call it with the context
      if (typeof instance.setMode === 'function' && context.path) {
        const newMode = context.path === '/dashboard' ? 'dashboard' : 'visualization';
        instance.setMode(newMode);
        console.log(`[PageManager] Updated mode to: ${newMode}`);
      }

      return instance;
    }

    console.log(`[PageManager] Loading page: ${pageName}`);

    // Cleanup current page first
    await this.cleanup();

    try {
      // Load HTML partial
      if (pageConfig.html) {
        await this._loadHTML(pageConfig.html);
      }

      // Load and initialize module
      let instance = null;
      if (pageConfig.module) {
        instance = await this._initModule(pageName, pageConfig.module, context);
      }

      this.currentPage = pageName;
      this.pageInstances[pageName] = instance;

      console.log(`[PageManager] Page loaded: ${pageName}`);

      return instance;

    } catch (error) {
      console.error(`[PageManager] Error loading page ${pageName}:`, error);
      throw error;
    }
  }

  /**
   * Load HTML partial into container
   * @param {string} htmlPath - Path to HTML file
   * @private
   */
  async _loadHTML(htmlPath) {
    const response = await fetch(htmlPath);

    if (!response.ok) {
      throw new Error(`Failed to load HTML: ${htmlPath} (${response.status})`);
    }

    const html = await response.text();
    this.container.innerHTML = html;
  }

  /**
   * Load and initialize a page module
   * @param {string} pageName - Page name
   * @param {string} modulePath - Path to module
   * @param {Object} context - Context for initialization
   * @returns {Promise<Object|null>} Module instance
   * @private
   */
  async _initModule(pageName, modulePath, context) {
    // Check if module is already loaded
    let module = this.loadedModules[modulePath];

    if (!module) {
      // Dynamic import
      module = await import(modulePath);
      this.loadedModules[modulePath] = module;
    }

    // Call init function if available
    if (typeof module.init === 'function') {
      const instance = await module.init(this.store, context);
      return instance;
    }

    // Or call default export if it's a function
    if (typeof module.default === 'function') {
      const instance = await module.default(this.store, context);
      return instance;
    }

    return module;
  }

  /**
   * Cleanup current page
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (!this.currentPage) return;

    const instance = this.pageInstances[this.currentPage];

    if (instance) {
      try {
        // Call destroy method if available
        if (typeof instance.destroy === 'function') {
          await instance.destroy();
          console.log(`[PageManager] Destroyed page: ${this.currentPage}`);
        }

        // Call cleanup method if available (alias)
        if (typeof instance.cleanup === 'function') {
          await instance.cleanup();
        }

      } catch (error) {
        console.error(`[PageManager] Error during cleanup of ${this.currentPage}:`, error);
      }

      delete this.pageInstances[this.currentPage];
    }

    this.currentPage = null;
  }

  /**
   * Get current page name
   * @returns {string|null} Current page name
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get page instance by name
   * @param {string} pageName - Page name
   * @returns {Object|null} Page instance
   */
  getPageInstance(pageName) {
    return this.pageInstances[pageName] || null;
  }

  /**
   * Check if a page is loaded
   * @param {string} pageName - Page name
   * @returns {boolean} True if page is currently loaded
   */
  isPageLoaded(pageName) {
    return this.currentPage === pageName;
  }

  /**
   * Preload page assets (HTML and module)
   * @param {string} pageName - Page to preload
   * @returns {Promise<void>}
   */
  async preloadPage(pageName) {
    const pageConfig = this.pages[pageName];
    if (!pageConfig) return;

    const promises = [];

    // Preload HTML
    if (pageConfig.html) {
      promises.push(
        fetch(pageConfig.html).catch(err =>
          console.warn(`[PageManager] Preload failed for ${pageConfig.html}:`, err)
        )
      );
    }

    // Preload module
    if (pageConfig.module && !this.loadedModules[pageConfig.module]) {
      promises.push(
        import(pageConfig.module)
          .then(module => {
            this.loadedModules[pageConfig.module] = module;
          })
          .catch(err =>
            console.warn(`[PageManager] Preload failed for ${pageConfig.module}:`, err)
          )
      );
    }

    await Promise.all(promises);
  }

  /**
   * Destroy the page manager
   */
  destroy() {
    // Cleanup all pages
    Object.keys(this.pageInstances).forEach(pageName => {
      const instance = this.pageInstances[pageName];
      if (instance && typeof instance.destroy === 'function') {
        try {
          instance.destroy();
        } catch (error) {
          console.error(`[PageManager] Error destroying ${pageName}:`, error);
        }
      }
    });

    this.pageInstances = {};
    this.loadedModules = {};
    this.currentPage = null;

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

/**
 * Factory function to create PageManager
 * @param {Object} options
 * @returns {PageManager}
 */
export function createPageManager(options) {
  return new PageManager(options);
}
