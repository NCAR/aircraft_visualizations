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
  timelineSeekStart,
  timelineSeekEnd,
  timelineUpdateProgress,
  setTimelineWindow
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
    this.lastFrameTime = null;  // Track last frame timestamp for real elapsed time
    this.gapConfig = null;  // Gap configuration for video timeline sync
    this.videoDuration = null;  // Video duration in milliseconds (without gaps)
    this.pendingPlay = false;  // Queue play request if data not loaded yet
    this.speedMultiplier = 1.0;  // User-selected speed multiplier (1x = 20x real-time)

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
   * Set gap configuration for timeline
   * Called when flight data is loaded with video gap information
   */
  setGapConfig(gapConfig) {
    this.gapConfig = gapConfig;
    
    if (gapConfig) {
      console.log('[TimelineControllerStore] Gap config set:', {
        timeRange: {
          start: gapConfig.timeRange.start.toISOString(),
          end: gapConfig.timeRange.end.toISOString()
        },
        totalGapDuration: gapConfig.totalGapDuration,
        gapCount: gapConfig.parsedGaps?.length || 0
      });
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

    // Calculate video duration accounting for gaps
    // If gapConfig exists, subtract gap durations from full data duration
    let videoDurationMs = dataSpanMs;
    if (this.gapConfig && this.gapConfig.totalGapDuration) {
      videoDurationMs = dataSpanMs - this.gapConfig.totalGapDuration;
    }
    this.videoDuration = videoDurationMs;

    console.log('[TimelineControllerStore] Timeline range set:', {
      dataStartTime: this.dataStartTime.toISOString(),
      dataEndTime: this.dataEndTime.toISOString(),
      dataSpanSecs: dataSpanSecs.toFixed(2),
      gapDurationMs: this.gapConfig?.totalGapDuration || 0,
      videoDurationMs: videoDurationMs,
      videoDurationSecs: (videoDurationMs / 1000).toFixed(2)
    });

    // If play was requested before data loaded, start now
    if (this.pendingPlay) {
      console.log('[TimelineControllerStore] Data loaded, starting pending playback');
      this.pendingPlay = false;
      this.dispatch(timelinePlay());
    }
  }

  /**
   * Animation loop
   * Advances timeline at constant 20x playback speed
   */
  updateTimeline = (timestamp) => {
    if (!this.isRunning || !this.dataStartTime || !this.dataEndTime) {
      return;
    }

    // Initialize lastFrameTime on first frame
    if (this.lastFrameTime === null) {
      this.lastFrameTime = timestamp;
    }

    // Calculate actual elapsed time since last frame (in milliseconds)
    const elapsedMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Play at 20x base speed, scaled by user multiplier
    const PLAYBACK_SPEED = 20 * this.speedMultiplier;
    const scaledElapsedMs = elapsedMs * PLAYBACK_SPEED;
    
    let nextDataTime = new Date(this.currentDataTime.getTime() + scaledElapsedMs);

    // Check if we've reached the end
    const dataSpanMs = this.dataEndTime.getTime() - this.dataStartTime.getTime();
    if (nextDataTime.getTime() > this.dataEndTime.getTime()) {
      console.log('[TimelineControllerStore] Reached end of timeline');
      this.dispatch(timelinePause());
      // Reset to beginning
      this.currentDataTime = this.dataStartTime;
      this.lastFrameTime = null;  // Reset for next playback
      const progress = 0;
      this.dispatch(timelineUpdateProgress(progress, this.currentDataTime));
      return;
    }

    this.currentDataTime = nextDataTime;

    // Calculate progress (0 to 1)
    const currentMs = this.currentDataTime.getTime() - this.dataStartTime.getTime();
    const progress = currentMs / dataSpanMs;

    // Dispatch progress update to store (this will update all components)
    this.dispatch(timelineUpdateProgress(progress, this.currentDataTime));

    // Continue animation
    this.animationFrameId = requestAnimationFrame(this.updateTimeline);
  }

  /**
   * Public API: Set speed multiplier (1 = 20x real-time, 2 = 40x, etc.)
   */
  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
    console.log('[TimelineControllerStore] Speed multiplier set to:', multiplier, '(' + (20 * multiplier) + 'x real-time)');
  }

  /**
   * Public API: Start playback
   */
  start() {
    if (!this.dataStartTime) {
      // Data not loaded yet - queue the play request
      console.log('[TimelineControllerStore] Play requested, waiting for data to load...');
      this.pendingPlay = true;
      return;
    }
    this.pendingPlay = false;
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
    this.lastFrameTime = null;  // Reset frame time on start
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
 * Renders a timeline track with draggable selection window, sparkline, and playhead
 */
export class TimelineUI {
  constructor(store, timelineController) {
    this.store = store;
    this.timelineController = timelineController;
    this.playPauseButton = document.getElementById('play-pause-button');
    this.timeDisplay = document.getElementById('current-time-display');
    this.timelineTicks = document.getElementById('timeline-ticks');
    this.track = document.getElementById('timeline-track');
    this.wasPlayingBeforeSeek = false;

    // DOM refs created in init
    this.windowEl = null;
    this.leftHandle = null;
    this.rightHandle = null;
    this.leftLabel = null;
    this.rightLabel = null;
    this.playhead = null;
    this.seekTooltip = null;
    this.sparklineSVG = null;

    // Drag state — suppress click-to-seek after an actual drag
    this._didDrag = false;

    // Cached sparkline data (avoid recomputing every frame)
    this._sparklinePath = null;
    this._lastFlightId = null;

    this.init();
  }

  init() {
    this.createWindowOverlay();
    this.createPlayhead();
    this.setupTrackClick();
    this.setupPlayPause();
    this.setupWindowDrag();
    this.setupPlayheadDrag();
    this.setupResizeObserver();
    this.subscribeToStore();
  }

  // ── DOM Creation ──────────────────────────────────────────

  /**
   * Create the sparkline, selection window, and handles on the track.
   * Sparkline spans the full track. Handles are siblings on the track.
   */
  createWindowOverlay() {
    if (!this.track) return;

    // Sparkline SVG — spans full track width, behind everything
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'timeline-sparkline');
    svg.setAttribute('preserveAspectRatio', 'none');
    this.track.appendChild(svg);

    // Selection window — spans full track by default
    const win = document.createElement('div');
    win.className = 'timeline-window';
    win.style.left = '0%';
    win.style.width = '100%';
    this.track.appendChild(win);

    // Left handle
    const lh = document.createElement('div');
    lh.className = 'timeline-handle timeline-handle-left';
    const ll = document.createElement('div');
    ll.className = 'timeline-handle-label';
    ll.textContent = '--:--';
    lh.appendChild(ll);
    this.track.appendChild(lh);

    // Right handle
    const rh = document.createElement('div');
    rh.className = 'timeline-handle timeline-handle-right';
    const rl = document.createElement('div');
    rl.className = 'timeline-handle-label';
    rl.textContent = '--:--';
    rh.appendChild(rl);
    this.track.appendChild(rh);

    this.windowEl = win;
    this.leftHandle = lh;
    this.rightHandle = rh;
    this.leftLabel = ll;
    this.rightLabel = rl;
    this.sparklineSVG = svg;

    this._updateHandlePositions();
    this._dispatchWindowFromDOM();
  }

  /**
   * Create the orange playhead line
   */
  createPlayhead() {
    if (!this.track) return;
    const ph = document.createElement('div');
    ph.className = 'timeline-playhead';
    ph.style.left = '0%';
    this.track.appendChild(ph);
    this.playhead = ph;

    // Seek tooltip — follows cursor above the track
    const tip = document.createElement('div');
    tip.className = 'timeline-seek-tooltip';
    tip.textContent = '--:--:--';
    this.track.appendChild(tip);
    this.seekTooltip = tip;
  }

  // ── Event Handling ────────────────────────────────────────

  /**
   * Redraw sparkline and reposition handles when the track resizes.
   */
  setupResizeObserver() {
    if (!this.track) return;
    let prevTrackWidth = this.track.offsetWidth;

    this._resizeObserver = new ResizeObserver(() => {
      const newWidth = this.track.offsetWidth;

      // Rescale window position proportionally so it keeps the same relative span
      if (this.windowEl && prevTrackWidth > 0 && newWidth !== prevTrackWidth) {
        const ratio = newWidth / prevTrackWidth;
        const oldLeft = this.windowEl.offsetLeft;
        const oldW = this.windowEl.offsetWidth;
        this.windowEl.style.left = `${oldLeft * ratio}px`;
        this.windowEl.style.width = `${oldW * ratio}px`;
      }
      prevTrackWidth = newWidth;

      this.drawSparkline();
      this._updateSparklinePosition();
      this._updateHandlePositions();
    });
    this._resizeObserver.observe(this.track);
  }

  /**
   * Click anywhere on the track (including through the window) to seek.
   * Mousemove updates the hover guide CSS variable.
   * A short‐distance click on the window seeks; a drag moves the window.
   */
  setupTrackClick() {
    if (!this.track) return;

    // Hover guide + seek tooltip
    this.track.addEventListener('mousemove', (e) => {
      const rect = this.track.getBoundingClientRect();
      const px = e.clientX - rect.left;
      this.track.style.setProperty('--hover-x', `${px}px`);

      // Position and update seek tooltip
      if (this.seekTooltip) {
        this.seekTooltip.style.left = `${px}px`;

        const state = this.store.getState();
        const flightData = getCurrentFlightData(state);
        if (flightData && flightData.timeRange) {
          const progress = Math.max(0, Math.min(1, px / rect.width));
          const { start, end } = flightData.timeRange;
          const spanMs = end.getTime() - start.getTime();
          const hoverTime = new Date(start.getTime() + spanMs * progress);
          this.seekTooltip.textContent = d3.timeFormat("%H:%M:%S")(hoverTime);
        }
      }
    });
    this.track.addEventListener('mouseleave', () => {
      this.track.style.setProperty('--hover-x', '-100px');
    });

    // Click to seek — handles are excluded, but window clicks pass through
    // If a drag just occurred (_didDrag), suppress the click so we don't seek
    this._seekOnClick = (e) => {
      if (this._didDrag) {
        this._didDrag = false;
        return;
      }
      if (e.target.closest('.timeline-handle')) return;

      this._seekFromClientX(e.clientX);
    };
    this.track.addEventListener('click', this._seekOnClick);
  }

  _seekFromClientX(clientX) {
    if (!this.track) return;
    const rect = this.track.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

    const state = this.store.getState();
    if (isTimelinePlaying(state)) {
      this.wasPlayingBeforeSeek = true;
      this.store.dispatch(timelinePause());
    }

    // Signal seeking start, perform seek, then signal seeking end
    this.store.dispatch(timelineSeekStart());
    this.timelineController.seekToProgress(progress);
    this.store.dispatch(timelineSeekEnd());

    if (this.wasPlayingBeforeSeek) {
      this.store.dispatch(timelinePlay());
      this.wasPlayingBeforeSeek = false;
    }
  }

  /**
   * Play/Pause button
   */
  setupPlayPause() {
    if (!this.playPauseButton) return;
    this.playPauseButton.addEventListener('click', () => {
      const state = this.store.getState();
      if (isTimelinePlaying(state)) {
        this.timelineController.stop();
      } else {
        this.timelineController.start();
      }
    });
  }

  /**
   * Drag/resize the selection window and handles.
   * Handles are siblings of the window on the track, so we bind
   * mousedown/touchstart on each element separately.
   * Supports both mouse and touch events for mobile compatibility.
   */
  setupWindowDrag() {
    if (!this.windowEl || !this.track) return;

    let dragType = null; // 'move' | 'left' | 'right'
    let dragStartX = 0;
    let dragStartLeft = 0;
    let dragStartWidth = 0;

    const DRAG_THRESHOLD = 3; // px – movement beyond this counts as a drag

    // Get X coordinate from either mouse or touch event
    const getClientX = (e) => {
      if (e.touches && e.touches.length > 0) {
        return e.touches[0].clientX;
      }
      return e.clientX;
    };

    const startDrag = (type, e) => {
      dragType = type;
      dragStartX = getClientX(e);
      dragStartLeft = this.windowEl.offsetLeft;
      dragStartWidth = this.windowEl.offsetWidth;
      this._didDrag = false;
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    };

    // Mouse events for window and handles
    this.windowEl.addEventListener('mousedown', (e) => startDrag('move', e));
    if (this.leftHandle) {
      this.leftHandle.addEventListener('mousedown', (e) => startDrag('left', e));
    }
    if (this.rightHandle) {
      this.rightHandle.addEventListener('mousedown', (e) => startDrag('right', e));
    }

    // Touch events for window and handles (mobile support)
    this.windowEl.addEventListener('touchstart', (e) => startDrag('move', e), { passive: false });
    if (this.leftHandle) {
      this.leftHandle.addEventListener('touchstart', (e) => startDrag('left', e), { passive: false });
    }
    if (this.rightHandle) {
      this.rightHandle.addEventListener('touchstart', (e) => startDrag('right', e), { passive: false });
    }

    const onMove = (e) => {
      if (!dragType) return;
      const trackWidth = this.track.offsetWidth;
      const dx = getClientX(e) - dragStartX;

      // Mark as a real drag once movement exceeds threshold
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        this._didDrag = true;
      }

      let newLeft = dragStartLeft;
      let newWidth = dragStartWidth;
      const MIN_WIDTH = 20;

      if (dragType === 'move') {
        newLeft = Math.max(0, Math.min(trackWidth - dragStartWidth, dragStartLeft + dx));
      } else if (dragType === 'left') {
        newLeft = Math.max(0, Math.min(dragStartLeft + dx, dragStartLeft + dragStartWidth - MIN_WIDTH));
        newWidth = dragStartWidth + (dragStartLeft - newLeft);
      } else if (dragType === 'right') {
        newWidth = Math.max(MIN_WIDTH, Math.min(trackWidth - dragStartLeft, dragStartWidth + dx));
      }

      // Clamp
      newLeft = Math.max(0, Math.min(trackWidth - newWidth, newLeft));
      newWidth = Math.max(MIN_WIDTH, Math.min(trackWidth - newLeft, newWidth));

      this.windowEl.style.left = `${newLeft}px`;
      this.windowEl.style.width = `${newWidth}px`;

      // Keep handles and labels in sync while dragging
      this._updateHandlePositions();
      this._updateHandleLabels();
    };

    const onEnd = (e) => {
      if (!dragType) return;
      if (
        e &&
        e.type &&
        e.type.startsWith('touch') &&
        dragType === 'move' &&
        !this._didDrag
      ) {
        const touch = e.changedTouches && e.changedTouches[0];
        if (touch) {
          this._seekFromClientX(touch.clientX);
        }
      }
      dragType = null;
      document.body.style.userSelect = '';
      this._dispatchWindowFromDOM();
    };

    // Mouse move/up events
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // Touch move/end events (mobile support)
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);

    // Store refs for cleanup
    this._dragCleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }

  /**
   * Allow the playhead to be dragged directly to seek.
   * The playhead sits above the selection window (z-index 9 vs. window auto),
   * so mousedown on the playhead is caught here before the window drag fires.
   */
  setupPlayheadDrag() {
    if (!this.playhead || !this.track) return;

    let dragging = false;

    const getClientX = (e) => e.touches?.[0]?.clientX ?? e.clientX;

    const onStart = (e) => {
      e.stopPropagation(); // prevent windowEl drag from starting
      e.preventDefault();
      dragging = true;
      document.body.style.userSelect = 'none';

      const state = this.store.getState();
      if (isTimelinePlaying(state)) {
        this.wasPlayingBeforeSeek = true;
        this.store.dispatch(timelinePause());
      }
      this.store.dispatch(timelineSeekStart());

      const rect = this.track.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (getClientX(e) - rect.left) / rect.width));
      this.timelineController.seekToProgress(progress);
    };

    const onMove = (e) => {
      if (!dragging) return;
      const rect = this.track.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (getClientX(e) - rect.left) / rect.width));
      this.timelineController.seekToProgress(progress);
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      this.store.dispatch(timelineSeekEnd());
      if (this.wasPlayingBeforeSeek) {
        this.store.dispatch(timelinePlay());
        this.wasPlayingBeforeSeek = false;
      }
    };

    this.playhead.addEventListener('mousedown', onStart);
    this.playhead.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);

    this._playheadDragCleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }

  // ── Rendering ─────────────────────────────────────────────

  /**
   * Position handles at the window's left and right edges.
   * Called whenever the window moves/resizes.
   */
  _updateHandlePositions() {
    if (!this.windowEl || !this.leftHandle || !this.rightHandle) return;
    const winLeft = this.windowEl.offsetLeft;
    const winWidth = this.windowEl.offsetWidth;
    this.leftHandle.style.left = `${winLeft}px`;
    this.rightHandle.style.left = `${winLeft + winWidth}px`;
  }

  /**
   * Update handle time labels based on current window position
   */
  _updateHandleLabels() {
    if (!this.windowEl || !this.track) return;
    const state = this.store.getState();
    const flightData = getCurrentFlightData(state);
    if (!flightData || !flightData.timeRange) return;

    const trackWidth = this.track.offsetWidth;
    const winLeft = this.windowEl.offsetLeft;
    const winWidth = this.windowEl.offsetWidth;

    const { start, end } = flightData.timeRange;
    const spanMs = end.getTime() - start.getTime();

    const startProgress = winLeft / trackWidth;
    const endProgress = (winLeft + winWidth) / trackWidth;

    const startTime = new Date(start.getTime() + spanMs * startProgress);
    const endTime = new Date(start.getTime() + spanMs * endProgress);

    if (this.leftLabel) {
      this.leftLabel.textContent = d3.timeFormat("%H:%M")(startTime);
    }
    if (this.rightLabel) {
      this.rightLabel.textContent = d3.timeFormat("%H:%M")(endTime);
    }
  }

  /**
   * Size the sparkline SVG to fill the full track.
   */
  _updateSparklinePosition() {
    if (!this.sparklineSVG || !this.track) return;
    const trackWidth = this.track.offsetWidth;
    const trackHeight = this.track.offsetHeight || 36;
    this.sparklineSVG.setAttribute('width', trackWidth);
    this.sparklineSVG.setAttribute('height', trackHeight);
  }

  /**
   * Dispatch the current window bounds to Redux
   */
  _dispatchWindowFromDOM() {
    if (!this.windowEl || !this.track) return;
    const trackWidth = this.track.offsetWidth;
    const left = this.windowEl.offsetLeft;
    const width = this.windowEl.offsetWidth;
    const startP = Math.max(0, Math.min(1, left / trackWidth));
    const endP = Math.max(0, Math.min(1, (left + width) / trackWidth));
    this.store.dispatch(setTimelineWindow(startP, endP, 'dashboard'));
  }

  /**
   * Generate timeline tick marks below the track
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
   * Format time for display
   */
  formatTimeParts(date) {
    if (!date) return { dateStr: 'Month DD, YYYY', timeStr: '00:00:00' };
    const dateStr = d3.timeFormat("%B %d, %Y")(date);
    const timeStr = d3.timeFormat("%H:%M:%S")(date);
    return { dateStr, timeStr };
  }

  /**
   * Build and cache the sparkline path from ggalt data
   */
  _buildSparklinePath() {
    const state = this.store.getState();
    const flightId = state.selection?.flightId;

    // Only rebuild if flight changed
    if (flightId === this._lastFlightId && this._sparklinePath !== null) return;
    this._lastFlightId = flightId;

    const timeseries = state.data?.flightData?.[flightId]?.timeseries || [];
    if (!timeseries || timeseries.length === 0) {
      this._sparklinePath = '';
      return;
    }

    const ggaltData = timeseries.map(row => ({
      t: row.Time instanceof Date ? row.Time.getTime() : new Date(row.Time).getTime(),
      v: row.ggalt !== undefined ? row.ggalt : (row.GGALT !== undefined ? row.GGALT : null)
    })).filter(d => d.v !== null && d.v !== undefined);
    if (ggaltData.length < 2) {
      this._sparklinePath = '';
      return;
    }

    const tMin = Math.min(...ggaltData.map(d => d.t));
    const tMax = Math.max(...ggaltData.map(d => d.t));
    const vMin = Math.min(...ggaltData.map(d => d.v));
    const vMax = Math.max(...ggaltData.map(d => d.v));

    // Store scales for reuse
    this._sparklineScales = { tMin, tMax, vMin, vMax };
    this._sparklineData = ggaltData;
    this._sparklinePath = 'ready'; // Flag that data is ready
  }

  /**
   * Render the sparkline into the SVG element, scaled to the track width
   */
  drawSparkline() {
    if (!this.sparklineSVG || !this.track) return;

    this._buildSparklinePath();
    if (!this._sparklinePath || !this._sparklineData) {
      this.sparklineSVG.innerHTML = '';
      return;
    }

    const trackWidth = this.track.offsetWidth;
    const height = this.track.offsetHeight || 36;
    const { tMin, tMax, vMin, vMax } = this._sparklineScales;

    const scaleX = t => ((t - tMin) / (tMax - tMin)) * trackWidth;
    const scaleY = v => height - ((v - vMin) / (vMax - vMin)) * (height - 4) - 2;

    let path = '';
    this._sparklineData.forEach((d, i) => {
      const x = scaleX(d.t);
      const y = scaleY(d.v);
      path += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
    });

    this.sparklineSVG.innerHTML = `<path d="${path}" stroke="#53565abf" stroke-width="1.5" fill="none" opacity="0.7"/>`;
  }

  /**
   * Subscribe to store and update all UI elements
   */
  subscribeToStore() {
    let lastTickFlightId = null;
    let hadData = false;
    let lastTimelineWindow = null;

    this.store.subscribe((state) => {
      const progress = getTimelineProgress(state);
      const isPlaying = isTimelinePlaying(state);
      const flightData = getCurrentFlightData(state);
      const flightId = state.selection?.flightId;
      const hasData = !!(flightData && flightData.timeseries && flightData.timeseries.length > 0);

      // Update playhead position
      if (this.playhead) {
        this.playhead.style.left = `${progress * 100}%`;
      }

      // Update play/pause icon
      if (this.playPauseButton) {
        const icon = this.playPauseButton.querySelector('i');
        if (icon) {
          icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
      }

      // Update time display
      if (this.timeDisplay && flightData && flightData.timeRange) {
        const spanMs = flightData.timeRange.end.getTime() - flightData.timeRange.start.getTime();
        const currentMs = flightData.timeRange.start.getTime() + (spanMs * progress);
        const currentTime = new Date(currentMs);
        const { dateStr, timeStr } = this.formatTimeParts(currentTime);
        this.timeDisplay.innerHTML = `<div class="time-display-date">${dateStr}</div><div class="time-display-time">${timeStr}</div>`;
      }

      // Regenerate ticks/sparkline when flight changes OR when data first arrives
      const flightChanged = flightId !== lastTickFlightId;
      const dataJustLoaded = hasData && !hadData;

      if (flightChanged || dataJustLoaded) {
        lastTickFlightId = flightId;
        hadData = hasData;
        this._lastFlightId = null; // Force sparkline rebuild
        this.generateTimelineTicks();
        this.drawSparkline();
        this._updateSparklinePosition();
        this._updateHandlePositions();
        this._updateHandleLabels();
      } else {
        hadData = hasData;
      }

      // Restore timeline window from URL state
      // This applies the window position from store to DOM (for URL restoration)
      const timelineWindow = state.ui?.charts?.dashboard?.timelineWindow;
      if (timelineWindow && this.windowEl && this.track) {
        const windowChanged = (
          timelineWindow.start !== lastTimelineWindow?.start ||
          timelineWindow.end !== lastTimelineWindow?.end
        );

        if (windowChanged) {
          lastTimelineWindow = timelineWindow;

          // Helper function to apply window position
          const applyWindowPosition = () => {
            const trackWidth = this.track.offsetWidth;

            console.log('[TimelineUI] Timeline window changed:', {
              start: timelineWindow.start,
              end: timelineWindow.end,
              trackWidth,
              willApply: trackWidth > 0
            });

            if (trackWidth > 0) {
              const left = timelineWindow.start * trackWidth;
              const width = (timelineWindow.end - timelineWindow.start) * trackWidth;

              this.windowEl.style.left = `${left}px`;
              this.windowEl.style.width = `${width}px`;

              this._updateHandlePositions();
              this._updateHandleLabels();
              console.log('[TimelineUI] Applied window position:', { left, width });
              return true;
            }
            return false;
          };

          // Try immediately
          if (!applyWindowPosition()) {
            // Retry after layout settles
            console.log('[TimelineUI] Track not ready, will retry after layout');
            requestAnimationFrame(() => {
              if (!applyWindowPosition()) {
                // One more retry after a short delay
                setTimeout(() => applyWindowPosition(), 100);
              }
            });
          }
        }
      }
    });
  }
}
