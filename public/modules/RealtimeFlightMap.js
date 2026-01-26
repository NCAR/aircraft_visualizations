/**
 * RealtimeFlightMap - Store-connected map for realtime flight data
 * Adapted from FlightMapStore to work with realtime state
 */

import { IComponent } from '../interfaces/IComponent.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';

// ========================================
// Realtime Selectors
// ========================================

const getRealtimeData = (state) => state.realtime?.data || [];
const getRealtimeTimeRange = (state) => state.realtime?.timeRange || null;
const getRealtimeDatabase = (state) => state.realtime?.currentDatabase || 'C130';
const isRealtimeLoading = (state) => state.realtime?.loading?.data || false;

/**
 * Weather layer configuration for realtime
 * These are current/live layers, not time-enabled archive layers
 */
const WEATHER_LAYERS = {
  mrms: {
    id: 'mrms',
    name: 'MRMS Radar',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/us/mrms.cgi',
    layer: 'mrms_cref',
    opacity: 0.6
  },
  goesVisible: {
    id: 'goesVisible',
    name: 'GOES Visible',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_east.cgi',
    layer: 'conus_ch02',
    opacity: 0.5
  },
  goesIR: {
    id: 'goesIR',
    name: 'GOES IR',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_east.cgi',
    layer: 'conus_ch13',
    opacity: 0.5
  },
  glm: {
    id: 'glm',
    name: 'Lightning (GLM)',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_east.cgi',
    layer: 'fulldisk_glm_mfa',
    opacity: 0.7
  }
};

/**
 * RealtimeFlightMap - Leaflet map for realtime flight tracking
 */
export default class RealtimeFlightMap extends IComponent {
  constructor(mapId, store) {
    super(store);

    this.mapId = mapId;

    // Initialize map
    this.map = L.map(mapId, {
      maxZoom: 18,
      minZoom: 3,
      zoomControl: false
    }).setView([39.5, -98.35], 4); // Center on US

    // Add zoom control
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    // Data storage
    this.trackData = null;
    this.planePath = null;
    this.planeMarker = null;
    this.weatherLayers = {};

    // Track state changes
    this.changeDetector = new StateChangeDetector({
      data: null,
      database: null
    });

    // Initialize map
    this.initBaseLayer();
    this.initPlaneIcon();
    this.enableAllWeatherLayers();

    // Connect to store
    this.connect();
    this.onStateChange(this.getState());

    console.log('[RealtimeFlightMap] Created');
  }

