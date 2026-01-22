/**
 * FlightMovie - Store-connected version
 * Manages HTML5 video playback and syncs with store state
 */

import { IComponent } from '../interfaces/IComponent.js';
import {
  getCurrentFlightId,
  isTimelinePlaying,
  getTimelineProgress,
  getCurrentTime
} from '../store/selectors/selectors.js';
import { StateChangeDetector } from './shared/StateChangeDetector.js';
import { dataProgressToVideoProgress, isWithinGap, createGapConfig } from './shared/gapUtils.js';

export default class FlightMovieStore extends IComponent {
  constructor(videoElementId, store) {
    super(store);

    this.video = document.getElementById(videoElementId);
    if (!this.video) {
      throw new Error(`Video element #${videoElementId} not found`);
    }

    this.pendingSeek = null;
    this.playPromise = null;
    this.isReady = false;
    this.lastSyncedProgress = null;
    this.videoAvailable = false;  // Track if video has valid source
    this.cameraCard = document.querySelector('.camera-card');  // Reference to card for hiding
    this.gapConfig = null;  // Gap configuration for video timeline sync
    this.isInGap = false;  // Track if currently within a video gap

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      flightId: null,
      isPlaying: null,
      progress: null
    });

    // Listen for metadata loaded event
    this.video.addEventListener('loadedmetadata', () => {
      this.isReady = true;
      this.videoAvailable = true;
      if (this.cameraCard) {
        this.cameraCard.classList.remove('hidden');  // Show card with animation
        
        // Trigger map resize after animation completes
        setTimeout(() => {
          if (window.flightMap && window.flightMap.map) {
            window.flightMap.map.invalidateSize();
            console.log('[FlightMovieStore] Map resized after camera card shown');
          }
        }, 450); // Wait for CSS transition (0.4s) plus buffer
      }
      console.log('[FlightMovieStore] Video metadata loaded');
    });

    // Listen for error events
    this.video.addEventListener('error', () => {
      this.isReady = false;
      this.videoAvailable = false;
      if (this.cameraCard) {
        this.cameraCard.classList.add('hidden');  // Hide card with animation
        
        // Trigger map resize after animation completes
        setTimeout(() => {
          if (window.flightMap && window.flightMap.map) {
            window.flightMap.map.invalidateSize();
            console.log('[FlightMovieStore] Map resized after camera card hidden');
          }
        }, 450); // Wait for CSS transition (0.4s) plus buffer
      }
      console.log('[FlightMovieStore] No video available for this flight');
    });

    // Connect to store
    this.connect();
    this.onStateChange(this.getState());

    console.log('[FlightMovieStore] Created');
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const flightId = getCurrentFlightId(state);
    const isPlaying = isTimelinePlaying(state);
    const progress = getTimelineProgress(state);

    // Update video source when flight changes
    if (flightId && this.changeDetector.hasChanged('flightId', flightId)) {
      console.log('[FlightMovieStore] Loading video for flight:', flightId);
      this.updateVideoSource(flightId);
      this.lastSyncedProgress = null;
      this.isInGap = false;
      this.changeDetector.updateAll({
        flightId,
        progress: null,
        isPlaying: null  // Reset to force play/pause sync on next check
      });

      // If timeline is playing, start playing the new video immediately
      if (isPlaying) {
        this.play();
      }
      return; // Exit early to avoid duplicate play/pause logic
    }

    // Check if we're currently in a gap (only if gap config exists)
    let currentlyInGap = false;
    if (this.gapConfig && progress !== null && progress !== undefined) {
      // Calculate current timestamp from progress
      const timeRangeStart = this.gapConfig.timeRange.start.getTime();
      const timeRangeEnd = this.gapConfig.timeRange.end.getTime();
      const fullDuration = timeRangeEnd - timeRangeStart;
      const currentTimestamp = new Date(timeRangeStart + progress * fullDuration);

      // Check if this timestamp is within a gap
      const gapCheck = isWithinGap(this.gapConfig.parsedGaps, currentTimestamp);
      currentlyInGap = gapCheck.inGap;
    }

    // Handle gap transitions
    if (currentlyInGap !== this.isInGap) {
      if (currentlyInGap) {
        // Entering a gap - pause video
        console.log('[FlightMovieStore] Entering gap - pausing video');
        this.pause();
      } else {
        // Exiting a gap - seek to correct position and resume if timeline is playing
        console.log('[FlightMovieStore] Exiting gap - syncing video position');
        if (this.isReady && this.video.duration && progress !== null) {
          // Force seek to correct position when exiting gap
          const videoProgress = dataProgressToVideoProgress(
            progress,
            this.gapConfig.timeRange,
            this.gapConfig.parsedGaps,
            this.gapConfig.totalGapDuration
          );
          const timeInSeconds = videoProgress * this.video.duration;
          this.seekTo(timeInSeconds);
        }
        if (isPlaying) {
          this.play();
        }
      }
      this.isInGap = currentlyInGap;
    }

    // Sync play/pause state (only when not in a gap)
    if (!currentlyInGap && this.changeDetector.hasChanged('isPlaying', isPlaying)) {
      if (isPlaying) {
        this.play();
      } else {
        this.pause();
      }
      this.changeDetector.update('isPlaying', isPlaying);
    }

    // Seek video based on progress changes (only when not in a gap)
    if (this.isReady && progress !== null && progress !== undefined && this.video.duration && !currentlyInGap) {
      // Convert data progress to video progress (accounting for gaps)
      let videoProgress = progress;
      if (this.gapConfig) {
        videoProgress = dataProgressToVideoProgress(
          progress,
          this.gapConfig.timeRange,
          this.gapConfig.parsedGaps,
          this.gapConfig.totalGapDuration
        );
      }
      
      const targetVideoTime = videoProgress * this.video.duration;
      const currentVideoTime = this.video.currentTime;
      const timeDrift = Math.abs(targetVideoTime - currentVideoTime);

      // Sync strategy:
      // - When paused: seek on ANY progress change (for responsive scrubbing)
      // - When playing: only seek if drift exceeds 1 second (prevents stuttering)
      const shouldSeek = !isPlaying || timeDrift > 1.0;

      if (shouldSeek) {
        // Convert progress (0-1) to seconds based on video duration
        const timeInSeconds = targetVideoTime;
        // console.log('[FlightMovieStore] Seeking to progress:', progress.toFixed(3), 'videoProgress:', videoProgress.toFixed(3), 'time:', timeInSeconds.toFixed(2) + 's, drift:', timeDrift.toFixed(2) + 's'); // DEBUG
        this.seekTo(timeInSeconds);
      }
    }

    this.lastSyncedProgress = progress;
    this.changeDetector.update('progress', progress);
  }

  /**
   * Update video source
   */
  updateVideoSource(flightId) {
    if (!flightId) {
      console.error('[FlightMovieStore] No Flight ID provided');
      return;
    }

    const videoUrl = `/movies/${encodeURIComponent(flightId)}`;

    this.isReady = false;
    this.video.src = videoUrl;
    this.video.load();
    this.pendingSeek = null;

    // console.log('[FlightMovieStore] Video source updated:', videoUrl); // DEBUG
  }

  /**
   * Play video
   */
  play() {
    if (!this.video || !this.videoAvailable) return Promise.resolve();

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
        const isAbort = error && error.name === 'AbortError';
        if (!isAbort && error.name !== 'NotSupportedError') {
          console.warn('[FlightMovieStore] Video play failed:', error);
        }
      })
      .finally(() => {
        this.playPromise = null;
      });

    return this.playPromise;
  }

  /**
   * Pause video
   */
  pause() {
    if (!this.video || !this.videoAvailable) return;
    this.video.pause();
  }

  /**
   * Seek to specific time
   */
  seekTo(timeInSeconds) {
    if (!this.video) return;

    if (typeof timeInSeconds !== 'number' || timeInSeconds < 0) {
      console.warn('[FlightMovieStore] Invalid seek time:', timeInSeconds);
      return;
    }

    // Check if video is ready
    if (!this.isReady || this.video.duration === 0 || isNaN(this.video.duration)) {
      console.warn('[FlightMovieStore] Cannot seek - video not ready');
      this.pendingSeek = timeInSeconds;
      return;
    }

    // Clamp seek time to actual video duration
    const clampedTime = Math.min(timeInSeconds, this.video.duration);

    if (timeInSeconds > this.video.duration) {
      console.warn(`[FlightMovieStore] Seek time ${timeInSeconds}s exceeds duration ${this.video.duration}s. Clamping.`);
    }

    try {
      this.video.currentTime = clampedTime;
    } catch (error) {
      console.warn('[FlightMovieStore] Error seeking video:', error);
    }
  }

  /**
   * Get current video time
   */
  getCurrentTime() {
    return this.video ? this.video.currentTime : 0;
  }

  /**
   * Get video duration
   */
  getDuration() {
    return this.video ? this.video.duration : 0;
  }

  /**
   * Add event listener
   */
  addVideoEventListener(callback) {
    if (!this.video) return;

    this.video.addEventListener('timeupdate', () => {
      const currentTime = this.video.currentTime;
      const duration = this.video.duration;
      const progress = duration > 0 ? currentTime / duration : 0;
      callback(currentTime, duration, progress);
    });
  }

  /**
   * Set gap configuration for video timeline synchronization
   * @param {Array<{start: string, end: string}>} rawGaps - Raw gap data with timestamp strings
   * @param {{start: Date, end: Date}} timeRange - Full data time range
   */
  setGapConfig(rawGaps, timeRange) {
    if (!rawGaps || rawGaps.length === 0) {
      this.gapConfig = null;
      console.log('[FlightMovieStore] Gap config cleared');
      return;
    }

    this.gapConfig = createGapConfig(rawGaps, timeRange);
    console.log('[FlightMovieStore] Gap config set:', {
      gapsCount: rawGaps.length,
      totalGapDuration: (this.gapConfig.totalGapDuration / 60000).toFixed(2) + ' minutes'
    });
  }

  /**
   * Clear gap configuration
   */
  clearGapConfig() {
    this.gapConfig = null;
    console.log('[FlightMovieStore] Gap config cleared');
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log('[FlightMovieStore] Destroying');

    // Pause video
    if (this.video) {
      this.video.pause();
    }

    // Disconnect from store
    super.destroy();
  }
}
