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
  isRadarEnabled,
  getMapLayers
} from '../store/selectors/selectors.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';

/**
 * Weather layer configuration
 * Currently only have nexrad showing. Other radars are only for realtime displays (as far as I know) */
const WEATHER_LAYERS = {
  glm: {
    id: 'glm',
    name: 'Lightning (GLM)',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_east.cgi',
    layer: 'fulldisk_glm_mfa',
    opacity: 0.7,
    timeEnabled: false
  },
  mrms: {
    id: 'mrms',
    name: 'MRMS Radar (Current)',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/us/mrms.cgi',
    layer: 'mrms_cref',
    opacity: 0.6,
    timeEnabled: false  // Real-time only; archived MRMS available via TMS service
  },
  goesVisible: {
    id: 'goesVisible',
    name: 'GOES Visible',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_east.cgi',
    layer: 'conus_ch02',
    opacity: 0.5,
    timeEnabled: false  // Real-time only; GOES is continuously updated
  },
  goesIR: {
    id: 'goesIR',
    name: 'GOES IR',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_east.cgi',
    layer: 'conus_ch13',
    opacity: 0.5,
    timeEnabled: false  // Real-time only; GOES is continuously updated
  },
  nexrad: {
    id: 'nexrad',
    name: 'NEXRAD Mosaic',
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r-t.cgi',
    layer: 'nexrad-n0r-wmst',
    opacity: 0.7,
    timeEnabled: true,
    isGeoTIFF: false  // Use time-enabled WMS archive (1995-present)
  }
};