  /**
   * Initialize base map layer
   */
  initBaseLayer() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);
  }

  /**
   * Initialize plane icon
   */
  initPlaneIcon() {
    this.planeIcon = L.divIcon({
      html: `
        <svg viewBox="0 0 24 24" width="32" height="32" style="transform-origin: center;">
          <path fill="#FAA119" d="M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/>
        </svg>
      `,
      className: 'plane-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const data = getRealtimeData(state);
    const database = getRealtimeDatabase(state);

    // Check for database change
    if (this.changeDetector.hasChanged('database', database)) {
      this.clearTrack();
      this.changeDetector.update('database', database);
    }

    // Check for data change
    if (this.changeDetector.hasChanged('data', data)) {
      this.updateTrack(data);
      this.changeDetector.update('data', data);
    }
  }

  /**
   * Update the flight track with new data
   */
  updateTrack(data) {
    if (!data || !data.length) {
      this.clearTrack();
      return;
    }

    // Extract coordinates - need lat/lon variables
    // Common variable names: gglat, gglon (lowercase from our fetch)
    const latVars = ['gglat', 'GGLAT', 'lat', 'latitude', 'LAT'];
    const lonVars = ['gglon', 'GGLON', 'lon', 'longitude', 'LON'];
    const hdgVars = ['thdg', 'THDG', 'heading', 'HDG'];

    let latKey = null;
    let lonKey = null;
    let hdgKey = null;

    // Find the lat/lon keys in the data
    if (data[0]) {
      const keys = Object.keys(data[0]);
      latKey = keys.find(k => latVars.includes(k));
      lonKey = keys.find(k => lonVars.includes(k));
      hdgKey = keys.find(k => hdgVars.includes(k));
    }

    if (!latKey || !lonKey) {
      console.log('[RealtimeFlightMap] No lat/lon data found in realtime data');
      return;
    }

    // Build track points
    const trackPoints = data
      .filter(d => d[latKey] != null && d[lonKey] != null &&
                   d[latKey] !== -32767 && d[lonKey] !== -32767)
      .map(d => ({
        lat: d[latKey],
        lng: d[lonKey],
        heading: hdgKey ? d[hdgKey] : 0,
        time: d.datetime
      }));

    if (trackPoints.length === 0) {
      console.log('[RealtimeFlightMap] No valid track points');
      return;
    }

    // Store track data
    this.trackData = trackPoints;

    // Update or create path
    const latLngs = trackPoints.map(p => [p.lat, p.lng]);

    if (this.planePath) {
      this.planePath.setLatLngs(latLngs);
    } else {
      this.planePath = L.polyline(latLngs, {
        color: '#FAA119',
        weight: 2,
        opacity: 0.8
      }).addTo(this.map);
    }

    // Update plane marker at latest position
    const lastPoint = trackPoints[trackPoints.length - 1];
    this.updatePlanePosition(lastPoint.lat, lastPoint.lng, lastPoint.heading);

    // Fit bounds if this is new track
    if (trackPoints.length > 1) {
      const bounds = L.latLngBounds(latLngs);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /**
   * Update plane marker position and heading
   */
  updatePlanePosition(lat, lng, heading = 0) {
    if (!this.planeMarker) {
      this.planeMarker = L.marker([lat, lng], {
        icon: this.planeIcon,
        zIndexOffset: 1000
      }).addTo(this.map);
    } else {
      this.planeMarker.setLatLng([lat, lng]);
    }

    // Update rotation
    const iconElement = this.planeMarker.getElement();
    if (iconElement) {
      const svg = iconElement.querySelector('svg');
      if (svg) {
        svg.style.transform = `rotate(${heading}deg)`;
      }
    }
  }

  /**
   * Clear the current track
   */
  clearTrack() {
    if (this.planePath) {
      this.map.removeLayer(this.planePath);
      this.planePath = null;
    }
    if (this.planeMarker) {
      this.map.removeLayer(this.planeMarker);
      this.planeMarker = null;
    }
    this.trackData = null;
  }

  /**
   * Add a weather layer
   */
  addWeatherLayer(layerId) {
    const config = WEATHER_LAYERS[layerId];
    if (!config) return;

    if (this.weatherLayers[layerId]) return; // Already added

    const wmsLayer = L.tileLayer.wms(config.url, {
      layers: config.layer,
      format: 'image/png',
      transparent: true,
      opacity: config.opacity,
      attribution: 'Weather data: Iowa Environmental Mesonet'
    });

    wmsLayer.addTo(this.map);
    this.weatherLayers[layerId] = wmsLayer;
    console.log(`[RealtimeFlightMap] Added weather layer: ${config.name}`);
  }

  /**
   * Remove a weather layer
   */
  removeWeatherLayer(layerId) {
    const layer = this.weatherLayers[layerId];
    if (layer) {
      this.map.removeLayer(layer);
      delete this.weatherLayers[layerId];
      console.log(`[RealtimeFlightMap] Removed weather layer: ${layerId}`);
    }
  }

  /**
   * Toggle a weather layer
   */
  toggleWeatherLayer(layerId) {
    if (this.weatherLayers[layerId]) {
      this.removeWeatherLayer(layerId);
    } else {
      this.addWeatherLayer(layerId);
    }
  }

  /**
   * Get available weather layers
   */
  getAvailableWeatherLayers() {
    return Object.entries(WEATHER_LAYERS).map(([id, config]) => ({
      id,
      name: config.name,
      active: !!this.weatherLayers[id]
    }));
  }

  /**
   * Turn on all configured weather layers
   */
  enableAllWeatherLayers() {
    Object.keys(WEATHER_LAYERS).forEach(id => this.addWeatherLayer(id));
  }

  /**
   * Invalidate map size (call after container resize)
   */
  invalidateSize() {
    this.map.invalidateSize();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clearTrack();

    // Remove weather layers
    Object.keys(this.weatherLayers).forEach(id => {
      this.removeWeatherLayer(id);
    });

    // Remove map
    this.map.remove();

    this.disconnect();
    console.log('[RealtimeFlightMap] Destroyed');
  }
}
