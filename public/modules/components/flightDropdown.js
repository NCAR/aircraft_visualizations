/**
 * FlightDropdown - Reusable flight dropdown component
 * Can be instantiated on any page and syncs with store automatically
 * Does NOT require pre-existing HTML elements
 */

import BaseDropdownStore from './BaseDropdownStore.js';
import { selectFlight } from '../../store/actions/selectionActions.js';
import { fetchFlightData } from '../../store/actions/dataActions.js';
import {
  getFlightsForProject,
  getCurrentFlightNumber
} from '../../store/selectors/selectors.js';

export default class FlightDropdown extends BaseDropdownStore {
  constructor(store, config = {}) {
    // Merge with defaults
    const mergedConfig = {
      dropdownId: 'flight-dropdown',
      triggerId: 'flight-trigger',
      menuId: 'flight-menu',
      itemClass: 'custom-dropdown-item',
      componentName: 'FlightDropdown',
      createDOM: true,
      parentSelector: 'body',
      triggerText: 'Select Flight',
      ...config
    };

    // Create DOM elements if needed
    if (mergedConfig.createDOM) {
      FlightDropdown.createDropdownElements(
        mergedConfig.dropdownId,
        mergedConfig.triggerId,
        mergedConfig.menuId,
        mergedConfig.triggerText,
        mergedConfig.parentSelector
      );
    }

    // Setup state tracking
    mergedConfig.stateKeys = {
      flights: null,
      flightId: null,
      projectName: null
    };

    // Call parent constructor
    super(store, mergedConfig);

    this.config = mergedConfig;
  }

  /**
   * Static method to create dropdown DOM elements
   * Useful for dynamically injecting dropdowns into pages
   */
  static createDropdownElements(dropdownId, triggerId, menuId, triggerText = 'Select Flight', parentSelector = 'body') {
    const parent = document.querySelector(parentSelector);
    if (!parent) {
      console.error(`[FlightDropdown] Parent selector "${parentSelector}" not found`);
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-dropdown';
    dropdown.id = dropdownId;

    dropdown.innerHTML = `
      <button class="custom-dropdown-trigger" id="${triggerId}">
        <span class="dropdown-text">${triggerText}</span>
        <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="custom-dropdown-menu" id="${menuId}">
        <!-- Populated by component -->
      </div>
    `;

    parent.appendChild(dropdown);
    console.log(`[FlightDropdown] Created DOM elements for ${dropdownId}`);
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const projectName = state.selection.projectName;
    const flights = getFlightsForProject(state, projectName) || [];
    const currentFlightId = state.selection.flightId;

    // Check if flights or project changed
    if (
      this.changeDetector.hasChanged('flights', flights) ||
      this.changeDetector.hasChanged('projectName', projectName)
    ) {
      this.updateMenu(flights, currentFlightId);
      this.changeDetector.update('flights', flights);
      this.changeDetector.update('projectName', projectName);
    }

    // Check if selected flight changed
    if (this.changeDetector.hasChanged('flightId', currentFlightId)) {
      this.updateMenuSelection(String(currentFlightId), 'flightId');
      this.changeDetector.update('flightId', currentFlightId);
    }
  }

  /**
   * Update dropdown menu with flights
   */
  updateMenu(flights, currentFlightId) {
    if (flights.length === 0) {
      this.menu.innerHTML = '<div class="dropdown-placeholder">No flights available</div>';
      return;
    }

    // Sort flights: RF first, then TF, then FF
    const sortedFlights = [...flights].sort((a, b) => {
      const aPrefix = a.flight_number.substring(0, 2);
      const bPrefix = b.flight_number.substring(0, 2);
      const order = { 'rf': 1, 'tf': 2, 'ff': 3 };
      const aOrder = order[aPrefix.toLowerCase()] || 999;
      const bOrder = order[bPrefix.toLowerCase()] || 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.flight_number.localeCompare(b.flight_number);
    });

    this.menu.innerHTML = '';

    sortedFlights.forEach((flight) => {
      const item = document.createElement('button');
      item.className = 'custom-dropdown-item';
      item.textContent = flight.flight_number;
      item.dataset.flightId = flight.id;

      if (flight.id === currentFlightId) {
        item.classList.add('selected');
        this.updateTriggerText(flight.flight_number);
      }

      item.addEventListener('click', () => this.handleFlightSelection(flight));
      this.menu.appendChild(item);
    });

    console.log('[FlightDropdown] Menu updated with', flights.length, 'flights');
  }

  /**
   * Handle flight selection
   */
  handleFlightSelection(flight) {
    console.log('[FlightDropdown] Flight selected:', flight.flight_number, 'ID:', flight.id);

    const state = this.getState();

    // Dispatch flight selection
    this.store.dispatch(selectFlight(flight.id, flight.flight_number));

    // Fetch data for selected variables
    const variables = state.selection.selectedVariables || [];
    if (variables.length > 0) {
      this.store.dispatch(fetchFlightData(flight.id, variables));
    }

    // Close dropdown
    this.close();

    console.log('[FlightDropdown] Flight selection dispatched');
  }
}
