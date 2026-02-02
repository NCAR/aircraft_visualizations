/**
 * Client-side Router for SPA navigation
 * Uses History API for clean URLs without page reloads
 */
export class Router {
  /**
   * @param {Object} options
   * @param {Object.<string, Function>} options.routes - Route definitions { path: handler }
   * @param {Function} [options.onNavigate] - Callback called on every navigation
   */
  constructor(options = {}) {
    this.routes = options.routes || {};
    this.onNavigate = options.onNavigate || (() => {});
    this.currentPath = null;
    this.currentQuery = {};
    this.basePath = this._normalizeBasePath(options.basePath || '');

    // Bind popstate handler
    this._onPopState = this._onPopState.bind(this);
    window.addEventListener('popstate', this._onPopState);
  }

  /**
   * Initialize the router with the current URL
   */
  init() {
    this._handleRoute(window.location.pathname, window.location.search, false);
  }

  /**
   * Navigate to a new path
   * @param {string} path - The path to navigate to (e.g., '/about')
   * @param {Object} [query={}] - Query parameters
   * @param {boolean} [replace=false] - Use replaceState instead of pushState
   */
  navigate(path, query = {}, replace = false) {
    const queryString = this._buildQueryString(query);
    const normalizedPath = this._normalizePath(path);
    const fullBasePath = this._withBasePath(normalizedPath);
    const fullPath = queryString ? `${fullBasePath}?${queryString}` : fullBasePath;

    if (replace) {
      history.replaceState({ path, query }, '', fullPath);
    } else {
      history.pushState({ path, query }, '', fullPath);
    }

    this._handleRoute(normalizedPath, queryString ? `?${queryString}` : '', true);
  }

  /**
   * Update query parameters without changing the path
   * @param {Object} query - Query parameters to set
   * @param {boolean} [merge=true] - Merge with existing query params
   */
  updateQuery(query, merge = true) {
    const newQuery = merge ? { ...this.currentQuery, ...query } : query;

    // Remove null/undefined values
    Object.keys(newQuery).forEach(key => {
      if (newQuery[key] === null || newQuery[key] === undefined) {
        delete newQuery[key];
      }
    });

    const queryString = this._buildQueryString(newQuery);
    const basePath = this._withBasePath(this.currentPath || '/');
    const fullPath = queryString
      ? `${basePath}?${queryString}`
      : basePath;

    history.replaceState({ path: this.currentPath, query: newQuery }, '', fullPath);
    this.currentQuery = newQuery;
  }

  /**
   * Get current query parameters
   * @returns {Object} Query parameters
   */
  getQuery() {
    return { ...this.currentQuery };
  }

  /**
   * Get current path
   * @returns {string} Current path
   */
  getPath() {
    return this.currentPath;
  }

  /**
   * Parse query string into object
   * @param {string} search - Query string (e.g., '?foo=bar')
   * @returns {Object} Parsed query parameters
   */
  parseQuery(search) {
    const params = new URLSearchParams(search);
    const query = {};

    for (const [key, value] of params.entries()) {
      query[key] = value;
    }

    return query;
  }

  /**
   * Build query string from object
   * @param {Object} query - Query parameters
   * @returns {string} Query string without leading '?'
   * @private
   */
  _buildQueryString(query) {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });

    return params.toString();
  }

  /**
   * Handle popstate event (browser back/forward)
   * @param {PopStateEvent} event
   * @private
   */
  _onPopState(event) {
    this._handleRoute(
      window.location.pathname,
      window.location.search,
      true
    );
  }

  /**
   * Handle a route change
   * @param {string} path - The path
   * @param {string} search - Query string
   * @param {boolean} isNavigation - True if this is a navigation event
   * @private
   */
  _handleRoute(path, search, isNavigation) {
    const normalizedPath = this._stripBasePath(path);
    this.currentPath = normalizedPath;
    this.currentQuery = this.parseQuery(search);

    // Find matching route
    const handler = this._matchRoute(normalizedPath);

    if (handler) {
      handler({
        path: normalizedPath,
        query: this.currentQuery,
        isNavigation
      });
    }

    // Call onNavigate callback
    this.onNavigate({
      path: normalizedPath,
      query: this.currentQuery,
      isNavigation
    });
  }

  _normalizeBasePath(basePath) {
    if (!basePath) return '';
    let normalized = basePath.trim();
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    if (normalized.endsWith('/') && normalized !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  _normalizePath(path) {
    if (!path) return '/';
    let normalized = path.trim();
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    return normalized;
  }

  _stripBasePath(path) {
    const normalizedPath = this._normalizePath(path);
    if (!this.basePath) return normalizedPath;
    if (normalizedPath === this.basePath) return '/';
    if (normalizedPath.startsWith(`${this.basePath}/`)) {
      return normalizedPath.slice(this.basePath.length) || '/';
    }
    return normalizedPath;
  }

  _withBasePath(path) {
    const normalizedPath = this._normalizePath(path);
    if (!this.basePath) return normalizedPath;
    if (normalizedPath === '/') return this.basePath || '/';
    return `${this.basePath}${normalizedPath}`;
  }

  /**
   * Match a path to a route handler
   * @param {string} path - The path to match
   * @returns {Function|null} The matched handler or null
   * @private
   */
  _matchRoute(path) {
    // Exact match first
    if (this.routes[path]) {
      return this.routes[path];
    }

    // Try with trailing slash normalization
    const normalizedPath = path.endsWith('/') && path !== '/'
      ? path.slice(0, -1)
      : path;

    if (this.routes[normalizedPath]) {
      return this.routes[normalizedPath];
    }

    // Check for wildcard/default route
    if (this.routes['*']) {
      return this.routes['*'];
    }

    return null;
  }

  /**
   * Add a route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  /**
   * Remove a route
   * @param {string} path - Route path to remove
   */
  removeRoute(path) {
    delete this.routes[path];
  }

  /**
   * Clean up the router
   */
  destroy() {
    window.removeEventListener('popstate', this._onPopState);
    this.routes = {};
    this.onNavigate = () => {};
  }
}

// Export a factory function for creating the router
export function createRouter(options) {
  return new Router(options);
}
