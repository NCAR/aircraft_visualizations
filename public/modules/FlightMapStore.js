/**
 * FlightMap - Store-connected version
 * Refactored to use Redux-like store for state management
 */

import { IComponent } from '../interfaces/IComponent.js';
import {
  getCurrentFlightData,
  getCurrentFlightId,
  getTimelineProgress,
  getCurrentTime,
  isRadarEnabled
} from '../store/selectors/selectors.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';

export default class FlightMapStore extends IComponent {
  constructor(mapId, store) {
    super(store);

    this.mapId = mapId;
    this.map = L.map(mapId, {
      maxZoom: 18,
      minZoom: 3
    }).setView([0, 0], 2);

    this.planeIconPNG = 'icons/plane.png';
    this.planePath = null;
    this.planeMarker = null;
    this.data = null;
    this.radarLayer = null;
    this.lastRadarTimestamp = null;

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      flightId: null,
      progress: null,
      data: null
    });

    // Initialize map
    this.initMap();
    this.addRadarLayer();

    // Connect to store and initialize
    this.connect();
    this.onStateChange(this.getState());

    console.log('[FlightMapStore] Created');
  }

  /**
   * Initialize base map layers
   */
  initMap() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const flightData = getCurrentFlightData(state);
    const flightId = getCurrentFlightId(state);
    const progress = getTimelineProgress(state);
    const currentTime = getCurrentTime(state);
    const showRadar = isRadarEnabled(state);

    // Check if flight data changed
    if (flightData && flightData.track && this.changeDetector.hasChanged('data', flightData.track)) {
      // console.log('[FlightMapStore] Loading new flight track:', flightId); // DEBUG
      this.loadFlightTrack(flightData.track);
      this.changeDetector.updateAll({
        data: flightData.track,
        flightId
      });
    }

    // Update position based on timeline
    if (this.data && this.changeDetector.hasChanged('progress', progress)) {
      this.updateFlightTime(progress, currentTime);
      this.changeDetector.update('progress', progress);
    }

    // Update radar visibility
    if (this.radarLayer) {
      if (showRadar && !this.map.hasLayer(this.radarLayer)) {
        this.map.addLayer(this.radarLayer);
      } else if (!showRadar && this.map.hasLayer(this.radarLayer)) {
        this.map.removeLayer(this.radarLayer);
      }
    }
  }

  /**
   * Load flight track data
   */
  loadFlightTrack(trackData) {
    this.data = trackData.map(entry => ({
      Time: new Date(entry.time || entry.Time),
      latitude: entry.latitude,
      longitude: entry.longitude
    }));

    // console.log('[FlightMapStore] Loaded track data:', this.data.length, 'points'); // DEBUG

    if (!this.planeMarker) {
      this.initializePlaneMarker();
    } else {
      // Reset to start
      this.planeMarker.setLatLng([this.data[0].latitude, this.data[0].longitude]);
      this.planePath.setLatLngs([[this.data[0].latitude, this.data[0].longitude]]);
    }

    this.fitMapBounds();
  }

  /**
   * Initialize plane marker and path
   */
  initializePlaneMarker() {
    if (!this.data || this.data.length === 0) {
      console.warn('[FlightMapStore] No data for plane marker');
      return;
    }

    const planeIcon = L.icon({
      iconUrl: this.planeIconPNG,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: 'plane-icon'
    });

    this.planeMarker = L.marker(
      [this.data[0].latitude, this.data[0].longitude],
      { icon: planeIcon }
    ).addTo(this.map);

    this.planePath = L.polyline([], { color: 'red' }).addTo(this.map);

    // console.log('[FlightMapStore] Plane marker initialized'); // DEBUG
  }

  /**
   * Update plane position based on timeline progress
   */
  updateFlightTime(progress, dataTime) {
    if (!this.data || this.data.length === 0 || !this.planeMarker) {
      return;
    }

    // Calculate index based on progress
    const index = Math.floor(progress * (this.data.length - 1));
    const clampedIndex = Math.max(0, Math.min(index, this.data.length - 1));

    const point = this.data[clampedIndex];

    // Update marker position
    this.planeMarker.setLatLng([point.latitude, point.longitude]);

    // Update path (show path up to current position)
    const pathCoords = this.data
      .slice(0, clampedIndex + 1)
      .map(d => [d.latitude, d.longitude]);
    this.planePath.setLatLngs(pathCoords);

    // Update radar if enabled
    if (dataTime) {
      this.updateRadarLayer(dataTime);
    }
  }

  /**
   * Fit map bounds to flight track
   */
  fitMapBounds() {
    if (!this.data || this.data.length === 0) {
      console.warn('[FlightMapStore] No data for fitBounds');
      return;
    }

    if (!this.map || !this.map.getContainer()) {
      console.warn('[FlightMapStore] Map not ready for fitBounds');
      return;
    }

    try {
      const bounds = L.latLngBounds(this.data.map(d => [d.latitude, d.longitude]));
      const bufferedBounds = bounds.pad(1 / 111);
      this.map.fitBounds(bufferedBounds);
      this.map.setMaxBounds(bufferedBounds);
    } catch (error) {
      console.warn('[FlightMapStore] Error fitting bounds:', error.message);
      // Retry after delay
      setTimeout(() => {
        try {
          if (this.map && this.map.getContainer()) {
            const bounds = L.latLngBounds(this.data.map(d => [d.latitude, d.longitude]));
            const bufferedBounds = bounds.pad(1 / 111);
            this.map.fitBounds(bufferedBounds);
            this.map.setMaxBounds(bufferedBounds);
          }
        } catch (retryError) {
          console.error('[FlightMapStore] Failed to fit bounds after retry:', retryError);
        }
      }, 100);
    }
  }

  /**
   * Add NEXRAD radar layer
   */
  addRadarLayer() {
    // Use the same WMS configuration as original FlightMap
    const wmsTime = this.formatWMSTime(new Date());

    this.radarLayer = L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
      layers: 'nexrad-n0r-900913',
      format: 'image/png',
      transparent: true,
      opacity: 0.7,
      attribution: 'NEXRAD data © NOAA/NWS',
      time: wmsTime
    });

    // Add to map if radar is enabled
    const state = this.getState();
    if (isRadarEnabled(state)) {
      this.radarLayer.addTo(this.map);
      // console.log('[FlightMapStore] Radar layer added to map with time:', wmsTime);
    } 
    // else {
    //   // console.log('[FlightMapStore] Radar layer created but not added (disabled)');
    // }
  }

  /**
   * Format time for WMS timestamp parameter
   */
  formatWMSTime(date) {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:00Z`;
  }

  /**
   * Update radar layer timestamp
   */
  updateRadarLayer(dataTime) {
    if (!this.radarLayer || !this.map.hasLayer(this.radarLayer)) return;

    // Format time for WMS
    const wmsTime = this.formatWMSTime(dataTime);

    // Only update if the timestamp has changed
    if (wmsTime === this.lastRadarTimestamp) {
      return;
    }

    this.lastRadarTimestamp = wmsTime;

    // Update WMS time parameter
    this.radarLayer.setParams({ time: wmsTime }, false);

    // console.log('[FlightMapStore] Updated radar layer time:', wmsTime); // DEBUG
  }

  /**
   * Cleanup
   */
  destroy() {
    // console.log('[FlightMapStore] Destroying'); // DEBUG

    // Remove map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Disconnect from store
    super.destroy();
  }
}
