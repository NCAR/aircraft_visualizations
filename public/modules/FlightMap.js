import { fetchFlightTrack } from './loadData.js';

export default class FlightMap {
    constructor(mapId, project, flight) {
        this.map = L.map(mapId, {
            maxZoom: 18, // Set the maximum zoom level
            minZoom: 3, // Set the minimum zoom level
        }).setView([0, 0], 2);
        this.project = project;
        this.flight = flight;
        this.planeIconPNG = 'icons/plane.png';
        this.planePath;
        this.planeMarker;
        this.curTime;
        this.radarLayer = null;
        this.showRadar = true;
        this.initMap();
        this.loadFlightData(this.flight);
        this.addRadarLayer();
        this.lastRadarTimestamp = null; // Store the last radar timestamp,
     //   this.addLayerControls();
    }

    initMap() {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);
    }
    setProject(project) {
        this.project = project;
    }

    loadFlightData(flightId) {
        fetchFlightTrack(flightId)
            .then(data => {
                const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S.%LZ");    
                this.data = data.map(entry => ({
                    // Use new Date() directly on the ISO string for simplicity, 
                    // or keep the explicit parser if required by d3.
                    Time: new Date(entry.time),
                    // Since the API ensures these are numerical (in server.js), 
                    // direct assignment is fine.
                    latitude: entry.latitude, 
                    longitude: entry.longitude
                }));

                this.initializePlaneMarker();
                this.fitMapBounds();
            })
            .catch(error => {
                console.error('Error fetching the JSON file:', error);
            });
    }

    // Assuming this function is part of a FlightMap class or similar.
    updateFlightData(flightId) {
        // 1. Call the updated fetchFlightTrack, which uses the simplified SQL API.
        fetchFlightTrack(flightId)
            .then(data => {
                // 2. Parse the time string into a Date object (d3.utcParse is needed
                const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S.%LZ");
                this.data = data.map(entry => ({
                    // Use new Date() directly on the ISO string for simplicity,
                    // or keep the explicit parser if required by d3.
                    Time: new Date(entry.time), // Use capital T to match chart data
                    // Since the API ensures these are numerical (in server.js),
                    // direct assignment is fine.
                    latitude: entry.latitude,
                    longitude: entry.longitude
                }));
                
                // Only update markers/paths if they exist
                if (this.planeMarker && this.planePath && this.data.length > 0) {
                    // Reset plane position to start of new flight
                    this.planeMarker.setLatLng([this.data[0].latitude, this.data[0].longitude]);
                    this.planePath.setLatLngs([[this.data[0].latitude, this.data[0].longitude]]);
                }
                
                // Fit bounds with delay to ensure map is ready
                setTimeout(() => {
                    this.fitMapBounds();
                }, 100);
            })
            .catch(error => {
                console.error('Error fetching flight track data:', error);
            });
    }

    initializePlaneMarker() {
        const planeIcon = L.icon({
            iconUrl: this.planeIconPNG, // Replace with the path to your plane icon
            iconSize: [16, 16], // Size of the icon
            iconAnchor: [8, 8], // Point of the icon which will correspond to marker's location
            className: 'plane-icon' // Class name for styling the icon
        });

        this.planeMarker = L.marker([this.data[0].latitude, this.data[0].longitude], { icon: planeIcon }).addTo(this.map);
        this.planePath = L.polyline([], { color: 'red' }).addTo(this.map);
    }

    fitMapBounds() {
        if (!this.data || this.data.length === 0) {
            console.warn('No data available to fit map bounds');
            return;
        }
        
        // Check if map is properly initialized
        if (!this.map || !this.map.getContainer()) {
            console.warn('Map container not ready for fitBounds');
            return;
        }

        // Guard against Leaflet internal panes not being ready (e.g., after removal)
        const panes = this.map.getPanes ? this.map.getPanes() : null;
        if (!panes || !panes.mapPane) {
            console.warn('Map panes not ready for fitBounds');
            return;
        }

        try {
            const bounds = L.latLngBounds(this.data.map(d => [d.latitude, d.longitude]));
            const bufferedBounds = bounds.pad(1 / 111);
            this.map.fitBounds(bufferedBounds);
            this.map.setMaxBounds(bufferedBounds);
        } catch (error) {
            console.warn('Error fitting map bounds:', error.message);
            // Retry after a short delay
            setTimeout(() => {
                try {
                    if (this.map && this.map.getContainer()) {
                        const bounds = L.latLngBounds(this.data.map(d => [d.latitude, d.longitude]));
                        const bufferedBounds = bounds.pad(1 / 111);
                        this.map.fitBounds(bufferedBounds);
                        this.map.setMaxBounds(bufferedBounds);
                    }
                } catch (retryError) {
                    console.error('Failed to fit bounds after retry:', retryError);
                }
            }, 100);
        }
    }

    updateFlight(flight) {
        this.flight = flight;
        this.updateFlightData(this.flight);
        //this.updateTitle(flight);
    }

    updateTitle(flight) {
        const flightTextElement = document.querySelector('#video-title .font2');
        if (flightTextElement) {
            flightTextElement.textContent = flight;
        } else {
            console.warn('Flight title element not found');
        }
    }

    addRadarLayer() {
        // Use WMS service for NEXRAD radar instead of GeoTIFF
        const timestamp = this.getRadarTimestamp();

        // Format timestamp for WMS (different format than GeoTIFF request)
        const wmsTime = this.formatWMSTime(this.curTime || new Date());

        this.radarLayer = L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
            layers: 'nexrad-n0r-900913',
            format: 'image/png',
            transparent: true,
            opacity: 0.7,
            attribution: 'NEXRAD data © NOAA/NWS',
            time: wmsTime
        }).addTo(this.map);

        //console.log('Added radar layer with timestamp:', wmsTime);
    }

    // Update the updateRadarLayer method to use sequential fading
    updateRadarLayer() {
        if (this.showRadar) {
            // Format timestamp for WMS
            const wmsTime = this.formatWMSTime(this.curTime || new Date());
            //console.log('Current time for radar update:', this.curTime, 'Formatted WMS time:', wmsTime);

            // Only update if the timestamp has changed
            if (wmsTime !== this.lastRadarTimestamp) {
                //console.log('Updating radar layer. New timestamp:', wmsTime);

                // Create new layer with 0 opacity
                const newRadarLayer = L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
                    layers: 'nexrad-n0r-900913',
                    format: 'image/png',
                    transparent: true,
                    opacity: 0, // Start with 0 opacity
                    attribution: 'NEXRAD data © NOAA/NWS',
                    time: wmsTime
                }).addTo(this.map);

                // First wait for the new layer to load fully
                newRadarLayer.on('load', () => {
                    // Fade in the new layer
                    const fadeInNewLayer = (startTime) => {
                        const elapsed = Date.now() - startTime;
                        const duration = 100; // 500ms to fade in
                        const progress = Math.min(elapsed / duration, 1);

                        // Fade in new layer to full opacity
                        newRadarLayer.setOpacity(0.7 * progress);

                        if (progress < 1) {
                            // Continue animation until fully faded in
                            requestAnimationFrame(() => fadeInNewLayer(startTime));
                        } else {
                            // Once the new layer is fully visible, start fading out the old layer
                            if (this.radarLayer) {
                                const fadeOutOldLayer = (startTime) => {
                                    const elapsed = Date.now() - startTime;
                                    const duration = 200; // 500ms to fade out
                                    const progress = Math.min(elapsed / duration, 1);

                                    // Fade out old layer
                                    this.radarLayer.setOpacity(0.7 * (1 - progress));

                                    if (progress < 1) {
                                        // Continue animation
                                        requestAnimationFrame(() => fadeOutOldLayer(startTime));
                                    } else {
                                        // Animation complete - remove old layer
                                        this.map.removeLayer(this.radarLayer);
                                        this.radarLayer = newRadarLayer;
                                        this.lastRadarTimestamp = wmsTime;
                                    }
                                };

                                // Start the fade out animation
                                fadeOutOldLayer(Date.now());
                            } else {
                                // No old layer to fade out
                                this.radarLayer = newRadarLayer;
                                this.lastRadarTimestamp = wmsTime;
                            }
                        }
                    };

                    // Start the fade in animation
                    fadeInNewLayer(Date.now());
                });
            }
        }
    }

