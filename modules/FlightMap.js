// Initialize the map
import {PROJECT} from './chartselect.js';
export default class FlightMap {
    constructor(mapId,flight,OAP){
        this.map = L.map(mapId,{
            maxZoom: 18, // Set the maximum zoom level
            minZoom: 3, // Set the minimum zoom level
        }).setView([0, 0], 2);
        this.flight = flight;
        this.planeIconPNG = 'plane.png';
        this.planePath;
        this.planeMarker;
        this.OAP = OAP;
        this.curTime;
        this.updateVideoSource(flight);
        this.initMap();
        this.loadFlightData();
        if (OAP){
            this.OAP_imagery = new OAP_imagery(flight);
        }   
    }

initMap(){
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);
}

handleOAPVisibility() {
    const imageContainer = document.getElementById('image-container');
    const graphContainer = document.getElementById('graph-container');
    console.log("handleOAPVisibility called with OAP:", this.OAP);

    if (!imageContainer || !graphContainer) {
        console.error("Containers not found");
        return;
    }
    if (this.OAP) {
        imageContainer.classList.add('image-oap-true');
        graphContainer.classList.add('graph-oap-true');
        imageContainer.classList.remove('image-oap-false');
        graphContainer.classList.remove('graph-oap-false');
    } else {
        imageContainer.classList.add('image-oap-false');
        graphContainer.classList.add('graph-oap-false');
        imageContainer.classList.remove('image-oap-true');
        graphContainer.classList.remove('graph-oap-true');
    }
}
loadFlightData(){
    fetch(`data/${PROJECT}/${PROJECT}${this.flight.toLowerCase()}_track.json`)
    .then(response => response.json())
    .then(data => {
        const timeArray = data.coords.Time.data;
        const latitudeArray = data.data_vars.GGLAT.data;
        const longitudeArray = data.data_vars.GGLON.data;
        const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
        this.data= timeArray.map((time, index) => ({
            Time: parseTime(time),
            latitude: +latitudeArray[index],
            longitude: +longitudeArray[index]
        }));

        this.initializePlaneMarker();
        this.fitMapBounds();
        //this.animatePlane();
    })
    .catch(error => {
        console.error('Error fetching the JSON file:', error);
    });

}

//update flight data
updateFlightData(){
    fetch(`data/${PROJECT}/${PROJECT}${this.flight.toLowerCase()}_track.json`)
    .then(response => response.json())
    .then(data => {
        const timeArray = data.coords.Time.data;
        const latitudeArray = data.data_vars.GGLAT.data;
        const longitudeArray = data.data_vars.GGLON.data;
        const parseTime = d3.utcParse("%Y-%m-%dT%H:%M:%S");
        this.data= timeArray.map((time, index) => ({
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
    this.updateVideoSource(flight);
    if (this.OAP){
    this.OAP_imagery.updateFlight(flight);}
    this.updateFlightData();
    this.updateTitle(flight);
}
updateOAP(){
    this.OAP_imagery.updateImage(this.curTime, 'F2DS');
    this.OAP_imagery.updateImage(this.curTime, 'HVPS');
}
updateVideoSource(flight) {
    const video = document.getElementById('myVideo');
    const flightPattern = new RegExp(`^${flight}.*\\.mp4$`, 'i'); // 'i' flag for case-insensitive matching
    // Fetch the list of files in the directory
    fetch('movie_lists.json')
        .then(response => response.json())
        .then(data => {
            // Find the file that matches the flight pattern
            const files = data[PROJECT] || [];
            // Find the file that matches the flight pattern
            const matchingFile = files.find(file => flightPattern.test(file));
            if (matchingFile) {
                // Update the video source with the found file
                video.src = `movies/${PROJECT}/${matchingFile}`;
                video.load(); // Reload the video with the new source
                // Play the video
                video.play();
            } else {
                console.error('No matching video file found');
            }
        })
        .catch(error => {
            console.error('Error fetching video files:', error);
        });
}
updateTitle(flight) {
    const flightTextElement = document.querySelector('#video-title .font2');
    flightTextElement.textContent = flight;
}
addVideoEventListener(videoElementId) {
    const video = document.getElementById(videoElementId);
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
            //const prevPoint = dataPointIndex > 0 ? this.data[dataPointIndex - 1] : nextPoint;
            //const bearing = this.calculateBearing(prevPoint.latitude, prevPoint.longitude, nextPoint.latitude, nextPoint.longitude);
            this.curTime = nextPoint.Time;
            // Rotate the plane icon
            //const planeIconElement = document.querySelector('.plane-icon');
            //planeIconElement.style.transform = `rotate(${bearing}deg)`;

            this.planeMarker.setLatLng([nextPoint.latitude, nextPoint.longitude]);
            this.planePath.setLatLngs(this.data.slice(0, dataPointIndex + 1).map(d => [d.latitude, d.longitude])); // Update the polyline with the current data

            // Print the time value to the screen
            document.getElementById('current-time').textContent = nextPoint.Time.toISOString();
            if (this.OAP){
                this.updateOAP();
            }
        }
    });
}
}
class OAP_imagery{
    constructor(flight){
        this.flight = flight;
        this.imageFilenames ={};
        this.getFilenames(this.flight,'F2DS');
	this.getFilenames(this.flight,'HVPS');
//	console.log(this.imageFilenames);
}
updateFlight(flight) {
    this.flight = flight;}

getFilenames(flight,dtype) {
    fetch(`${PROJECT}_${dtype}.json`) // Replace with the path to your JSON file
    .then(response => response.json())
    .then(data => {
        if (data[flight]) {
            this.imageFilenames[dtype] = data[flight];
        } else {
            console.error(`No filenames found for flight: ${flight}`);
            this.imageFilenames[dtype] = [];
        }
    })
    .catch(error => {
        console.error('Error fetching filenames:', error);
    });
}

updateImage(currentTime,dtype) {
    const imageContainer = document.getElementById(dtype);
    const filteredImages = this.imageFilenames[dtype]||[];
    const currentImage = filteredImages.find(filename => {
        const [start, end] = this.parseFilename(filename);
        return start <= currentTime && currentTime <= end;
    });
    if (currentImage) {
        imageContainer.innerHTML = `<img src="data/${PROJECT}_OAP/${dtype}/${this.flight}/${currentImage}" alt="${dtype}">`;
    }
}

parseFilename(filename) {
    const parts = filename.split('_');
    const date = parts[2];
    const start = this.parseFileTime(date, parts[3]);
    const end = this.parseFileTime(date, parts[5]);
    return [start, end];
}

parseFileTime(dateString, timeString) {
    const year = parseInt(dateString.slice(0, 4), 10);
    const month = parseInt(dateString.slice(4, 6), 10) - 1; // Months are zero-based in JavaScript
    const day = parseInt(dateString.slice(6, 8), 10);
    const hours = parseInt(timeString.slice(0, 2), 10);
    const minutes = parseInt(timeString.slice(2, 4), 10);
    const seconds = parseInt(timeString.slice(4, 6), 10);
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

}
