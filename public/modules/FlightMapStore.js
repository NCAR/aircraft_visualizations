/**
 * FlightMap - Store-connected version
 * Unified component for both dashboard and realtime modes
 * Uses same store, switches data source based on current page
 */

import { IComponent } from '../interfaces/IComponent.js';
import {
  getCurrentPageData,
  getCurrentFlightId,
  getTimelineProgress,
  getCurrentTime,
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
  /**
   * @param {string} mapId - ID of the map container element
   * @param {Store} store - Redux store instance
   * @param {string|null} pageContext - Page context ('dashboard' or 'realtime')
   */
  constructor(mapId, store, pageContext = null) {
    super(store, pageContext);

    this.mapId = mapId;
    this.map = new maplibregl.Map({
      container: mapId,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
        },
        layers: [{
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark'
        }]
      },
      center: [0, 0],
      zoom: 2,
      maxZoom: 18,
      minZoom: 3
    });

    // Add navigation controls
    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-left');

    // Custom control: center on current plane position
    const centerControl = {
      onAdd: () => {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'center-plane-btn';
        button.title = 'Center map on plane'; // Native tooltip
        button.innerHTML = '<i class="fas fa-location-arrow"></i>';
        button.addEventListener('click', () => this.centerOnPlane());

        // Custom tooltip (shown on hover) for instructions
        const tooltip = document.createElement('span');
        tooltip.className = 'center-plane-tooltip';
        tooltip.textContent = 'Center plane';
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.left = '110%';
        tooltip.style.top = '50%';
        tooltip.style.transform = 'translateY(-50%)';
        tooltip.style.background = 'rgba(0,0,0,0.8)';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '4px 8px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.zIndex = '100';

        button.addEventListener('mouseenter', () => { tooltip.style.display = 'block'; });
        button.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

        button.style.position = 'relative';
        button.appendChild(tooltip);
        container.appendChild(button);
        return container;
      },
      onRemove: () => {}
    };
    this.map.addControl(centerControl, 'bottom-left');

    

    this.planeIconPNG = 'icons/plane.svg';
    this.planePath = null;
    this.planeMarker = null;
    this.data = null;
    this.weatherLayers = {};  // Map of layerId -> source/layer names
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

    // Wait for map to load before initializing layers
    this.map.on('load', () => {
      this.initWeatherLayers();
      
      // Connect to store and initialize after map is loaded
      this.connect();
      this.onStateChange(this.getState());
    });

    console.log('[FlightMapStore] Created');
  }

  /**
   * Initialize base map layers - now handled in map style
   */
  initMap() {
    // Base layer is now part of the map style, no additional setup needed
  }

  /**
   * Center map on current plane position
   */
  centerOnPlane() {
    if (!this.map) return;

    const hasData = this.data && this.data.length > 0;
    const hasMarker = this.planeMarker !== null;

    if (!hasData && !hasMarker) {
      console.warn('[FlightMapStore] No plane position to center on');
      return;
    }

    // Prefer marker position if it exists; fallback to first data point
    const lngLat = hasMarker
      ? this.planeMarker.getLngLat()
      : { lng: this.data[0].longitude, lat: this.data[0].latitude };

    this.map.easeTo({ center: [lngLat.lng, lngLat.lat] });
  }

  /**
   * Handle store state changes
   * Works for both dashboard (with flight data) and realtime (with timeseries data)
   */
  onStateChange(state) {
    const pageData = getCurrentPageData(state, this.pageContext);
    const progress = getTimelineProgress(state);
    const currentTime = getCurrentTime(state);
    const layers = getMapLayers(state);

    // Check if we're in realtime mode - use pageContext instead of router
    const isRealtime = this.pageContext === 'realtime';

    // For realtime, we use timeseries data as track; for dashboard, we use track field
    const trackData = isRealtime ? pageData?.timeseries : pageData?.track;

    // Check if flight/page data changed
    if (pageData && trackData && this.changeDetector.hasChanged('data', trackData)) {
      console.log(`[FlightMapStore] Loading new ${isRealtime ? 'realtime' : 'flight'} track:`, trackData.length, 'points');
      this.loadFlightTrack(trackData, pageData.timeseries, isRealtime);
      this.changeDetector.updateAll({
        data: trackData
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
   * Load flight track data
   * @param {Array} trackData - Either flight track or timeseries points
   * @param {Array} timeseriesData - Full timeseries data (used for THDG in dashboard mode)
   * @param {Boolean} isRealtime - Whether we're in realtime mode
   */
  loadFlightTrack(trackData, timeseriesData, isRealtime = false) {
    // Log first entry to see available fields
    if (trackData.length > 0) {
      console.log('[FlightMapStore] Track data sample (first entry):', JSON.stringify(trackData[0]));
      console.log('[FlightMapStore] Available track fields:', Object.keys(trackData[0]));
      console.log('[FlightMapStore] Is realtime?', isRealtime);
    } else {
      console.warn('[FlightMapStore] Empty trackData passed to loadFlightTrack, isRealtime=' + isRealtime);
      if (timeseriesData && timeseriesData.length > 0) {
        console.log('[FlightMapStore] Timeseries data sample:', JSON.stringify(timeseriesData[0]));
      }
      return;
    }
    
    // Filter out bad data points (realtime uses -32767 as fill value for missing data)
    const FILL_VALUE = -32767;
    const goodTrackData = trackData.filter(entry => {
      const lat = entry.latitude || entry.gglat;
      const lon = entry.longitude || entry.gglon;
      // Keep only points with valid lat/lon that aren't the fill value
      return lat !== undefined && lat !== null && lat !== FILL_VALUE &&
             lon !== undefined && lon !== null && lon !== FILL_VALUE;
    });
    
    if (goodTrackData.length === 0) {
      console.warn('[FlightMapStore] All track data filtered out (no valid coordinates)');
      return;
    }
    
    console.log('[FlightMapStore] Filtered track data from', trackData.length, 'to', goodTrackData.length, 'points');
    
    // Use filtered data for processing
    const processedTrackData = goodTrackData;
    // Create a map of time -> THDG from timeseries data (dashboard mode)
    // In realtime mode, timeseries IS trackData, so THDG comes directly from it
    const thdgMap = new Map();
    if (!isRealtime && timeseriesData && timeseriesData.length > 0) {
      console.log('[FlightMapStore] (Dashboard) Extracting THDG from timeseries...');
      timeseriesData.forEach(entry => {
        if (entry.thdg !== undefined && entry.thdg !== null) {
          const timeKey = entry.Time.getTime();
          thdgMap.set(timeKey, entry.thdg);
        }
      });
    } else if (isRealtime) {
      console.log('[FlightMapStore] (Realtime) THDG included in track data');
    }
    
    this.data = processedTrackData.map((entry, idx) => {
      // Handle different time field names
      let time;
      if (entry.Time instanceof Date) {
        time = entry.Time;
      } else if (typeof entry.Time === 'string' || typeof entry.Time === 'number') {
        time = new Date(entry.Time);
      } else if (entry.datetime) {
        time = new Date(entry.datetime);
      } else if (entry.time) {
        time = new Date(entry.time);
      } else {
        time = new Date();
      }
      
      // Extract latitude - try multiple field names (gglat for realtime, latitude for dashboard)
      let latitude = entry.latitude || entry.gglat || entry.lat || entry.LAT || entry.Latitude;
      if (latitude !== undefined && latitude !== null) {
        latitude = parseFloat(latitude);
      }
      
      // Extract longitude - try multiple field names (gglon for realtime, longitude for dashboard)
      let longitude = entry.longitude || entry.gglon || entry.lon || entry.LON || entry.Longitude;
      if (longitude !== undefined && longitude !== null) {
        longitude = parseFloat(longitude);
      }
      
      // Log if we're missing coordinates
      if ((isNaN(latitude) || isNaN(longitude)) && idx === 0) {
        console.warn('[FlightMapStore] Missing coordinates in first entry. Available fields:', Object.keys(entry));
        console.warn('[FlightMapStore] Extracted: lat=' + latitude + ', lon=' + longitude);
      }
      
      // Get THDG - either from lookup table (dashboard) or directly from data (realtime)
      // Realtime field: thdg, Dashboard field: THDG
      const thdg = thdgMap.get(time.getTime()) || entry.thdg || entry.THDG || null;
      
      return {
        Time: time,
        latitude: latitude || 0,
        longitude: longitude || 0,
        THDG: thdg
      };
    });

    console.log('[FlightMapStore] Loaded track data:', this.data.length, 'points');
    if (this.data.length > 0) {
      // console.log('[FlightMapStore] First point:', this.data[0]);
      // console.log('[FlightMapStore] First point coords: lat=' + this.data[0].latitude + ', lon=' + this.data[0].longitude);
      const validLats = this.data.filter(p => !isNaN(p.latitude) && p.latitude >= -90 && p.latitude <= 90);
      const validLons = this.data.filter(p => !isNaN(p.longitude) && p.longitude >= -180 && p.longitude <= 180);
      // console.log('[FlightMapStore] Valid latitude points:', validLats.length, 'of', this.data.length);
      // console.log('[FlightMapStore] Valid longitude points:', validLons.length, 'of', this.data.length);
    }

    // For realtime, position plane at latest (last) point; for dashboard, start at beginning
    const initialIndex = isRealtime ? this.data.length - 1 : 0;
    const initialPoint = this.data[initialIndex];

    if (!this.planeMarker) {
      this.initializePlaneMarker(initialIndex);
    } else {
      // Reset to start (or end for realtime)
      this.planeMarker.setLngLat([initialPoint.longitude, initialPoint.latitude]);
      if (initialPoint.THDG !== undefined && initialPoint.THDG !== null) {
        this.planeMarker.setRotation(initialPoint.THDG);
      }
    }

    // Update flight path to full track immediately so it is visible before timeline moves
    const fullPathCoords = this.data.map(d => [d.longitude, d.latitude]);
    const pathSource = this.map.getSource('flight-path');
    if (pathSource) {
      pathSource.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: fullPathCoords
        }
      });
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
   * @param {number} initialIndex - Index to position the plane at (default 0)
   */
  initializePlaneMarker(initialIndex = 0) {
    if (!this.data || this.data.length === 0) {
      console.warn('[FlightMapStore] No data for plane marker');
      return;
    }

    const initialPoint = this.data[initialIndex];

    // Create HTML element for plane marker with embedded SVG
    const el = document.createElement('div');
    el.className = 'plane-marker';
    el.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;">
      <defs>
        <filter id="planeShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="#FAA119" flood-opacity="0.4" />
        </filter>
      </defs>
      <g filter="url(#planeShadow)">
        <path d="M14 8.94737 22 14v2l-8 -2.5263v5.3596L17 20.5V22l-4.5 -1L8 22v-1.5l3 -1.6667v-5.3596L3 16v-2l8 -5.05263V3.5c0 -0.82843 0.6716 -1.5 1.5 -1.5s1.5 0.67157 1.5 1.5v5.44737Z" fill="white" stroke-width="1" />
      </g>
    </svg>`;

    this.planeMarker = new maplibregl.Marker({
      element: el,
      anchor: 'center',
      rotationAlignment: 'map',
      pitchAlignment: 'map'
    })
      .setLngLat([initialPoint.longitude, initialPoint.latitude])
      .addTo(this.map);

    // Set initial rotation if available
    if (initialPoint.THDG !== undefined && initialPoint.THDG !== null) {
      this.planeMarker.setRotation(initialPoint.THDG);
    }

    // Add flight path as a GeoJSON line source (initialize with full path)
    const fullPathCoords = this.data.map(d => [d.longitude, d.latitude]);
    this.map.addSource('flight-path', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: fullPathCoords
        }
      }
    });

    this.map.addLayer({
      id: 'flight-path-layer',
      type: 'line',
      source: 'flight-path',
      paint: {
        'line-color': '#dc8b12',
        'line-width': 2
      }
    });
    
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
    this.planeMarker.setLngLat([point.longitude, point.latitude]);

    // Use heading (THDG) from data to rotate plane icon
    if (point.THDG !== undefined && point.THDG !== null) {
      this.planeMarker.setRotation(point.THDG);
    } else {
      //console.log('[FlightMapStore] No THDG data available at index:', clampedIndex);
    }

    // Update path (show path up to current position)
    const pathCoords = this.data
      .slice(0, clampedIndex + 1)
      .map(d => [d.longitude, d.latitude]);
    
    const pathSource = this.map.getSource('flight-path');
    if (pathSource) {
      pathSource.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: pathCoords
        }
      });
    }

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
   * Fit map bounds to flight track
   */
  fitMapBounds() {
    if (!this.data || this.data.length === 0) {
      console.warn('[FlightMapStore] No data for fitBounds');
      return;
    }

    // Check if we have valid coordinates
    const validCoords = this.data.filter(d => 
      !isNaN(d.latitude) && !isNaN(d.longitude) &&
      d.latitude >= -90 && d.latitude <= 90 &&
      d.longitude >= -180 && d.longitude <= 180
    );

    if (validCoords.length === 0) {
      console.warn('[FlightMapStore] No valid coordinates to fit bounds');
      return;
    }

    // Check if map and style are loaded; if not, wait for idle once
    if (!this.map || !this.map.isStyleLoaded()) {
      if (!this.waitingForMapLoad) {
        this.waitingForMapLoad = true;
        this.map.once('idle', () => {
          this.waitingForMapLoad = false;
          this.fitMapBounds();
        });
      }
      return;
    }

    try {
      // Calculate bounds from valid data points only
      const coords = validCoords.map(d => [d.longitude, d.latitude]);
      const bounds = coords.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new maplibregl.LngLatBounds(coords[0], coords[0]));

      this.map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    } catch (error) {
      console.warn('[FlightMapStore] Error fitting bounds:', error.message);
      // Retry after delay
      setTimeout(() => {
        try {
          if (this.map && this.map.isStyleLoaded()) {
            const validCoords2 = this.data.filter(d => 
              !isNaN(d.latitude) && !isNaN(d.longitude) &&
              d.latitude >= -90 && d.latitude <= 90 &&
              d.longitude >= -180 && d.longitude <= 180
            );
            if (validCoords2.length > 0) {
              const coords = validCoords2.map(d => [d.longitude, d.latitude]);
              const bounds = coords.reduce((bounds, coord) => {
                return bounds.extend(coord);
              }, new maplibregl.LngLatBounds(coords[0], coords[0]));

              this.map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 15
              });
            }
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
      
      // Build WMS tile URL template for MapLibre
      // MapLibre will replace {bbox-epsg-3857} with actual bbox values
      const params = [
        'SERVICE=WMS',
        'VERSION=1.1.1',
        'REQUEST=GetMap',
        'FORMAT=image/png',
        'TRANSPARENT=true',
        `LAYERS=${config.layer}`,
        'SRS=EPSG:3857',
        'WIDTH=256',
        'HEIGHT=256',
        'BBOX={bbox-epsg-3857}'
      ];
      
      if (config.timeEnabled && wmsTime) {
        params.push(`TIME=${wmsTime}`);
      }

      const tileUrl = config.url + '?' + params.join('&');

      // Add source to map
      this.map.addSource(layerId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256
      });

      // Add layer to map
      this.map.addLayer({
        id: layerId,
        type: 'raster',
        source: layerId,
        paint: {
          'raster-opacity': config.opacity
        },
        layout: {
          visibility: layerVisibility[layerId] ? 'visible' : 'none'
        }
      });

      this.weatherLayers[layerId] = { sourceId: layerId, layerId: layerId };
      
      if (layerVisibility[layerId]) {
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
      const config = WEATHER_LAYERS[layerId];
      
      if (!config) return;
      if (!this.map.getLayer(layerId)) return;

      this.map.setLayoutProperty(
        layerId, 
        'visibility', 
        visible ? 'visible' : 'none'
      );
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

    // Remove old source and layer
    if (this.map.getLayer(layerId)) {
      this.map.removeLayer(layerId);
    }
    if (this.map.getSource(layerId)) {
      this.map.removeSource(layerId);
    }

    // Build WMS URL with parameters including updated time
    const cacheBuster = Date.now();
    const params = [
      'SERVICE=WMS',
      'VERSION=1.1.1',
      'REQUEST=GetMap',
      'FORMAT=image/png',
      'TRANSPARENT=true',
      `LAYERS=${config.layer}`,
      'SRS=EPSG:3857',
      'WIDTH=256',
      'HEIGHT=256',
      'BBOX={bbox-epsg-3857}',
      `TIME=${wmsTime}`,
      `_=${cacheBuster}`
    ];

    const tileUrl = config.url + '?' + params.join('&');

    // Add source back to map with updated time
    this.map.addSource(layerId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256
    });

    // Add layer back to map
    this.map.addLayer({
      id: layerId,
      type: 'raster',
      source: layerId,
      paint: {
        'raster-opacity': config.opacity
      },
      layout: {
        visibility: 'visible'
      }
    });

    this.weatherLayers[layerId] = { sourceId: layerId, layerId: layerId };
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