export default class FlightMapStore extends IComponent {
  constructor(mapId, store) {
    super(store);

    this.mapId = mapId;
    this.map = L.map(mapId, {
      maxZoom: 18,
      minZoom: 3,
      zoomControl: false
    }).setView([0, 0], 2);

    //add scale control
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    

    this.planeIconPNG = 'icons/plane.svg';
    this.planePath = null;
    this.planeMarker = null;
    this.data = null;
    this.weatherLayers = {};  // Map of layerId -> L.tileLayer.wms instance
    this.lastLayerTimestamps = {};  // Map of layerId -> last WMS timestamp
    this.lastLayerUpdateTime = {};  // Track when each layer was last updated
    this.layerUpdateThrottleMs = 3000;  // Minimum 3 seconds between layer updates

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      flightId: null,
      progress: null,
      data: null,
      layers: null
    });

    // Initialize map
    this.initMap();
    this.initWeatherLayers();

    // Connect to store and initialize
    this.connect();
    this.onStateChange(this.getState());

    console.log('[FlightMapStore] Created');
  }

  /**
   * Initialize base map layers
   */
  initMap() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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
    const layers = getMapLayers(state);

    // Check if flight data changed
    if (flightData && flightData.track && this.changeDetector.hasChanged('data', flightData.track)) {
      // console.log('[FlightMapStore] Loading new flight track:', flightId); // DEBUG
      this.loadFlightTrack(flightData.track, flightData.timeseries);
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

    // Sync weather layer visibility with store state
    this.syncLayerVisibility(layers);
  }

  /**
   * Load flight track data and merge with THDG from timeseries
   */
  loadFlightTrack(trackData, timeseriesData) {
    // Log first entry to see available fields
    if (trackData.length > 0) {
      console.log('[FlightMapStore] Track data sample (first entry):', trackData[0]);
      console.log('[FlightMapStore] Available track fields:', Object.keys(trackData[0]));
    }
    
    // Create a map of time -> THDG from timeseries data
    const thdgMap = new Map();
    if (timeseriesData && timeseriesData.length > 0) {
      console.log('[FlightMapStore] Timeseries sample:', timeseriesData[0]);
      timeseriesData.forEach(entry => {
        if (entry.thdg !== undefined && entry.thdg !== null) {
          const timeKey = entry.Time.getTime();
          thdgMap.set(timeKey, entry.thdg);
        }
      });
      console.log('[FlightMapStore] Found THDG values in timeseries:', thdgMap.size);
    }
    
    this.data = trackData.map(entry => {
      const time = new Date(entry.time || entry.Time);
      const thdg = thdgMap.get(time.getTime());
      
      return {
        Time: time,
        latitude: entry.latitude,
        longitude: entry.longitude,
        THDG: thdg
      };
    });

    console.log('[FlightMapStore] Loaded track data:', this.data.length, 'points');
    console.log('[FlightMapStore] First point THDG:', this.data[0].THDG);
    console.log('[FlightMapStore] Points with THDG:', this.data.filter(p => p.THDG !== undefined).length);

    if (!this.planeMarker) {
      this.initializePlaneMarker();
    } else {
      // Reset to start
      this.planeMarker.setLatLng([this.data[0].latitude, this.data[0].longitude]);
      this.planePath.setLatLngs([[this.data[0].latitude, this.data[0].longitude]]);
    }

    this.fitMapBounds();

    // Reset all layer timestamps so they refresh with new flight
    this.lastLayerTimestamps = {};

    // Update time-enabled layers with the flight's starting time
    if (this.data.length > 0 && this.data[0].Time) {
      console.log('[FlightMapStore] Updating layers with flight start time:', this.data[0].Time);
      this.updateTimeEnabledLayers(this.data[0].Time);
    }
  }

  /**
   * Initialize plane marker and path
   */
  initializePlaneMarker() {
    if (!this.data || this.data.length === 0) {
      console.warn('[FlightMapStore] No data for plane marker');
      return;
    }

    // Use divIcon to embed SVG directly for color control
    const planeIcon = L.divIcon({
      html: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;">
        <path d="M14 8.94737 22 14v2l-8 -2.5263v5.3596L17 20.5V22l-4.5 -1L8 22v-1.5l3 -1.6667v-5.3596L3 16v-2l8 -5.05263V3.5c0 -0.82843 0.6716 -1.5 1.5 -1.5s1.5 0.67157 1.5 1.5v5.44737Z" fill="white" stroke-width="1"/>
      </svg>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      className: 'plane-icon'
    });

    this.planeMarker = L.marker(
      [this.data[0].latitude, this.data[0].longitude],
      { 
        icon: planeIcon,
        rotationAngle: 0,
        rotationOrigin: 'center center'
      }
    ).addTo(this.map);

    this.planePath = L.polyline([], { color: 'red' }).addTo(this.map);
    
    // Store current rotation angle
    this.currentRotation = 0;

    // Icon is ready immediately since it's a divIcon with inline SVG
    setTimeout(() => {
      this.iconReady = true;
      console.log('[FlightMapStore] Plane icon ready for rotation');
    }, 100);

    console.log('[FlightMapStore] Plane marker initialized');
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

    // Use heading (THDG) from data to rotate plane icon
    if (point.THDG !== undefined && point.THDG !== null) {
      console.log('[FlightMapStore] Rotating plane to heading:', point.THDG);
      // Use setTimeout to ensure marker has been positioned first
      setTimeout(() => {
        this.rotatePlaneIcon(point.THDG);
      }, 0);
    } else {
      console.log('[FlightMapStore] No THDG data available at index:', clampedIndex);
    }

    // Update path (show path up to current position)
    const pathCoords = this.data
      .slice(0, clampedIndex + 1)
      .map(d => [d.latitude, d.longitude]);
    this.planePath.setLatLngs(pathCoords);

    // Update time-enabled layers (NEXRAD, MRMS)
    // Use the actual data point time if dataTime is not available
    const timeForLayers = dataTime || this.data[clampedIndex]?.Time;
    if (timeForLayers) {
      this.updateTimeEnabledLayers(timeForLayers);
    } else {
      console.log('[FlightMapStore] No time available for layers, dataTime:', dataTime, 'index:', clampedIndex);
    }
  }

  /**
   * Calculate bearing between two points
   * Returns angle in degrees (0 = North, 90 = East, 180 = South, 270 = West)
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    // Convert to radians
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    // Calculate bearing
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const θ = Math.atan2(y, x);
    
    // Convert to degrees and normalize to 0-360
    const bearing = (θ * 180 / Math.PI + 360) % 360;
    
    return bearing;
  }

  /**
   * Rotate plane icon to face the direction based on heading (THDG)
   * Icon is drawn facing north (0°), so we apply heading directly.
   */
  rotatePlaneIcon(heading) {
    console.log('[FlightMapStore] rotatePlaneIcon called with heading:', heading, 'iconReady:', this.iconReady);

    if (!this.planeMarker || !this.iconReady) {
      console.log('[FlightMapStore] Rotation skipped - marker or iconReady not ready');
      return;
    }

    const markerElement = this.planeMarker.getElement();
    if (!markerElement) {
      console.log('[FlightMapStore] No marker element found');
      return;
    }

    const svgElement = markerElement.querySelector('svg');
    if (!svgElement) {
      if (!this.loggedWarning) {
        console.warn('[FlightMapStore] SVG element not found. HTML:', markerElement.outerHTML);
        this.loggedWarning = true;
      }
      return;
    }

    console.log('[FlightMapStore] Applying rotation:', heading, 'degrees');
    svgElement.style.transform = `rotate(${heading}deg)`;
    svgElement.style.transformOrigin = 'center center';
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
   * Initialize all weather layers
   * Creates WMS tile layers for each configured weather layer
   */
  initWeatherLayers() {
    const state = this.getState();
    const layerVisibility = getMapLayers(state);

    // Create a layer for each configured weather layer
    Object.entries(WEATHER_LAYERS).forEach(([layerId, config]) => {
      const wmsTime = this.formatWMSTime(new Date());
      
      const layer = L.tileLayer.wms(config.url, {
        layers: config.layer,
        format: 'image/png',
        transparent: true,
        opacity: config.opacity,
        attribution: 'Weather data © NOAA/NWS via Iowa State IEM',
        time: config.timeEnabled ? wmsTime : undefined,
        version: '1.1.1'
      });

      this.weatherLayers[layerId] = layer;

      // Add to map if layer is enabled in store
      if (layerVisibility[layerId]) {
        layer.addTo(this.map);
        console.log(`[FlightMapStore] Weather layer '${config.name}' added to map`);
      }
    });

    console.log('[FlightMapStore] Weather layers initialized:', Object.keys(this.weatherLayers));
  }

  /**
   * Sync layer visibility with Redux store state
   * @param {Object} layers - Map of layerId to visibility boolean from store
   */
  syncLayerVisibility(layers) {
    Object.entries(layers).forEach(([layerId, visible]) => {
      const layer = this.weatherLayers[layerId];
      const config = WEATHER_LAYERS[layerId];
      
      if (!config) return;
      if (!layer) return;

      const isOnMap = this.map.hasLayer(layer);

      if (visible && !isOnMap) {
        this.map.addLayer(layer);
        console.log(`[FlightMapStore] Layer '${layerId}' added to map`);
      } else if (!visible && isOnMap) {
        this.map.removeLayer(layer);
        console.log(`[FlightMapStore] Layer '${layerId}' removed from map`);
      }
    });
  }

  /**
   * Get radar timestamp in YYYYMMDDHHMM format for GeoTIFF service
   * Rounds to nearest 5-minute interval as radar data is only available at modulo 5
   */
  getRadarTimestamp(date) {
    const d = date ? new Date(date) : new Date();
    // Round to nearest 5 minutes
    const minutes = Math.floor(d.getMinutes() / 5) * 5;
    return d.getUTCFullYear() +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCDate()).padStart(2, '0') +
      String(d.getUTCHours()).padStart(2, '0') +
      String(minutes).padStart(2, '0');
  }

  /**
   * Format time for WMS timestamp parameter
   */