// Format time for WMS request (ISO format)
formatWMSTime(date) {
    if (!date) return "";
    
    // Round to nearest 5 minutes
    const d = new Date(date);
    const minutes = Math.floor(d.getMinutes() / 5) * 5;
    d.setMinutes(minutes);
    d.setSeconds(0);
    
    // Format as ISO string (YYYY-MM-DDTHH:MM:SSZ)
    return d.toISOString();
}

// Keep the existing getRadarTimestamp method for other uses if needed
getRadarTimestamp() {
    // If we have current time from the flight data, use it
    if (this.curTime) {
        // Format timestamp as YYYYMMDDHHMM (required by GeoTIFF service)
        const d = this.curTime;
        // Round to nearest 5 minutes as radar data is often in 5-min intervals
        const minutes = Math.floor(d.getMinutes() / 5) * 5;
        return d.getFullYear() +
            String(d.getMonth() + 1).padStart(2, '0') +
            String(d.getDate()).padStart(2, '0') +
            String(d.getHours()).padStart(2, '0') +
            String(minutes).padStart(2, '0');
    } else {
        // Use current time if no flight time is available
        const now = new Date();
        const minutes = Math.floor(now.getMinutes() / 5) * 5;
        return now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(minutes).padStart(2, '0');
    }
}
    // Modify the existing timeupdate event listener to update radar
