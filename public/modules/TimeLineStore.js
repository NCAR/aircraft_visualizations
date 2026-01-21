/**
 * TimelineController - Store-connected version
 * Manages timeline animation and dispatches progress updates to store
 */

import { IComponent } from '../interfaces/IComponent.js';
import {
  getCurrentFlightData,
  isTimelinePlaying,
  getTimelineProgress
} from '../store/selectors/selectors.js';
import {
  timelinePlay,
  timelinePause,
  timelineSeek,
  timelineUpdateProgress
} from '../store/actions/uiActions.js';

export default class TimelineControllerStore extends IComponent {
  constructor(store) {
    super(store);

    this.isRunning = false;
    this.animationFrameId = null;
    this.dataStartTime = null;
    this.dataEndTime = null;
    this.currentDataTime = null;
    this.lastData = null;

    // Connect to store
    this.connect();
    this.onStateChange(this.getState());

    console.log('[TimelineControllerStore] Created');
  }

  /**
   * Handle store state changes
   */
  onStateChange(state) {
    const flightData = getCurrentFlightData(state);
    const isPlaying = isTimelinePlaying(state);

    // Update timeline range when flight data changes
    if (flightData && flightData.timeseries && flightData.timeseries !== this.lastData) {
      console.log('[TimelineControllerStore] Setting timeline range from flight data');
      this.setTimelineRange(flightData.timeseries);
      this.lastData = flightData.timeseries;
    }

    // Sync play state
    if (isPlaying && !this.isRunning) {
      this.startInternal();
    } else if (!isPlaying && this.isRunning) {
      this.stopInternal();
    }
  }

  /**
   * Set timeline range based on data
   */
  setTimelineRange(data) {
    if (!data || data.length === 0) {
      console.warn('[TimelineControllerStore] No data for timeline range');
      return;
    }

    this.dataStartTime = data[0].Time;
    this.dataEndTime = data[data.length - 1].Time;
    this.currentDataTime = this.dataStartTime;

    const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
    const dataSpanSecs = dataSpanMs / 1000;

    console.log('[TimelineControllerStore] Timeline range set:', {
      dataStartTime: this.dataStartTime.toISOString(),
      dataEndTime: this.dataEndTime.toISOString(),
      dataSpanSecs: dataSpanSecs.toFixed(2)
    });
  }

  /**
   * Animation loop
   */
  updateTimeline = (timestamp) => {
    if (!this.isRunning || !this.dataStartTime || !this.dataEndTime) {
      return;
    }

    // Calculate next data time (increment by ~50ms per frame for smoother animation)
    const delta = 50; // ms per frame
    let nextDataTime = new Date(this.currentDataTime.getTime() + delta);

    // Check if we've reached the end
    if (nextDataTime.getTime() > this.dataEndTime.getTime()) {
      console.log('[TimelineControllerStore] Reached end of timeline');
      this.dispatch(timelinePause());
      // Reset to beginning
      this.currentDataTime = this.dataStartTime;
      const progress = 0;
      this.dispatch(timelineUpdateProgress(progress, this.currentDataTime));
      return;
    }

    this.currentDataTime = nextDataTime;

    // Calculate progress (0 to 1)
    const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
    const currentMs = this.currentDataTime.getTime() - this.dataStartTime.getTime();
    const progress = currentMs / dataSpanMs;

    // Dispatch progress update to store (this will update all components)
    this.dispatch(timelineUpdateProgress(progress, this.currentDataTime));

    // Continue animation
    this.animationFrameId = requestAnimationFrame(this.updateTimeline);
  }

  /**
   * Public API: Start playback
   */
  start() {
    if (!this.dataStartTime) {
      console.warn('[TimelineControllerStore] Cannot start - no timeline range set');
      return;
    }
    this.dispatch(timelinePlay());
  }

  /**
   * Public API: Stop playback
   */
  stop() {
    this.dispatch(timelinePause());
  }

