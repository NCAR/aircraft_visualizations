/**
 * FlightDropdownStore - Store-connected dropdown component
 * Refactored to use Redux-like store and follow IComponent pattern
 */

import BaseDropdownStore from './BaseDropdownStore.js';
import { selectFlight } from '../../store/actions/selectionActions.js';
import { fetchFlightData } from '../../store/actions/dataActions.js';

export default class FlightDropdownStore extends BaseDropdownStore {
  constructor(store) {
    super(store, {
      dropdownId: 'flight-dropdown',
      triggerId: 'flight-trigger',
      menuId: 'flight-menu',
      itemClass: 'custom-dropdown-item',
      componentName: 'FlightDropdownStore',
      stateKeys: {
        flights: null,
        flightId: null,
        projectName: null
      }
    });
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const flights = state.metadata.flights[state.selection.projectName] || [];
    const currentFlightId = state.selection.flightId;
    const projectName = state.selection.projectName;

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
    if (flights.length === 0) return;

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

    console.log('[FlightDropdownStore] Menu updated with', flights.length, 'flights');
  }

  /**
   * Handle flight selection
   */
  handleFlightSelection(flight) {
    console.log('[FlightDropdownStore] Flight selected:', flight.flight_number, 'ID:', flight.id);

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

    console.log('[FlightDropdownStore] Flight selection dispatched');
  }
}
