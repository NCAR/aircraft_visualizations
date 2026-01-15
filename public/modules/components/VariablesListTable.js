/**
 * VariablesListTable - Reusable variables table component
 * Renders a table of flight variables with add/remove actions
 * Can be used in SettingsOverlay, Dashboard, Home, About pages, etc.
 */

import { IComponent } from '../../interfaces/IComponent.js';
import { StateChangeDetector } from '../shared/StateChangeDetector.js';
import { updateChartVariable } from '../../store/actions/selectionActions.js';
import { fetchFlightData } from '../../store/actions/dataActions.js';
import {
  getVariables,
  getChartVariable,
  getCurrentFlightId
} from '../../store/selectors/selectors.js';

export default class VariablesListTable extends IComponent {
  constructor(store, config = {}) {
    super(store);

    this.config = {
      containerId: config.containerId || 'variables-table-container',
      tableClass: config.tableClass || 'variables-table',
      onVariableSelect: config.onVariableSelect || null,
      selectedChartIndex: config.selectedChartIndex !== undefined ? config.selectedChartIndex : 0,
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
      searchQuery: ''
    });

    // Create table HTML
    this.createTable();

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

    // Create search input if enabled
    if (this.config.searchable) {
      const searchContainer = document.createElement('div');
      searchContainer.className = 'variables-search-container';

      this.searchInput = document.createElement('input');
      this.searchInput.type = 'text';
      this.searchInput.id = 'variables-search-input';
      this.searchInput.name = 'variables-search';
      this.searchInput.className = 'variables-search-input';
      this.searchInput.placeholder = 'Search variables...';
      this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

      const searchIcon = document.createElement('i');
      searchIcon.className = 'fas fa-search variables-search-icon';

      searchContainer.appendChild(searchIcon);
      searchContainer.appendChild(this.searchInput);
      wrapper.appendChild(searchContainer);
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

    const variables = getVariables(state);
    const currentFlightId = getCurrentFlightId(state);
    const variablesLength = variables.length;

    // Check if variables or flight changed
    const changes = this.changeDetector.detectChanges({
      variablesLength,
      currentFlightId
    });

    if (changes.variablesLength || changes.currentFlightId || !this.variablesRendered) {
      // Update all variables and apply current search filter
      this.allVariables = variables || [];
      this.filterVariables(this.searchInput ? this.searchInput.value : '');
      this.renderTable(state);
      this.variablesRendered = true;
    }

    this.changeDetector.updateAll({
      variablesLength,
      currentFlightId
    });
  }

  /**
   * Render variables table rows
   */
  renderTable(state) {
    if (!this.tableBody) return;

    // Variables already filtered by onStateChange or handleSearch
    if (this.filteredVariables.length === 0) {
      this.tableBody.innerHTML = '<tr><td colspan="5" class="variables-empty-state">No variables found</td></tr>';
      this.updatePaginationUI();
      return;
    }

    // Calculate pagination
    const startIdx = (this.currentPage - 1) * this.config.itemsPerPage;
    const endIdx = startIdx + this.config.itemsPerPage;
    const pageVariables = this.filteredVariables.slice(startIdx, endIdx);

    const activeVariable = getChartVariable(state, this.config.selectedChartIndex);

    this.tableBody.innerHTML = '';

    pageVariables.forEach((variable, index) => {
      const row = document.createElement('tr');
      const clean = variable.clean_name || variable.name;
      const isActive = clean === activeVariable;

      let rowHTML = `
        <td>
          <div class="variable-name">${variable.long_name || clean || 'Unknown'}</div>
          <div class="variable-id">${clean || ''}</div>
        </td>
      `;

      if (this.config.showCategory) {
        rowHTML += `<td>${variable.category || variable.standard_name || 'N/A'}</td>`;
      }

      if (this.config.showUnits) {
        rowHTML += `<td>${variable.units || ''}</td>`;
      }

      if (this.config.showActions) {
        const buttonLabel = this.config.selectedChartIndex !== undefined
          ? `Use on Plot ${this.config.selectedChartIndex + 1}`
          : 'Select Variable';

        rowHTML += `
          <td>
            <button class="variable-select-btn" data-variable="${clean}" aria-label="${buttonLabel}">
              ${buttonLabel}
            </button>
            ${isActive ? '<span class="variable-active-pill">Active</span>' : ''}
          </td>
        `;
      }

      row.innerHTML = rowHTML;
      this.tableBody.appendChild(row);
    });

    this.updatePaginationUI();
    console.log('[VariablesListTable] Table rendered with', pageVariables.length, 'variables');
  }

  /**
   * Filter variables based on search query
   * @param {string} query - Search query
   * @param {boolean} resetPage - Whether to reset to page 1 (default true for new searches)
   */
  filterVariables(query, resetPage = true) {
    const normalizedQuery = query.toLowerCase();

    if (!normalizedQuery) {
      this.filteredVariables = [...this.allVariables];
    } else {
      this.filteredVariables = this.allVariables.filter(variable => {
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

    // Reset to first page only when user initiates new search
    if (resetPage) {
      this.currentPage = 1;
    }
  }

  /**
   * Handle search input
   */
  handleSearch(query) {
    this.changeDetector.update('searchQuery', query);
    this.filterVariables(query, true); // Reset to page 1 on new search
    if (this.currentState) {
      this.renderTable(this.currentState);
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
