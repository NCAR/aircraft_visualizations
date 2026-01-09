// TimelineController.js

import { CHARTS } from './LineChart.js';
// FLIGHT_MAP and FLIGHT_MOVIE need to be imported or passed in
// We'll pass them in during setup for flexibility

// DEPRECATED: These RF09 gaps are test/placeholder data and don't match actual flights
// const rf09Gaps = [ ... ]

export default class TimelineController {
    constructor(flightMap, flightMovie, flightId) {
        this.flightMap = flightMap;
        this.flightMovie = flightMovie;
        // DISABLED: Hardcoded gaps don't match actual flight data
        // Instead, gaps will be fetched from API or calculated dynamically
        this.timeGaps = []; // No gaps - timeline syncs directly to video
        this.flightId = flightId;
        this.isRunning = false;
        this.animationFrameId = null;
        this.dataStartTime = null;
        this.dataEndTime = null;
        this.currentDataTime = null;
        this.shouldBePlaying = false; // Track desired playback state
    }
    
    
    
    /**
     * Diagnose timeline configuration
     */
    diagnoseTimeMismatch() {
        if (!this.dataStartTime || !this.dataEndTime || !this.flightMovie?.video) {
            console.log('[Timeline] Diagnostics: Timeline not fully initialized');
            return null;
        }
        
        const videoDuration = this.flightMovie.video.duration;
        const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
        const dataSpanSecs = dataSpanMs / 1000;
        const totalGapDurationSecs = this.timeGaps.reduce((sum, gap) => sum + (gap.duration / 1000), 0);
        const expectedVideoSecs = dataSpanSecs - totalGapDurationSecs;
        
        console.log('[Timeline] TIME CONFIGURATION:', {
            videoDurationSecs: videoDuration.toFixed(2),
            dataSpanSecs: dataSpanSecs.toFixed(2),
            gapDurationSecs: totalGapDurationSecs.toFixed(2),
            expectedVideoSecs: expectedVideoSecs.toFixed(2),
            method: this.timeGaps.length > 0 ? 'Gap-adjusted' : 'Progress-based (no gaps)'
        });
        
        return {
            videoDuration,
            dataSpan: dataSpanSecs,
            gapTotal: totalGapDurationSecs,
            expected: expectedVideoSecs,
            mismatch: expectedVideoSecs - videoDuration
        };
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
            
            const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
            const dataSpanSecs = dataSpanMs / 1000;
            const totalGapDurationMs = this.timeGaps.reduce((sum, gap) => sum + gap.duration, 0);
            const totalGapDurationSecs = totalGapDurationMs / 1000;
            const estimatedVideoDurationSecs = dataSpanSecs - totalGapDurationSecs;
            
            console.log('Timeline range set:', {
                dataStartTime: this.dataStartTime.toISOString(),
                dataEndTime: this.dataEndTime.toISOString(),
                dataSpanMs,
                dataSpanSecs,
                totalGapDurationMs,
                totalGapDurationSecs,
                estimatedVideoDurationSecs,
                actualVideoDuration: this.flightMovie?.video?.duration || 'unknown'
            });
            
            // Check if estimated video duration exceeds actual
            if (this.flightMovie?.video?.duration && estimatedVideoDurationSecs > this.flightMovie.video.duration) {
                console.warn('[Timeline] WARNING: Estimated video duration exceeds actual video duration!', {
                    estimated: estimatedVideoDurationSecs,
                    actual: this.flightMovie.video.duration,
                    difference: estimatedVideoDurationSecs - this.flightMovie.video.duration
                });
            }
        }
    }

    // Calculates the *video* time (seconds) corresponding to the current *data* time (Date object)
    // Strategy: Map data progress (0-1) directly to video progress (0-1)
    // This works when data and video represent the same time span
    calculateVideoTime(dataTime) {
        if (!this.dataStartTime || !this.dataEndTime) {
            return 0;
        }
        
        if (!this.flightMovie?.video?.duration || this.flightMovie.video.duration === 0) {
            return 0;
        }
        
        const videoDuration = this.flightMovie.video.duration;
        const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
        const currentDataMs = dataTime.getTime() - this.dataStartTime.getTime();
        
        // Calculate progress through the data as a percentage (0 to 1)
        const dataProgress = Math.min(1, Math.max(0, currentDataMs / dataSpanMs));
        
        // If gaps are defined, use gap-adjusted calculation (for future gap support)
        if (this.timeGaps && this.timeGaps.length > 0) {
            let videoTimeMs = currentDataMs;
            const totalGapDurationMs = this.timeGaps.reduce((sum, gap) => {
                if (gap.end.getTime() <= dataTime.getTime()) {
                    return sum + gap.duration;
                } else if (gap.start.getTime() < dataTime.getTime()) {
                    return sum + (dataTime.getTime() - gap.start.getTime());
                }
                return sum;
            }, 0);
            
            videoTimeMs -= totalGapDurationMs;
            return Math.max(0, Math.min(videoDuration, videoTimeMs / 1000));
        }
        
        // No gaps: map data progress linearly to video progress
        const videoTime = dataProgress * videoDuration;
        
        // Clamp to video duration to be safe
        return Math.min(videoTime, videoDuration);
    }

    // Check if the current data time falls within a gap
    isDataTimeInGap(dataTime) {
        const timeMs = dataTime.getTime();
        return this.timeGaps.some(gap => 
            timeMs >= gap.start.getTime() && timeMs < gap.end.getTime()
        );
    }

    // Safe play method with error handling
    safePlay() {
        this.shouldBePlaying = true;
        if (this.flightMovie && typeof this.flightMovie.play === 'function') {
            this.flightMovie.play().catch(error => {
                // Ignore AbortError from quick pause/play; log others for visibility
                if (!error || error.name !== 'AbortError') {
                    console.warn('Video play error:', error?.message || error);
                }
            });
        }
    }

    // Safe pause method
    safePause() {
        this.shouldBePlaying = false;
        if (this.flightMovie && typeof this.flightMovie.pause === 'function') {
            // Clear any pending play promise so immediate re-play can work
            if (this.flightMovie.playPromise) {
                this.flightMovie.playPromise = null;
            }
            this.flightMovie.pause();
        }
    }
    
    // The main loop that drives all updates
    updateTimeline = (timestamp) => {
        if (!this.isRunning || !this.dataStartTime) {
            return;
        }

        // IMPORTANT: Drive updates from video's actual playback position, not from data time
        // This ensures data display matches the video playback percentage
        if (this.flightMovie?.video && !this.flightMovie.video.paused) {
            const videoDuration = this.flightMovie.video.duration;
            const currentVideoTime = this.flightMovie.video.currentTime;
            
            if (videoDuration > 0) {
                // Calculate what percentage of the video has played
                const videoProgress = Math.min(1, currentVideoTime / videoDuration);
                
                // Map that percentage to the corresponding data time
                const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
                const targetDataTime = new Date(this.dataStartTime.getTime() + (dataSpanMs * videoProgress));
                
                this.currentDataTime = targetDataTime;
            }
        } else {
            // Video is paused or not ready - advance data time manually
            const delta = 100; // Update step in milliseconds
            let nextDataTime = new Date(this.currentDataTime.getTime() + delta);
            
            // Check if we've reached the end of the data
            if (nextDataTime.getTime() > this.dataEndTime.getTime()) {
                this.stop();
                return;
            }
            
            this.currentDataTime = nextDataTime;
        }

        // Check if we've reached the end of the data
        if (this.currentDataTime.getTime() > this.dataEndTime.getTime()) {
            this.stop();
            return;
        }

        // Calculate progress (0 to 1)
        const progress = (this.currentDataTime.getTime() - this.dataStartTime.getTime()) /
                         (this.dataEndTime.getTime() - this.dataStartTime.getTime());

        // 1. Update Charts with current progress
        CHARTS.forEach(chart => {
            if (chart && typeof chart.updateProgress === 'function') {
                chart.updateProgress(progress);
            }
        });

        // 2. Update flight map with progress and current data time
        if (this.flightMap && typeof this.flightMap.updateFlightTime === 'function') {
            this.flightMap.updateFlightTime(progress, this.currentDataTime);
        }

        // 3. Update slider position
        const sliderElement = document.getElementById('time-slider');
        if (sliderElement) {
            const sliderValue = Math.round(progress * 1000); // 0-1000 range
            sliderElement.value = sliderValue;
        }

        // 4. Log sync status every 30 frames (~0.5 seconds)
        if (!this._frameCount) this._frameCount = 0;
        this._frameCount++;
        if (this._frameCount % 30 === 0) {
            const videoProgress = this.flightMovie?.video ? 
                (this.flightMovie.video.currentTime / this.flightMovie.video.duration * 100).toFixed(1) : 'N/A';
            
            // Get actual times from map and first chart
            const mapTime = this.flightMap?.curTime ? 
                this.flightMap.curTime.toISOString().substr(11, 8) : 'N/A';
            const chartData = CHARTS[0]?.state?.data;
            const chartProgress = CHARTS[0]?.state?.progress || 0;
            const chartIndex = chartData ? Math.floor(chartProgress * chartData.length) : 0;
            const chartTime = (chartData && chartData[chartIndex]?.Time) ? 
                chartData[chartIndex].Time.toISOString().substr(11, 8) : 'N/A';
            
            console.log('SYNC:', {
                timelineProgress: `${(progress * 100).toFixed(1)}%`,
                videoProgress: `${videoProgress}%`,
                timelineDataTime: this.currentDataTime.toISOString().substr(11, 8),
                mapActualTime: mapTime,
                chartActualTime: chartTime
            });
        }

        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.updateTimeline);
    }

    /**
     * Check if current data time produces a valid video time
     * With progress-based mapping, it's OK if video time exceeds duration
     * (video will just finish early while timeline continues)
     */
    ensureValidVideoTime() {
        if (!this.flightMovie?.video?.duration || this.flightMovie.video.duration === 0) {
            return;
        }
        
        const videoDuration = this.flightMovie.video.duration;
        const currentVideoTime = this.calculateVideoTime(this.currentDataTime);
        
        // Just log info - don't clamp, as video naturally finishes before data
        if (currentVideoTime > videoDuration) {
            console.log('[Timeline] Current video time exceeds duration (expected with progress-based mapping)', {
                videoTime: currentVideoTime.toFixed(2),
                videoDuration: videoDuration.toFixed(2),
                note: 'Video will pause, timeline continues'
            });
        }
    }

    start() {
        if (this.isRunning) {
            console.warn('Timeline already running');
            return;
        }

        if (!this.dataStartTime) {
            console.error('Timeline not initialized - call setTimelineRange first');
            return;
        }

        // Ensure we're not trying to start from a position beyond video duration
        this.ensureValidVideoTime();

        this.isRunning = true;
        this.shouldBePlaying = true;

        // Start video playback (use safe method)
        this.safePlay();

        // Start animation loop
        this.animationFrameId = requestAnimationFrame(this.updateTimeline);
        console.log('Timeline started');
    }

    stop() {
        this.isRunning = false;
        this.shouldBePlaying = false;

        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Pause video (use safe method)
        this.safePause();
    }
    
    // Method to allow external control (e.g., slider drag)
    seekToTime(newTime) {
        
        if (!this.dataStartTime || !this.dataEndTime) {
            console.warn('Timeline not initialized - cannot seek');
            return;
        }

        // Validate newTime is within bounds
        const newTimeMs = newTime.getTime();
        const startMs = this.dataStartTime.getTime();
        const endMs = this.dataEndTime.getTime();
        
        if (newTimeMs < startMs || newTimeMs > endMs) {
            console.warn('Seek time out of bounds:', newTime, 'Range:', this.dataStartTime, this.dataEndTime);
            return;
        }

        this.currentDataTime = newTime;

        // Calculate progress (0 to 1)
        const progress = (newTimeMs - startMs) / (endMs - startMs);

        // Update all charts with progress
        CHARTS.forEach(chart => {
            if (chart && typeof chart.updateProgress === 'function') {
                chart.updateProgress(progress);
            }
        });

        // Update flight map position with progress and time
        if (this.flightMap && typeof this.flightMap.updateFlightTime === 'function') {
            this.flightMap.updateFlightTime(progress, newTime);
        }

        // Update video position - but don't call play/pause here
        // Let the updateTimeline loop handle play/pause based on gap detection
        if (this.flightMovie && this.flightMovie.video) {
            const videoTime = this.calculateVideoTime(newTime);
            
            if (typeof this.flightMovie.seekTo === 'function') {
                this.flightMovie.seekTo(videoTime);
            } else {
                this.flightMovie.video.currentTime = videoTime;
            }
            
            // If we're currently in a gap, pause; otherwise ensure it can play when needed
            const inGap = this.isDataTimeInGap(newTime);
            if (inGap && this.flightMovie.video.paused === false) {
                this.safePause();
            }
        }
    }

    /**
     * Reset timeline to beginning
     */
    reset() {
        this.stop();
        if (this.dataStartTime) {
            this.currentDataTime = this.dataStartTime;
            // Use seekToTime which handles syncing all components
            this.seekToTime(this.dataStartTime);
            // After reset, ensure video is paused
            this.safePause();
        }
    }

    /**
     * Clean up timeline controller
     */
    destroy() {
        this.stop();
        this.flightMap = null;
        this.flightMovie = null;
        this.timeGaps = [];
        this.dataStartTime = null;
        this.dataEndTime = null;
        this.currentDataTime = null;
        console.log('Timeline controller destroyed');
    }
}