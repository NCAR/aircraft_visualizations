/**
 * ProjectDropdownStore - Store-connected project dropdown component
 * Refactored to use Redux-like store and follow IComponent pattern
 */

import BaseDropdownStore from './BaseDropdownStore.js';
import { selectProject } from '../../store/actions/selectionActions.js';
import { fetchFlightsForProject } from '../../store/actions/metadataActions.js';

export default class ProjectDropdownStore extends BaseDropdownStore {
  constructor(store) {
    super(store, {
      dropdownId: 'project-dropdown',
      triggerId: 'project-trigger',
      menuId: 'project-menu',
      itemClass: 'project-dropdown-item',
      componentName: 'ProjectDropdownStore',
      stateKeys: {
        projects: null,
        projectName: null
      }
    });
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const projects = state.metadata.projects || [];
    const currentProjectName = state.selection.projectName;

    // Check if projects changed
    if (this.changeDetector.hasChanged('projects', projects)) {
      this.updateMenu(projects, currentProjectName);
      this.changeDetector.update('projects', projects);
    }

    // Check if selected project changed
    if (this.changeDetector.hasChanged('projectName', currentProjectName)) {
      this.updateMenuSelection(currentProjectName, 'projectName');
      this.changeDetector.update('projectName', currentProjectName);
    }
  }

  /**
   * Update dropdown menu with projects
   */
  updateMenu(projects, currentProjectName) {
    if (projects.length === 0) return;

    this.menu.innerHTML = '';

    projects.forEach((project) => {
      // Handle both string and object formats
      const projectName = typeof project === 'string' ? project : project.project_name;
      
      const item = document.createElement('button');
      item.className = 'project-dropdown-item';
      item.textContent = projectName;
      item.dataset.projectName = projectName;

      if (projectName === currentProjectName) {
        item.classList.add('selected');
        this.updateTriggerText(projectName);
      }

      item.addEventListener('click', () => this.handleProjectSelection(projectName));
      this.menu.appendChild(item);
    });

    console.log('[ProjectDropdownStore] Menu updated with', projects.length, 'projects');
  }

  /**
   * Handle project selection
   */
  handleProjectSelection(projectName) {
    console.log('[ProjectDropdownStore] Project selected:', projectName);

    // Dispatch project selection
    this.store.dispatch(selectProject(projectName));

    // Fetch flights for the selected project
    this.store.dispatch(fetchFlightsForProject(projectName));

    // Close dropdown
    this.close();

    console.log('[ProjectDropdownStore] Project selection dispatched');
  }
}
