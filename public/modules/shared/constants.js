/**
 * Shared constants used across modules
 */

/**
 * Map layer configuration for UI display
 * Used by SettingsOverlay and any map-related components
 */
export const LAYER_CONFIG = {
  glm: {
    name: 'Lightning (GLM)',
    description: 'GOES-19 GLM lightning flash data',
    hiddenFromUI: true
  },
  mrms: {
    name: 'MRMS Radar',
    description: 'Multi-Radar Multi-Sensor composite reflectivity',
    hiddenFromUI: true
  },
  goesVisible: {
    name: 'GOES Visible',
    description: 'GOES-19 CONUS visible imagery',
    hiddenFromUI: true
  },
  goesIR: {
    name: 'GOES IR',
    description: 'GOES-19 infrared imagery',
    hiddenFromUI: true
  },
  nexrad: {
    name: 'NEXRAD',
    description: 'NEXRAD high-resolution radar mosaic (1995-present)'
  }
};

/**
 * NCAR Design System Colors
 * Used by chart components for consistent styling
 */
export const NCAR_COLORS = {
  primary: '#0057C2',    // NCAR Blue
  accent: '#FAA119'      // NCAR Orange
};

/**
 * Extended color palette for multi-line charts
 * Colors are chosen for visual distinction and accessibility
 * Index 0-based, wraps around if more variables than colors
 */
export const CHART_LINE_COLORS = [
  '#0057C2',  // NCAR Blue
  '#FAA119',  // NCAR Orange
  '#2CA02C',  // Green
  '#D62728',  // Red
  '#9467BD',  // Purple
  '#8C564B',  // Brown
  '#E377C2',  // Pink
  '#17BECF',  // Cyan
  '#BCBD22',  // Olive
  '#FF7F0E',  // Dark Orange
  '#1F77B4',  // Steel Blue
  '#7F7F7F'   // Gray
];

/**
 * Get a color for a variable by index
 * Wraps around if index exceeds available colors
 * @param {number} index - Variable index
 * @returns {string} Hex color code
 */
export function getLineColor(index) {
  return CHART_LINE_COLORS[index % CHART_LINE_COLORS.length];
}

/**
 * Chart configuration bounds
 */
export const CHART_BOUNDS = {
  minVisibleCount: 1,
  maxVisibleCount: 8
};
