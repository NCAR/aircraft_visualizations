export default class FlightMovie {
    constructor(videoElementId, project) {
        this.video = document.getElementById(videoElementId);
        this.project = project;
        this.pendingSeek = null;
        this.playPromise = null; // Track in-flight play requests
        this.isReady = false; // Track if video metadata is loaded
        
        // Listen for metadata loaded event
        if (this.video) {
            this.video.addEventListener('loadedmetadata', () => {
                this.isReady = true;
            });
        }
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
        
        this.isReady = false; // Reset ready state
        this.video.src = videoUrl;
        this.video.load(); // Reload the video with the new source
        this.pendingSeek = null; // Clear any queued seek when source changes
        
        // Note: Removed the old JSON fetching/file pattern matching logic.
    }
    // 🛑 NEW METHOD: Play the video with in-flight guard to avoid pause/play races
    play() {
        if (!this.video) return Promise.resolve();

        // If already playing, no-op
        if (!this.video.paused) {
            return Promise.resolve();
        }

        // If a play is already pending, reuse it
        if (this.playPromise) {
            return this.playPromise;
        }
        this.playPromise = this.video.play()
            .catch(error => {
                // Swallow AbortError caused by immediate pauses; surface others without throwing
                const isAbort = error && error.name === 'AbortError';
                if (!isAbort) {
                    console.warn('Video play failed:', error);
                }
                return; // Resolve even on Abort so callers keep going
            })
            .finally(() => {
                this.playPromise = null;
            });

        return this.playPromise;
    }

    // 🛑 NEW METHOD: Pause the video
    pause() {
        if (!this.video) return;
        this.video.pause();
    }

    // 🛑 NEW METHOD: Seek to a specific time in the video
    seekTo(timeInSeconds) {
        if (!this.video) return;
        
        // Ensure the time is a valid number
        if (typeof timeInSeconds !== 'number' || timeInSeconds < 0) {
            console.warn('Invalid seek time:', timeInSeconds);
            return;
        }
        
        // Check if video is ready
        if (!this.isReady || this.video.duration === 0 || isNaN(this.video.duration)) {
            console.warn(`[FlightMovie] Cannot seek - video not ready. isReady: ${this.isReady}, duration: ${this.video.duration}`);
            this.pendingSeek = timeInSeconds;
            return;
        }
        
        // CRITICAL FIX: Clamp seek time to actual video duration
        // This prevents seeking past the end of the video
        const clampedTime = Math.min(timeInSeconds, this.video.duration);
        
        if (timeInSeconds > this.video.duration) {
            console.warn(`[FlightMovie] Seek time ${timeInSeconds}s exceeds video duration ${this.video.duration}s. Clamping to duration.`);
        }
        
        try {
            this.video.currentTime = clampedTime;
        } catch (error) {
            console.warn('Error seeking video:', error);
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