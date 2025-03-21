export default class FlightMovie {
    constructor(videoElementId, project) {
        this.video = document.getElementById(videoElementId);
        this.project = project;
    }
    //Update project
    setProject(project) {
        this.project = project;
    }

    updateVideoSource(flight) {
        const flightPattern = new RegExp(`${flight}.*\\.mp4$`, 'i'); // 'i' flag for case-insensitive matching
        // Fetch the list of files in the directory
        fetch('movie_lists.json')
            .then(response => response.json())
            .then(data => {
                // Find the file that matches the flight pattern
                const files = data[this.project] || [];
                const matchingFile = files.find(file => flightPattern.test(file));
                if (matchingFile) {
                    // Update the video source with the found file
                    this.video.src = `movies/${this.project}/${matchingFile}`;
                    this.video.load(); // Reload the video with the new source
                    // Play the video
                    //this.video.play();
                } else {
                    console.error('No matching video file found');
                }
            })
            .catch(error => {
                console.error('Error fetching video files:', error);
            });
    }

    addVideoEventListener(callback) {
        this.video.addEventListener('timeupdate', () => {
            const currentTime = this.video.currentTime;
            const duration = this.video.duration;
            const progress = currentTime / duration;
            callback(currentTime, duration, progress);
        });
    }
}