formatWMSTime(date) {
    if (!date) return "";
    
    // Round to nearest 5 minutes
    const d = new Date(date);
    const minutes = Math.floor(d.getMinutes() / 5) * 5;
    d.setMinutes(minutes);
    d.setSeconds(0);
    
    // Format as ISO string without milliseconds (YYYY-MM-DDTHH:MM:SSZ)
    return d.toISOString().split('.')[0] + 'Z';
}

  /**
   * Update time-enabled weather layers (NEXRAD, MRMS) with current timestamp
   * Handles both WMS and GeoTIFF services
   * @param {Date} dataTime - Current time from timeline
   */
  updateTimeEnabledLayers(dataTime) {
    if (!dataTime) {
      console.log('[FlightMapStore] updateTimeEnabledLayers called with no dataTime');
      return;
    }

    const state = this.getState();
    const layerVisibility = getMapLayers(state);

    // Update each time-enabled layer that is currently visible
    Object.entries(WEATHER_LAYERS).forEach(([layerId, config]) => {
      if (!config.timeEnabled) return;
      if (!layerVisibility[layerId]) return;

      this.updateWMSLayer(layerId, config, dataTime);
    });
  }

  /**
   * Update a WMS-based layer with current timestamp
   * @param {string} layerId - Layer ID
   * @param {Object} config - Layer configuration
   * @param {Date} dataTime - Current time from timeline
   */
  updateWMSLayer(layerId, config, dataTime) {
    const wmsTime = this.formatWMSTime(dataTime);

    // Skip if timestamp hasn't changed
    if (wmsTime === this.lastLayerTimestamps[layerId]) {
      return;
    }

    console.log(`[FlightMapStore] Updating WMS '${layerId}' to ${wmsTime}`);
    this.lastLayerTimestamps[layerId] = wmsTime;

    const oldLayer = this.weatherLayers[layerId];

    // Remove old layer completely
    if (oldLayer && this.map.hasLayer(oldLayer)) {
      this.map.removeLayer(oldLayer);
      // Clear the layer's internal tile cache
      if (oldLayer._tiles) {
        Object.keys(oldLayer._tiles).forEach(key => {
          const tile = oldLayer._tiles[key];
          if (tile.el) {
            tile.el.src = '';
          }
        });
      }
    }

    // Create new WMS layer with updated time and cache buster
    const cacheBuster = Date.now();
    const newLayer = L.tileLayer.wms(config.url, {
      layers: config.layer,
      format: 'image/png',
      transparent: true,
      opacity: config.opacity,
      attribution: 'Weather data © NOAA/NWS via Iowa State IEM',
      time: wmsTime,
      version: '1.1.1',
      _cacheBuster: cacheBuster
    });

    // Override getTileUrl to add cache buster
    const originalGetTileUrl = newLayer.getTileUrl;
    newLayer.getTileUrl = function(coords) {
      const url = originalGetTileUrl.call(this, coords);
      return url + (url.includes('?') ? '&' : '?') + '_=' + cacheBuster;
    };

    // Store and add new layer to map
    this.weatherLayers[layerId] = newLayer;
    newLayer.addTo(this.map);
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