/**
 * BaseDropdownStore - Base class for dropdown components
 * Provides common dropdown functionality to reduce code duplication
 */

import { IComponent } from '../../interfaces/IComponent.js';
import { StateChangeDetector } from '../shared/StateChangeDetector.js';

export default class BaseDropdownStore extends IComponent {
  constructor(store, config) {
    super(store);

    const {
      dropdownId,
      triggerId,
      menuId,
      itemClass,
      componentName,
      stateKeys
    } = config;

    this.componentName = componentName;
    this.itemClass = itemClass;

    // Get DOM elements
    this.dropdown = document.getElementById(dropdownId);
    this.trigger = document.getElementById(triggerId);
    this.menu = document.getElementById(menuId);

    if (!this.trigger || !this.dropdown || !this.menu) {
      console.error(`[${componentName}] dropdown elements not found`);
      return;
    }

    // Track previous state
    this.changeDetector = new StateChangeDetector(stateKeys);

    // Bind event listeners
    this.setupEventListeners();

    // Connect to store
    this.connect();
    this.onStateChange(this.getState());

    console.log(`[${componentName}] Created`);
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // Toggle dropdown - listen on entire dropdown container
    this.dropdown.addEventListener('click', (e) => {
      // Don't toggle if clicking on menu items
      if (e.target.closest(`.${this.itemClass}`)) {
        return;
      }
      e.stopPropagation();
      this.dropdown.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.dropdown.contains(e.target)) {
        this.dropdown.classList.remove('open');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dropdown.classList.contains('open')) {
        this.dropdown.classList.remove('open');
        this.trigger.focus();
      }
    });

    console.log(`[${this.componentName}] Event listeners setup`);
  }

  /**
   * Update dropdown menu trigger text
   */
  updateTriggerText(text) {
    const textElement = this.trigger.querySelector('.dropdown-text');
    if (textElement) {
      textElement.textContent = text;
    }
  }

  /**
   * Update visual selection state
   */
  updateMenuSelection(selectedValue, compareKey = 'value') {
    // Handle null/undefined selectedValue
    if (!selectedValue) return;

    Array.from(this.menu.children).forEach((item) => {
      item.classList.remove('selected');
    });

    const selectedItem = Array.from(this.menu.children).find(
      (item) => item.dataset[compareKey] === String(selectedValue)
    );

    if (selectedItem) {
      selectedItem.classList.add('selected');
      this.updateTriggerText(selectedItem.textContent);
    }
  }

  /**
   * Close dropdown
   */
  close() {
    this.dropdown.classList.remove('open');
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log(`[${this.componentName}] Destroyed`);
  }
}