/**
 * Updates the map (marker position, path, and layers) based on the corrected data time.
 * This method is called by the TimelineController, not the video's timeupdate event.
 * @param {number} progress - Progress value from 0 to 1
 * @param {Date} dataTime - The current time based on the continuous data timeline.
 */
    updateFlightTime(progress, dataTime) {
        if (!this.data || this.data.length === 0) {
            console.warn('FlightMap: No data available for updateFlightTime');
            return;
        }

        // Check if map and markers are initialized
        if (!this.map || !this.planeMarker || !this.planePath) {
            console.warn('FlightMap: Map or markers not initialized');
            return;
        }

        const totalDataPoints = this.data.length;
        const dataPointIndex = Math.floor(progress * totalDataPoints);

        // Ensure we have a valid index before proceeding
        if (dataPointIndex >= 0 && dataPointIndex < totalDataPoints) {
            const currentPoint = this.data[dataPointIndex];

            // Use capital T to match data structure
            if (!currentPoint.Time) {
                console.error('FlightMap: Data point missing Time property', currentPoint);
                return;
            }

            this.curTime = currentPoint.Time;

            // Log actual map time for sync verification (every 30th call)
            if (!this._updateCount) this._updateCount = 0;
            this._updateCount++;
            if (this._updateCount % 30 === 0) {
                console.log('[FlightMap] Displaying time:', this.curTime.toISOString().substr(11, 8), 'at progress:', (progress * 100).toFixed(1) + '%');
            }

            // 1. Update the current time display (if you still need this element)
            // Check if the element exists first, to avoid errors
            const timeElement = document.getElementById('current-time-display');
            if (timeElement) {
                timeElement.textContent = this.curTime.toISOString();
            }

            // 2. Update the plane marker position
            if (currentPoint.latitude !== undefined && currentPoint.longitude !== undefined) {
                try {
                    this.planeMarker.setLatLng([currentPoint.latitude, currentPoint.longitude]);
                } catch (error) {
                    console.warn('Error updating plane marker:', error.message);
                }
            }

            // 3. Update the path drawn on the map
            try {
                this.planePath.setLatLngs(this.data.slice(0, dataPointIndex + 1).map(d => [d.latitude, d.longitude]));
            } catch (error) {
                console.warn('Error updating flight path:', error.message);
            }

            // 4. Update radar layer (if implemented)
            if (typeof this.updateRadarLayer === 'function') {
                this.updateRadarLayer();
            }
        }
    }
}

    // addVideoEventListener(videoElementId) {
    //     const video = document.getElementById(videoElementId);
    //     video.addEventListener('timeupdate', () => {
    //         const currentTime = video.currentTime;
    //         const duration = video.duration;
    //         const progress = currentTime / duration;

    //         // Calculate the number of data points to display based on the progress
    //         const totalDataPoints = this.data ? this.data.length : 0;
    //         const dataPointIndex = Math.floor(progress * totalDataPoints);

    //         // Ensure the index is within bounds
    //         if (dataPointIndex >= 0 && dataPointIndex < totalDataPoints) {
    //             const nextPoint = this.data[dataPointIndex];
    //             this.curTime = nextPoint.Time;
    //             this.planeMarker.setLatLng([nextPoint.latitude, nextPoint.longitude]);
    //             this.planePath.setLatLngs(this.data.slice(0, dataPointIndex + 1).map(d => [d.latitude, d.longitude]));
    //             document.getElementById('current-time').textContent = nextPoint.Time.toISOString();
                
    //             // Update radar layer to match current time
    //             this.updateRadarLayer();
    //         }
    //     });
