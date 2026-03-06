/**
 * FlightMovie - Store-connected version
 * Manages HTML5 video playback and syncs with store state
 */

import { IComponent } from '../interfaces/IComponent.js';
import {
  getCurrentFlightId,
  getCurrentFlightData,
  isTimelinePlaying,
  isTimelineSeeking,
  getTimelineProgress,
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
    this.wasPlayingBeforeSeek = false;  // Track playback state before seeking started
    this.flightTimeRange = null;  // Cached time range for playback rate calculation
    this.basePlaybackRate = 20;   // Rate for 1x speed: (20 * video.duration * 1000) / effectiveDataMs
    this.speedMultiplier = 1.0;   // User-selected speed multiplier
    this.calculatedPlaybackRate = 20;  // basePlaybackRate * speedMultiplier, applied to video

    // Track previous state
    this.changeDetector = new StateChangeDetector({
      flightId: null,
      isPlaying: null,
      isSeeking: null,
      progress: null
    });

    // Listen for metadata loaded event
    this.video.addEventListener('loadedmetadata', () => {
      this.isReady = true;
      this.videoAvailable = true;
      this._computePlaybackRate();
      if (this.cameraCard) {
        this.cameraCard.classList.remove('hidden');  // Show card with animation
        
        // Trigger map resize after animation completes
        setTimeout(() => {
          if (window.flightMap && window.flightMap.map) {
            window.flightMap.map.resize();
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
            window.flightMap.map.resize();
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
    const isSeeking = isTimelineSeeking(state);
    const progress = getTimelineProgress(state);

    // Update playback rate when flight time range changes (data loaded)
    const flightData = getCurrentFlightData(state);
    const timeRange = flightData?.timeRange || null;
    if (timeRange !== this.flightTimeRange) {
      this.flightTimeRange = timeRange;
      this._computePlaybackRate();
    }

    // Update video source when flight changes
    if (flightId && this.changeDetector.hasChanged('flightId', flightId)) {
      console.log('[FlightMovieStore] Loading video for flight:', flightId);
      this.updateVideoSource(flightId);
      this.lastSyncedProgress = null;
      this.isInGap = false;
      this.wasPlayingBeforeSeek = false;
      this.changeDetector.updateAll({
        flightId,
        progress: null,
        isPlaying: null,
        isSeeking: null
      });

      return; // Exit early to avoid duplicate play/pause logic
    }

    // Handle seeking state transitions
    if (this.changeDetector.hasChanged('isSeeking', isSeeking)) {
      if (isSeeking) {
        // User started seeking - pause video and remember if was playing
        this.wasPlayingBeforeSeek = !this.video.paused;
        if (this.wasPlayingBeforeSeek) {
          console.log('[FlightMovieStore] Seeking started - pausing video');
          this.pause();
        }
      } else {
        // User finished seeking - resume if was playing before
        if (this.wasPlayingBeforeSeek && isPlaying) {
          console.log('[FlightMovieStore] Seeking ended - resuming playback');
          this.play();
        }
        this.wasPlayingBeforeSeek = false;
      }
      this.changeDetector.update('isSeeking', isSeeking);
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

    // Handle gap transitions (only when not seeking)
    if (!isSeeking && currentlyInGap !== this.isInGap) {
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

    // Sync play/pause state (only when not in a gap and not seeking)
    if (!currentlyInGap && !isSeeking && this.changeDetector.hasChanged('isPlaying', isPlaying)) {
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
      // - When seeking: always seek immediately for responsive scrubbing
      // - When paused: seek on any progress change
      // - When playing: only correct if drift exceeds 1s (video plays at calculatedPlaybackRate
      //   which is tuned to match the timeline, so drift should remain small)
      const shouldSeek = isSeeking || !isPlaying || timeDrift > 1.0;

      if (shouldSeek) {
        // Convert progress (0-1) to seconds based on video duration
        const timeInSeconds = targetVideoTime;
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

    const videoUrl = `/api/movies/${encodeURIComponent(flightId)}`;

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

    // Set playback rate to stay in sync with the 20x timeline.
    // calculatedPlaybackRate accounts for the ratio of video.duration to effective
    // data duration (data span minus gaps), so playback stays aligned without
    // constant seeking.
    this.video.playbackRate = this.calculatedPlaybackRate;

    // If already playing at the correct rate, no-op
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

    // Ensure playback rate is set before seeking. When playbackRate is at the
    // browser default (1.0), frame-accurate seeks decode frames one-by-one from
    // the nearest keyframe to the target, appearing as slow-motion playback.
    // Setting it here ensures the correct rate even before the first play() call.
    if (this.video.playbackRate !== this.calculatedPlaybackRate) {
      this.video.playbackRate = this.calculatedPlaybackRate;
    }

    try {
      // fastSeek() jumps directly to the nearest keyframe without decoding
      // intermediate frames, eliminating the frame-by-frame animation on seek.
      // Falls back to currentTime assignment on browsers that don't support it.
      if (this.video.fastSeek) {
        this.video.fastSeek(clampedTime);
      } else {
        this.video.currentTime = clampedTime;
      }
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
   * Compute the video playback rate needed to stay in sync with the 20x timeline.
   *
   * playbackRate = (PLAYBACK_SPEED * video.duration * 1000) / effectiveDataMs
   *
   * where effectiveDataMs = dataSpanMs - totalGapDuration.
   * If the video duration exactly matches the non-gap data span this gives 20x;
   * shorter or longer videos are scaled proportionally.
   */
  _computePlaybackRate() {
    const BASE_SPEED = 20;

    if (!this.video.duration || !this.flightTimeRange) {
      this.basePlaybackRate = BASE_SPEED;
      this.calculatedPlaybackRate = BASE_SPEED * this.speedMultiplier;
      return;
    }

    const { start, end } = this.flightTimeRange;
    const dataSpanMs = end.getTime() - start.getTime();
    const totalGapDuration = this.gapConfig?.totalGapDuration || 0;
    const effectiveDataMs = dataSpanMs - totalGapDuration;

    if (effectiveDataMs <= 0) {
      this.basePlaybackRate = BASE_SPEED;
      this.calculatedPlaybackRate = BASE_SPEED * this.speedMultiplier;
      return;
    }

    this.basePlaybackRate = (BASE_SPEED * this.video.duration * 1000) / effectiveDataMs;
    this.calculatedPlaybackRate = this.basePlaybackRate * this.speedMultiplier;

    console.log('[FlightMovieStore] Computed playback rate:', {
      videoDuration: this.video.duration.toFixed(1) + 's',
      effectiveDataMs,
      basePlaybackRate: this.basePlaybackRate.toFixed(3),
      speedMultiplier: this.speedMultiplier,
      calculatedPlaybackRate: this.calculatedPlaybackRate.toFixed(3)
    });
  }

  /**
   * Set speed multiplier (1 = normal, 2 = 2x faster, etc.)
   * Should match the multiplier set on TimelineControllerStore.
   */
  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
    this.calculatedPlaybackRate = this.basePlaybackRate * multiplier;
    // Apply immediately if currently playing
    if (this.video && !this.video.paused) {
      this.video.playbackRate = this.calculatedPlaybackRate;
    }
    console.log('[FlightMovieStore] Speed multiplier set to:', multiplier,
      '(playbackRate:', this.calculatedPlaybackRate.toFixed(3) + ')');
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
      this._computePlaybackRate();
      return;
    }

    this.gapConfig = createGapConfig(rawGaps, timeRange);
    this._computePlaybackRate();
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
