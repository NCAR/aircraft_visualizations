/**
 * VariablesListTable - Reusable variables table component
 * Renders a table of flight variables with add/remove actions
 * Can be used in SettingsOverlay, Dashboard, Home, About pages, etc.
 */

import { IComponent } from '../../interfaces/IComponent.js';
import { StateChangeDetector } from '../shared/StateChangeDetector.js';
import { updateChartVariable } from '../../store/actions/selectionActions.js';
import { fetchFlightData } from '../../store/actions/dataActions.js';
import { fetchVariablesForProject } from '../../store/actions/metadataActions.js';
import {
  getPageVariables,
  getChartVariablesWithColors,
  getCurrentFlightId,
  getCurrentProject,
  getCurrentTimeseries,
  getRealtimeVariablesWithMetadata
} from '../../store/selectors/selectors.js';

export default class VariablesListTable extends IComponent {
  constructor(store, config = {}) {
    super(store);

    this.config = {
      containerId: config.containerId || 'variables-table-container',
      tableClass: config.tableClass || 'variables-table',
      onVariableSelect: config.onVariableSelect || null,
      selectedChartIndex: config.selectedChartIndex !== undefined ? config.selectedChartIndex : 0,
      pageContext: config.pageContext || null,
      showCategory: config.showCategory !== false,
      showUnits: config.showUnits !== false,
      showActions: config.showActions !== false,
      searchable: config.searchable !== false,
      itemsPerPage: config.itemsPerPage || 10,
      scrollable: config.scrollable !== false,
      ...config
    };

    this.tableBody = null;
    this.tableElement = null;
    this.searchInput = null;
    this.categorySelect = null;
    this.selectedCategory = '';
    this.variablesRendered = false;
    this.currentPage = 1;
    this.filteredVariables = [];
    this.allVariables = [];
    this.currentState = null;

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      variablesLength: 0,
      selectedChartIndex: this.config.selectedChartIndex,
      currentFlightId: null,
      searchQuery: '',
      chartVarsCount: 0
    });


    // Create table HTML
    this.createTable();

    // Track last project name for refetching (onStateChange handles the actual fetch)
    this.lastProjectName = null;

    // Connect to store
    this.connect();

    console.log('[VariablesListTable] Created with config:', this.config);
  }

  /**
   * Create variables table DOM structure
   */
  createTable() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      console.error(`[VariablesListTable] Container #${this.config.containerId} not found`);
      return;
    }

    // Create wrapper with class for scrollable styling
    const wrapper = document.createElement('div');
    wrapper.className = this.config.scrollable ? 'variables-table-wrapper variables-table-scrollable' : 'variables-table-wrapper';

    // Create filter controls row (search + category dropdown)
    if (this.config.searchable || this.config.showCategory) {
      const filterRow = document.createElement('div');
      filterRow.className = 'variables-filter-row';

      // Search input
      if (this.config.searchable) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'variables-search-container';

        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.name = 'variables-search';
        this.searchInput.className = 'variables-search-input';
        this.searchInput.placeholder = 'Search variables...';
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

        const searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search variables-search-icon';

        searchContainer.appendChild(searchIcon);
        searchContainer.appendChild(this.searchInput);
        filterRow.appendChild(searchContainer);
      }

      // Category filter dropdown
      if (this.config.showCategory) {
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'variables-category-container';

        this.categorySelect = document.createElement('select');
        this.categorySelect.className = 'variables-category-select';
        this.categorySelect.name = 'variables-category';
        this.categorySelect.addEventListener('change', (e) => this.handleCategoryFilter(e.target.value));

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'All Categories';
        this.categorySelect.appendChild(defaultOption);

        categoryContainer.appendChild(this.categorySelect);
        filterRow.appendChild(categoryContainer);
      }

      wrapper.appendChild(filterRow);
    }

    // Create scrollable table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'variables-table-container';

    // Create table
    this.tableElement = document.createElement('table');
    this.tableElement.className = this.config.tableClass;

    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const headers = ['Long Name'];
    if (this.config.showCategory) headers.push('Category');
    if (this.config.showUnits) headers.push('Units');
    if (this.config.showActions) headers.push('Action');

    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    this.tableElement.appendChild(thead);

    // Create body
    this.tableBody = document.createElement('tbody');
    this.tableElement.appendChild(this.tableBody);

    tableContainer.appendChild(this.tableElement);
    wrapper.appendChild(tableContainer);
    container.appendChild(wrapper);

    // Create pagination controls if needed
    if (this.config.itemsPerPage > 0) {
      this.createPaginationControls(wrapper);
    }

    // Setup event delegation
    if (this.config.showActions) {
      this.tableBody.addEventListener('click', (event) => {
        const actionBtn = event.target.closest('.variable-select-btn');
        if (actionBtn) {
          const variable = actionBtn.getAttribute('data-variable');
          if (variable) {
            this.handleVariableSelect(variable);
          }
        }
      });
    }

    console.log('[VariablesListTable] Table created');
  }

  /**
   * Create pagination controls
   */
  createPaginationControls(wrapper) {
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'variables-pagination-container';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'variables-pagination-btn variables-pagination-prev';
    prevBtn.textContent = '← Previous';
    prevBtn.addEventListener('click', () => this.previousPage());

    const pageInfo = document.createElement('span');
    pageInfo.className = 'variables-pagination-info';
    pageInfo.id = 'variables-page-info';
    pageInfo.textContent = 'Page 1';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'variables-pagination-btn variables-pagination-next';
    nextBtn.textContent = 'Next →';
    nextBtn.addEventListener('click', () => this.nextPage());

    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextBtn);

    wrapper.appendChild(paginationContainer);
    this.paginationContainer = paginationContainer;
  }

  /**
   * Set the currently selected chart index for action button labels
   */
  setSelectedChartIndex(index) {
    this.config.selectedChartIndex = index;
    this.changeDetector.update('selectedChartIndex', index);
    // Re-render table to update button labels with new plot number
    this.renderTable(this.currentState);
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    // Always store current state for pagination methods
    this.currentState = state;


    // Get variables for the current page context (dashboard uses project metadata, realtime uses realtime state)
    const pageContext = this.config.pageContext;
    let variables;
    if (typeof this.config.getVariablesOverride === 'function') {
      variables = this.config.getVariablesOverride(state, pageContext);
    } else if (pageContext === 'realtime') {
      variables = getRealtimeVariablesWithMetadata(state);
    } else {
      variables = getPageVariables(state, pageContext);
    }
    const currentFlightId = getCurrentFlightId(state);
    const variablesLength = variables.length;

    // Refetch variables if project changes (dashboard only — realtime manages its own variable list)
    if (pageContext !== 'realtime') {
      const currentProjectName = getCurrentProject(state);
      if (currentProjectName && currentProjectName !== this.lastProjectName) {
        this.lastProjectName = currentProjectName;
        this.dispatch(fetchVariablesForProject(currentProjectName));
      }
    }

    // Filter out variables with no valid data (dashboard only — realtime shows all variables)
    if (pageContext !== 'realtime') {
      const timeseries = getCurrentTimeseries(state);
      if (Array.isArray(variables) && variables.length > 0 && Array.isArray(timeseries) && timeseries.length > 0) {
        variables = variables.filter(variable => {
          const clean = variable.clean_name || variable.name;
          // If variable is missing_value only, skip
          if (typeof variable.missing_value !== 'undefined') {
            const allMissing = timeseries.every(row => {
              const val = row[clean];
              return val === null || val === undefined || val === variable.missing_value;
            });
            if (allMissing) return false;
          }
          // Otherwise, keep if at least one value is valid
          return timeseries.some(row => {
            const val = row[clean];
            return val !== null && val !== undefined && (typeof variable.missing_value === 'undefined' || val !== variable.missing_value);
          });
        });
      }
    }

    // Track chart config changes so add/added badges update
    const chartVarsCount = this.config.pageContext
      ? getChartVariablesWithColors(state, this.config.selectedChartIndex, this.config.pageContext).length
      : 0;

    // Check if variables, flight, or chart config changed
    const changes = this.changeDetector.detectChanges({
      variablesLength,
      currentFlightId,
      chartVarsCount
    });

    if (changes.variablesLength || changes.currentFlightId || !this.variablesRendered) {
      // Update all variables, rebuild category options, and apply filters
      this.allVariables = variables || [];
      this.updateCategoryOptions();
      this.filterVariables(this.searchInput ? this.searchInput.value : '');
      this.renderTable(state);
      this.variablesRendered = true;
    } else if (changes.chartVarsCount) {
      // Chart variables changed (add/remove) - re-render to update badges
      this.renderTable(state);
    }

    this.changeDetector.updateAll({
      variablesLength,
      currentFlightId,
      chartVarsCount
    });
  }

  /**
   * Render variables table rows
   */
  renderTable(state) {
    if (!this.tableBody) return;

    // Show loading state if variables are being fetched (realtime only)
    const isRealtime = this.config.pageContext === 'realtime';
    const loading = isRealtime && state.realtime && state.realtime.loading && state.realtime.loading.variables;
    if (this.filteredVariables.length === 0) {
      if (loading) {
        this.tableBody.innerHTML = '<tr><td colspan="5" class="variables-empty-state">Loading variables...</td></tr>';
      } else {
        this.tableBody.innerHTML = '<tr><td colspan="5" class="variables-empty-state">No variables found</td></tr>';
      }
      this.updatePaginationUI();
      return;
    }

    // Calculate pagination
    const startIdx = (this.currentPage - 1) * this.config.itemsPerPage;
    const endIdx = startIdx + this.config.itemsPerPage;
    const pageVariables = this.filteredVariables.slice(startIdx, endIdx);

    // Get variables already added to the current chart
    const addedKeys = new Set();
    if (this.config.showActions && this.config.pageContext) {
      const chartVars = getChartVariablesWithColors(state, this.config.selectedChartIndex, this.config.pageContext);
      chartVars.forEach(v => addedKeys.add(v.key));
    }

    this.tableBody.innerHTML = '';

    pageVariables.forEach((variable, index) => {
      const row = document.createElement('tr');
      const clean = variable.clean_name || variable.name;
      const isAdded = addedKeys.has(clean);

      if (isAdded) {
        row.className = 'variable-row-added';
      }

      let rowHTML = `
        <td>
          <div class="variable-name">${variable.long_name || clean || 'Unknown'}</div>
          <div class="variable-id">${clean || ''}</div>
        </td>
      `;

      if (this.config.showCategory) {
        rowHTML += `<td>${variable.category || 'N/A'}</td>`;
      }

      if (this.config.showUnits) {
        rowHTML += `<td>${variable.units || ''}</td>`;
      }

      if (this.config.showActions) {
        if (isAdded) {
          rowHTML += `
            <td class="var-action-cell">
              <span class="variable-added-badge">Added</span>
            </td>
          `;
        } else {
          rowHTML += `
            <td class="var-action-cell">
              <button class="variable-select-btn" data-variable="${clean}" aria-label="Add to Plot ${this.config.selectedChartIndex + 1}">
                + Add
              </button>
            </td>
          `;
        }
      }

      row.innerHTML = rowHTML;
      this.tableBody.appendChild(row);
    });

    this.updatePaginationUI();
    console.log('[VariablesListTable] Table rendered with', pageVariables.length, 'variables');
  }

  /**
   * Filter variables based on search query and selected category
   * @param {string} query - Search query
   * @param {boolean} resetPage - Whether to reset to page 1 (default true for new filters)
   */
  filterVariables(query, resetPage = true) {
    const normalizedQuery = query.toLowerCase();
    const categoryFilter = this.selectedCategory;

    let results = this.allVariables;

    // Apply category filter
    if (categoryFilter) {
      results = results.filter(variable => (variable.category || '') === categoryFilter);
    }

    // Apply search query
    if (normalizedQuery) {
      results = results.filter(variable => {
        const name = (variable.name || '').toLowerCase();
        const cleanName = (variable.clean_name || '').toLowerCase();
        const longName = (variable.long_name || '').toLowerCase();
        const category = (variable.category || '').toLowerCase();
        const units = (variable.units || '').toLowerCase();

        return (
          name.includes(normalizedQuery) ||
          cleanName.includes(normalizedQuery) ||
          longName.includes(normalizedQuery) ||
          category.includes(normalizedQuery) ||
          units.includes(normalizedQuery)
        );
      });
    }

    this.filteredVariables = results;

    if (resetPage) {
      this.currentPage = 1;
    }
  }

  /**
   * Handle search input
   */
  handleSearch(query) {
    this.changeDetector.update('searchQuery', query);
    this.filterVariables(query, true);
    if (this.currentState) {
      this.renderTable(this.currentState);
    }
  }

  /**
   * Handle category filter change
   */
  handleCategoryFilter(category) {
    this.selectedCategory = category;
    this.filterVariables(this.searchInput ? this.searchInput.value : '', true);
    if (this.currentState) {
      this.renderTable(this.currentState);
    }
  }

  /**
   * Populate the category dropdown with unique categories from current variables
   */
  updateCategoryOptions() {
    if (!this.categorySelect) return;

    const categories = new Set();
    this.allVariables.forEach(v => {
      if (v.category) categories.add(v.category);
    });

    const sorted = [...categories].sort();

    // Preserve current selection
    const current = this.selectedCategory;

    // Clear and rebuild options
    this.categorySelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Categories';
    this.categorySelect.appendChild(allOption);

    sorted.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      this.categorySelect.appendChild(option);
    });

    // Restore selection if still valid
    if (current && sorted.includes(current)) {
      this.categorySelect.value = current;
    } else {
      this.selectedCategory = '';
      this.categorySelect.value = '';
    }
  }

  /**
   * Go to next page
   */
  nextPage() {
    const maxPage = Math.ceil(this.filteredVariables.length / this.config.itemsPerPage);
    if (this.currentPage < maxPage && maxPage > 0) {
      this.currentPage++;
      if (this.currentState) {
        this.renderTable(this.currentState);
      }
    }
  }

  /**
   * Go to previous page
   */
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      if (this.currentState) {
        this.renderTable(this.currentState);
      }
    }
  }

  /**
   * Update pagination UI
   */
  updatePaginationUI() {
    if (!this.paginationContainer) return;

    const totalItems = this.filteredVariables.length;
    const maxPage = Math.ceil(totalItems / this.config.itemsPerPage) || 1;
    const prevBtn = this.paginationContainer.querySelector('.variables-pagination-prev');
    const nextBtn = this.paginationContainer.querySelector('.variables-pagination-next');
    const pageInfo = this.paginationContainer.querySelector('.variables-pagination-info');

    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= maxPage;

    if (pageInfo) {
      const startIdx = (this.currentPage - 1) * this.config.itemsPerPage + 1;
      const endIdx = Math.min(this.currentPage * this.config.itemsPerPage, totalItems);
      pageInfo.textContent = `${startIdx}-${endIdx} of ${totalItems}`;
    }
  }

  /**
   * Handle variable selection
   */
  handleVariableSelect(variableCleanName) {
    const state = this.getState();
    const chartIndex = this.config.selectedChartIndex;
    const flightId = getCurrentFlightId(state);

    // Call custom handler if provided
    if (this.config.onVariableSelect) {
      this.config.onVariableSelect(variableCleanName, chartIndex, state);
      return;
    }

    // Default behavior: dispatch action
    if (!Number.isInteger(chartIndex)) {
      console.warn('[VariablesListTable] Selected chart index is not an integer');
      return;
    }

    this.dispatch(updateChartVariable(chartIndex, variableCleanName));

    // Fetch data if not already loaded
    const flightData = state.data.flightData[flightId];
    const alreadyLoaded = flightData?.loadedVariables?.has(variableCleanName);

    if (flightId && !alreadyLoaded) {
      this.dispatch(fetchFlightData(flightId, [variableCleanName]));
    }

    console.log('[VariablesListTable] Variable selected:', variableCleanName, 'for chart:', chartIndex);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.tableElement) {
      this.tableElement.remove();
    }
    super.destroy();
    console.log('[VariablesListTable] Destroyed');
  }
}
