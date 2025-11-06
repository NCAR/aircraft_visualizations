// TimelineController.js

import { CHARTS } from './LineChart.js';
// FLIGHT_MAP and FLIGHT_MOVIE need to be imported or passed in
// We'll pass them in during setup for flexibility
// 🛑 HARDCODED TIME GAPS FOR RF09 TESTING
const rf09Gaps = [
    { start: "250807-003532", end: "250807-004847" },
    { start: "250807-004900", end: "250807-004906" },
    { start: "250807-004906", end: "250807-004921" },
    { start: "250807-005032", end: "250807-012104" },
    { start: "250807-012332", end: "250807-015702" },
    { start: "250807-020632", end: "250807-023213" },
    { start: "250807-023222", end: "250807-023230" },
    { start: "250807-023432", end: "250807-023551" },
    { start: "250807-023632", end: "250807-024347" },
    { start: "250807-024432", end: "250807-024537" },
    { start: "250807-024538", end: "250807-024544" },
    { start: "250807-024632", end: "250807-024801" },
    { start: "250807-024801", end: "250807-024811" }
];
export default class TimelineController {
    constructor(flightMap, flightMovie, flightId) {
        this.flightMap = flightMap;
        this.flightMovie = flightMovie;
        this.timeGaps = (flightId === 'rf09') ? this.parseTimeGaps(rf09Gaps) : []; // Load hardcoded gaps for rf09
        this.isRunning = false;
        this.animationFrameId = null;
        this.dataStartTime = null;
        this.dataEndTime = null;
        this.currentDataTime = null;
    }
    
    
    parseTimeGaps(gaps) {
        // Base year is assumed to be 2025 based on the '25' prefix and current date
        const BASE_YEAR = 2000; 
        
        const parseTimestamp = (ts) => {
            const year = BASE_YEAR + parseInt(ts.substring(0, 2), 10);
            const month = parseInt(ts.substring(2, 4), 10) - 1; // Month is 0-indexed
            const day = parseInt(ts.substring(4, 6), 10);
            const hour = parseInt(ts.substring(7, 9), 10);
            const minute = parseInt(ts.substring(9, 11), 10);
            const second = parseInt(ts.substring(11, 13), 10);
            
            return new Date(Date.UTC(year, month, day, hour, minute, second));
        };
        
        return gaps.map(gap => {
            const start = parseTimestamp(gap.start);
            const end = parseTimestamp(gap.end);
            return {
                start: start,
                end: end,
                duration: end.getTime() - start.getTime()
            };
        });
    }
    
    // Set the full time range based on the main data array (e.g., from CHARTS[0].data)
    setTimelineRange(data) {
        if (data && data.length > 0) {
            this.dataStartTime = data[0].Time;
            this.dataEndTime = data[data.length - 1].Time;
            this.currentDataTime = this.dataStartTime;
            console.log('Timeline range set:', this.dataStartTime, this.dataEndTime);
        }
    }

    // Calculates the *video* time (seconds) corresponding to the current *data* time (Date object)
    calculateVideoTime(dataTime) {
        let videoTimeMs = dataTime.getTime() - this.dataStartTime.getTime();
        
        // Subtract gap durations that have already passed
        this.timeGaps.forEach(gap => {
            // Check if the gap is fully before the current data time
            if (gap.end.getTime() < dataTime.getTime()) {
                videoTimeMs -= gap.duration;
            } else if (gap.start.getTime() < dataTime.getTime() && gap.end.getTime() >= dataTime.getTime()) {
                // If we are currently inside a gap, the video shouldn't be playing, 
                // but this function only returns the time if it were playing linearly up to this point.
                // We'll handle the pause/play logic in the update loop.
                videoTimeMs -= (dataTime.getTime() - gap.start.getTime());
            }
        });
        
        // Ensure video time is non-negative
        return Math.max(0, videoTimeMs / 1000); 
    }

    // Check if the current data time falls within a gap
    isDataTimeInGap(dataTime) {
        const timeMs = dataTime.getTime();
        return this.timeGaps.some(gap => 
            timeMs >= gap.start.getTime() && timeMs < gap.end.getTime()
        );
    }
    
    // The main loop that drives all updates
    updateTimeline = (timestamp) => {
        if (!this.isRunning || !this.dataStartTime) {
            return;
        }

        const delta = 100; // Update step in milliseconds (adjust for smoothness)
        let nextDataTime = new Date(this.currentDataTime.getTime() + delta);
        
        // Check if we've reached the end of the data
        if (nextDataTime.getTime() > this.dataEndTime.getTime()) {
            this.stop();
            return;
        }
        console.log('Next Data Time:', nextDataTime);
        const inGap = this.isDataTimeInGap(nextDataTime);

        // 1. Update Charts and Map based on continuous Data Time
        const progress = (nextDataTime.getTime() - this.dataStartTime.getTime()) / 
                         (this.dataEndTime.getTime() - this.dataStartTime.getTime());
        console.log('Timeline Progress:', progress);
        CHARTS.forEach(chart => {
            // This assumes a simple data filter based on progress or time
            chart.updateProgress(progress, nextDataTime); // Need to implement updateProgress in LineChart
        });

        this.flightMap.updateFlightTime(progress, nextDataTime); // Need to implement updateFlightTime in FlightMap

        // 2. Control Video Playback
        if (inGap) {
            // Data Time is advancing, but Video must pause
            this.flightMovie.pause();
        } else {
            // Not in a gap, Video should play and sync to the corrected time
            const videoTime = this.calculateVideoTime(nextDataTime);
            if (this.flightMovie.video.currentTime < videoTime) {
                this.flightMovie.play();
            } else {
                // Keep the video synced, jump forward if necessary
                this.flightMovie.video.currentTime = videoTime;
                this.flightMovie.play(); 
            }
        }
        
        this.currentDataTime = nextDataTime;

        const sliderValue = Math.round(progress * 1000); // 0-1000 range
        document.getElementById('time-slider').value = sliderValue;        // ------------------------------------------

        this.animationFrameId = requestAnimationFrame(this.updateTimeline);
    }

    start() {
        if (this.isRunning || !this.dataStartTime) return;
        this.isRunning = true;
        this.flightMovie.play();
        this.animationFrameId = requestAnimationFrame(this.updateTimeline);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.flightMovie.pause();
    }
    
    // Method to allow external control (e.g., slider drag)
    seekToTime(newTime) {
        this.currentDataTime = newTime;
        const videoTime = this.calculateVideoTime(newTime);
        this.flightMovie.video.currentTime = videoTime;
        
        const progress = (newTime.getTime() - this.dataStartTime.getTime()) / 
                         (this.dataEndTime.getTime() - this.dataStartTime.getTime());

        CHARTS.forEach(chart => {
            chart.updateProgress(progress, newTime);
        });
        this.flightMap.updateFlightTime(newTime);
    }
}