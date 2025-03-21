export default class OAPImagery {
    constructor(project, flight) {
        this.project = project;
        this.flight = flight;
        this.imageFilenames = {};
        this.getFilenames(this.flight, 'F2DS');
        this.getFilenames(this.flight, 'HVPS');
    }

    updateFlight(flight) {
        this.flight = flight;
    }

    getFilenames(flight, dtype) {
        fetch(`${this.project}_${dtype}.json`)
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

    updateImage(currentTime, dtype) {
        const imageContainer = document.getElementById(dtype);
        const filteredImages = this.imageFilenames[dtype] || [];
        const currentImage = filteredImages.find(filename => {
            const [start, end] = this.parseFilename(filename);
            return start <= currentTime && currentTime <= end;
        });
        if (currentImage) {
            imageContainer.innerHTML = `<img src="data/${this.project}_OAP/${dtype}/${this.flight}/${currentImage}" alt="${dtype}">`;
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