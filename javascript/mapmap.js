// Initialize the map


class FlightMap{
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
loadFlightData(){
    fetch(`track${this.flight.toLowerCase()}.json`)
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
    fetch(`track${this.flight.toLowerCase()}.json`)
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
    this.OAP_imagery.updateFlight(flight);
    this.updateFlightData();
    this.updateTitle(flight);
}
updateOAP(){
    this.OAP_imagery.updateImage(this.curTime, 'F2DS');
    this.OAP_imagery.updateImage(this.curTime, 'HVPS');
}
updateVideoSource(flight) {
    const video = document.getElementById('myVideo');
    video.src = `${flight.toLowerCase()}.mp4`;
    video.load(); // Reload the video with the new source
    //play the video
    video.play();
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
            this.updateOAP();
        }
    });
}
}
class OAP_imagery{
    constructor(flight){
        this.flight = flight;
        this.imageFilenames =[];
        this.getFilenames(this.flight);
}
updateFlight(flight) {
    this.flight = flight;}

getFilenames(flight) {
    fetch(`${flight}.txt`)
        .then(response => response.text())
        .then(data => {
            this.imageFilenames = data.split('\n').filter(Boolean);
        })
        .catch(error => {
            console.error('Error fetching filenames:', error);
        });
}

updateImage(currentTime, dtype) {
    const imageContainer = document.getElementById(dtype);
    const filteredImages = this.imageFilenames.filter(filename => filename.includes(dtype));
    const currentImage = filteredImages.find(filename => {
        const [start, end] = this.parseFilename(filename);
        return start <= currentTime && currentTime <= end;
    });
    if (currentImage) {
        imageContainer.innerHTML = `<img src="${this.flight}/${currentImage}" alt="${dtype}">`;
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
// Add a tile layer (OpenStreetMap)
const flightMap = new FlightMap('map', flight, 'plane.png');
flightMap.addVideoEventListener('myVideo');
//Initialize the plane marker



document.getElementById('flight-select').addEventListener('change', function() {
    flight= this.value;
    console.log(flight)
    flightMap.updateFlight(flight);
    flightMap.OAP_imagery.getFilenames(flight)
    //flightMap.updateOAP();
    //update the json file to the selected flight
});
