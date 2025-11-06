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
        this.initMap();
        this.loadFlightData();
    }

    initMap() {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);
    }
    setProject(project) {
        this.project = project;
    }

    loadFlightData() {
        fetchFlightTrack(this.project, this.flight)
            .then(data => {
                const timeArray = data.coords.Time.data;
                const latitudeArray = data.data_vars.GGLAT.data;
                const longitudeArray = data.data_vars.GGLON.data;
                const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
                this.data = timeArray.map((time, index) => ({
                    Time: parseTime(time),
                    latitude: +latitudeArray[index],
                    longitude: +longitudeArray[index]
                }));

                this.initializePlaneMarker();
                this.fitMapBounds();
            })
            .catch(error => {
                console.error('Error fetching the JSON file:', error);
            });
    }

    updateFlightData() {
        fetchFlightTrack(this.project, this.flight)
            .then(data => {
                const timeArray = data.coords.Time.data;
                const latitudeArray = data.data_vars.GGLAT.data;
                const longitudeArray = data.data_vars.GGLON.data;
                const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
                this.data = timeArray.map((time, index) => ({
                    Time: parseTime(time),
                    latitude: +latitudeArray[index],
                    longitude: +longitudeArray[index]
                }));
                this.fitMapBounds();
            }).catch(error => {
                console.error('Error fetching the JSON file:', error);
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
        const bounds = L.latLngBounds(this.data.map(d => [d.latitude, d.longitude]));
        const bufferedBounds = bounds.pad(1 / 111);
        this.map.fitBounds(bufferedBounds);
        this.map.setMaxBounds(bufferedBounds);
    }

    updateFlight(flight) {
        this.flight = flight;
        this.updateFlightData();
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

    addVideoEventListener(videoElementId) {
        const video = document.getElementById(videoElementId);
        if (!video) {
            console.error(`Video element with id '${videoElementId}' not found`);
            return;
        }

        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            const duration = video.duration;
            const progress = currentTime / duration;

            // Calculate the number of data points to display based on the progress
            const totalDataPoints = this.data ? this.data.length : 0;
            const dataPointIndex = Math.floor(progress * totalDataPoints);

            // Ensure the index is within bounds
            if (dataPointIndex >= 0 && dataPointIndex < totalDataPoints) {
                const nextPoint = this.data[dataPointIndex];
                this.curTime = nextPoint.Time;
                this.planeMarker.setLatLng([nextPoint.latitude, nextPoint.longitude]);
                this.planePath.setLatLngs(this.data.slice(0, dataPointIndex + 1).map(d => [d.latitude, d.longitude]));

                const currentTimeElement = document.getElementById('current-time');
                if (currentTimeElement) {
                    currentTimeElement.textContent = nextPoint.Time.toISOString();
                }
            }
        });
    }
}