  /**
   * Public API: Seek to specific time
   */
  seekToTime(newTime) {
    if (!this.dataStartTime || !this.dataEndTime) {
      console.warn('[TimelineControllerStore] Cannot seek - no timeline range set');
      return;
    }

    // Clamp time to valid range
    const clampedTime = new Date(Math.max(
      this.dataStartTime.getTime(),
      Math.min(newTime.getTime(), this.dataEndTime.getTime())
    ));

    this.currentDataTime = clampedTime;

    // Calculate progress
    const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
    const currentMs = this.currentDataTime.getTime() - this.dataStartTime.getTime();
    const progress = currentMs / dataSpanMs;

    console.log('[TimelineControllerStore] Seeking to:', {
      time: clampedTime.toISOString(),
      progress: progress.toFixed(3)
    });

    // Dispatch seek action
    this.dispatch(timelineSeek(progress, clampedTime));
  }

  /**
   * Public API: Seek to progress (0 to 1)
   */
  seekToProgress(progress) {
    if (!this.dataStartTime || !this.dataEndTime) {
      console.warn('[TimelineControllerStore] Cannot seek - no timeline range set');
      return;
    }

    // Clamp progress to [0, 1]
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Calculate time
    const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
    const targetMs = this.dataStartTime.getTime() + (dataSpanMs * clampedProgress);
    const targetTime = new Date(targetMs);

    this.currentDataTime = targetTime;

    console.log('[TimelineControllerStore] Seeking to progress:', {
      progress: clampedProgress.toFixed(3),
      time: targetTime.toISOString()
    });

    // Dispatch seek action
    this.dispatch(timelineSeek(clampedProgress, targetTime));
  }

  /**
   * Internal: Start animation (called from onStateChange)
   */
  startInternal() {
    if (this.isRunning) return;

    console.log('[TimelineControllerStore] Starting animation');
    this.isRunning = true;
    this.animationFrameId = requestAnimationFrame(this.updateTimeline);
  }

  /**
   * Internal: Stop animation (called from onStateChange)
   */
  stopInternal() {
    if (!this.isRunning) return;

    console.log('[TimelineControllerStore] Stopping animation');
    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log('[TimelineControllerStore] Destroying');

    // Stop animation
    this.stopInternal();

    // Disconnect from store
    super.destroy();
  }
}

/**
 * Timeline UI Components
 * Manages timeline slider, ticks, and display
 */
export class TimelineUI {
  constructor(store, timelineController) {
    this.store = store;
    this.timelineController = timelineController;
    this.timeSlider = document.getElementById('time-slider');
    this.playPauseButton = document.getElementById('play-pause-button');
    this.timeDisplay = document.getElementById('current-time-display');
    this.timelineTicks = document.getElementById('timeline-ticks');
    this.timelineProgress = document.getElementById('timeline-progress');
    this.wasPlayingBeforeSeek = false;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.subscribeToStore();
  }

  /**
   * Generate timeline tick marks based on flight data
   */
  generateTimelineTicks() {
    if (!this.timelineTicks) return;

    const state = this.store.getState();
    const flightData = getCurrentFlightData(state);
    if (!flightData || !flightData.timeRange) {
      this.timelineTicks.innerHTML = '';
      return;
    }

    const { start, end } = flightData.timeRange;
    const spanMs = end.getTime() - start.getTime();
    
    // Responsive number of ticks: 5 on mobile, 10 on desktop
    const isMobile = window.innerWidth < 768;
    const numTicks = isMobile ? 5 : 10;
    const ticksHTML = [];
    
    for (let i = 0; i <= numTicks; i++) {
      const progress = i / numTicks;
      const tickTime = new Date(start.getTime() + (spanMs * progress));
      const timeStr = d3.timeFormat("%H:%M")(tickTime);
      
      ticksHTML.push(`
        <div class="timeline-tick" style="left: ${progress * 100}%">
          <div class="timeline-tick-mark"></div>
          <div class="timeline-tick-label">${timeStr}</div>
        </div>
      `);
    }
    
    this.timelineTicks.innerHTML = ticksHTML.join('');
  }

