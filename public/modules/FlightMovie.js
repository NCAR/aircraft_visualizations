export default class FlightMovie {
    constructor(videoElementId, project) {
        this.video = document.getElementById(videoElementId);
        this.project = project;
    }
    //Update project
    setProject(project) {
        this.project = project;
    }

    updateVideoSource(flightID) {
        
        // Check if the input is a valid ID
        if (!flightID) {
            console.error('No Flight ID provided for video source.');
            return;
        }
        
        // Construct the URL to call the new backend endpoint: /movies/:flightID
        // The backend handles the file lookup and serving.
        const videoUrl = `/movies/${encodeURIComponent(flightID)}`;
        
        this.video.src = videoUrl;
        this.video.load(); // Reload the video with the new source
        console.log(`Updated video source URL to: ${videoUrl}`);
        
        // Note: Removed the old JSON fetching/file pattern matching logic.
    }
    // 🛑 NEW METHOD: Play the video
    play() {
        if (this.video.paused) {
            this.video.play().catch(error => {
                console.error("Video play failed (often due to autoplay restrictions):", error);
            });
        }
    }

    // 🛑 NEW METHOD: Pause the video
    pause() {
        if (!this.video.paused) {
            this.video.pause();
        }
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