  /**
   * Format time for display - returns { dateStr, timeStr } in local time
   */
  formatTimeParts(date) {
    if (!date) return { dateStr: 'Month DD, YYYY', timeStr: '00:00:00' };

    const dateStr = d3.timeFormat("%B %d, %Y")(date);
    const timeStr = d3.timeFormat("%H:%M:%S")(date);
    return { dateStr, timeStr };
  }

  /**
   * Setup event listeners for timeline controls
   */
  setupEventListeners() {
    // Slider input (dragging)
    if (this.timeSlider) {
      this.timeSlider.addEventListener('input', (e) => {
        const state = this.store.getState();
        const flightData = getCurrentFlightData(state);
        if (!flightData || !flightData.timeRange) return;

        // Remember play state on first input
        if (isTimelinePlaying(state) && !this.wasPlayingBeforeSeek) {
          this.wasPlayingBeforeSeek = true;
        }

        // Calculate progress (0 to 1)
        const progress = parseFloat(e.target.value) / 1000;

        // Update progress bar immediately (account for 9px thumb offset)
        if (this.timelineProgress) {
          this.timelineProgress.style.width = `calc(${progress * 100}%)`;
        }

        // Calculate time
        const timeRange = flightData.timeRange;
        const spanMs = timeRange.end.getTime() - timeRange.start.getTime();
        const targetMs = timeRange.start.getTime() + (spanMs * progress);
        const newTime = new Date(targetMs);

        // Pause playback while seeking
        if (isTimelinePlaying(state)) {
          this.store.dispatch(timelinePause());
        }

        // Seek via timeline controller
        this.timelineController.seekToProgress(progress);

        // Update display
        if (this.timeDisplay) {
          const { dateStr, timeStr } = this.formatTimeParts(newTime);
          this.timeDisplay.innerHTML = `<div class="time-display-date">${dateStr}</div><div class="time-display-time">${timeStr}</div>`;
        }
      });

      // Slider change (release)
      this.timeSlider.addEventListener('change', () => {
        // Resume playback if it was playing before
        if (this.wasPlayingBeforeSeek) {
          this.store.dispatch(timelinePlay());
          this.wasPlayingBeforeSeek = false;
        }
      });
    }

    // Play/Pause button
    if (this.playPauseButton) {
      this.playPauseButton.addEventListener('click', () => {
        const state = this.store.getState();
        const isPlaying = isTimelinePlaying(state);

        if (isPlaying) {
          this.timelineController.stop();
        } else {
          this.timelineController.start();
        }
      });
    }
  }

  /**
   * Subscribe to store updates
   */
  subscribeToStore() {
    // Update timeline UI when progress changes
    this.store.subscribe((state) => {
      const progress = getTimelineProgress(state);
      const isPlaying = isTimelinePlaying(state);

      // Update slider position
      if (this.timeSlider && !this.wasPlayingBeforeSeek) {
        this.timeSlider.value = Math.round(progress * 1000);
      }

      // Update progress bar
      if (this.timelineProgress) {
        this.timelineProgress.style.width = `calc(${progress * 100}%)`;
      }

      // Update play/pause button
      if (this.playPauseButton) {
        const icon = this.playPauseButton.querySelector('i');
        if (icon) {
          icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
      }

      // Update time display
      const flightData = getCurrentFlightData(state);
      if (this.timeDisplay && flightData && flightData.timeRange) {
        const spanMs = flightData.timeRange.end.getTime() - flightData.timeRange.start.getTime();
        const currentMs = flightData.timeRange.start.getTime() + (spanMs * progress);
        const currentTime = new Date(currentMs);
        const { dateStr, timeStr } = this.formatTimeParts(currentTime);
        this.timeDisplay.innerHTML = `<div class="time-display-date">${dateStr}</div><div class="time-display-time">${timeStr}</div>`;
      }

      // Generate ticks when flight data changes
      this.generateTimelineTicks();
    });
  }
}
