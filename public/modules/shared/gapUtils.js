/**
 * Gap Utilities for Flight Movie Timeline Synchronization
 *
 * Converts between "data progress" (0-1 on full timeline including gaps)
 * and "video progress" (0-1 on compressed timeline without gaps).
 */

/**
 * Parse gap timestamp string "YYMMDD-HHMMSS" to Date object
 * @param {string} str - Timestamp string in format "YYMMDD-HHMMSS"
 * @returns {Date} Parsed Date object
 */
export function parseGapTimestamp(str) {
  // Format: YYMMDD-HHMMSS
  const year = 2000 + parseInt(str.slice(0, 2), 10);
  const month = parseInt(str.slice(2, 4), 10) - 1; // 0-indexed
  const day = parseInt(str.slice(4, 6), 10);
  const hours = parseInt(str.slice(7, 9), 10);
  const minutes = parseInt(str.slice(9, 11), 10);
  const seconds = parseInt(str.slice(11, 13), 10);

  return new Date(year, month, day, hours, minutes, seconds);
}

/**
 * Parse raw gaps array into objects with start/end as Date and calculated duration
 * @param {Array<{start: string, end: string}>} gapsArray - Array of gap objects with timestamp strings
 * @returns {Array<{start: Date, end: Date, durationMs: number}>} Parsed gaps with duration in milliseconds
 */
export function parseGaps(gapsArray) {
  return gapsArray.map(gap => {
    const start = parseGapTimestamp(gap.start);
    const end = parseGapTimestamp(gap.end);
    const durationMs = end.getTime() - start.getTime();
    return { start, end, durationMs };
  });
}

/**
 * Get total duration of all gaps in milliseconds
 * @param {Array<{start: Date, end: Date, durationMs: number}>} parsedGaps - Parsed gaps array
 * @returns {number} Total gap duration in milliseconds
 */
export function getTotalGapDuration(parsedGaps) {
  return parsedGaps.reduce((sum, gap) => sum + gap.durationMs, 0);
}

/**
 * Calculate total gap duration before a given timestamp
 * @param {Array<{start: Date, end: Date, durationMs: number}>} parsedGaps - Parsed gaps array
 * @param {Date} timestamp - Timestamp to check against
 * @returns {number} Total gap duration in milliseconds before the timestamp
 */
export function calculateGapDurationBefore(parsedGaps, timestamp) {
  const ts = timestamp.getTime();
  let totalGapMs = 0;

  for (const gap of parsedGaps) {
    const gapStart = gap.start.getTime();
    const gapEnd = gap.end.getTime();

    if (ts <= gapStart) {
      // Timestamp is before this gap - don't count it
      break;
    } else if (ts >= gapEnd) {
      // Timestamp is after this gap - count full gap
      totalGapMs += gap.durationMs;
    } else {
      // Timestamp is within this gap - count partial
      totalGapMs += ts - gapStart;
      break;
    }
  }

  return totalGapMs;
}

/**
 * Check if a timestamp falls within any gap
 * @param {Array<{start: Date, end: Date, durationMs: number}>} parsedGaps - Parsed gaps array
 * @param {Date} timestamp - Timestamp to check
 * @returns {{inGap: boolean, gap?: {start: Date, end: Date, durationMs: number}}} Result with gap info if inside
 */
export function isWithinGap(parsedGaps, timestamp) {
  const ts = timestamp.getTime();

  for (const gap of parsedGaps) {
    const gapStart = gap.start.getTime();
    const gapEnd = gap.end.getTime();

    // Inside gap: start <= timestamp < end (start inclusive, end exclusive)
    if (ts >= gapStart && ts < gapEnd) {
      return { inGap: true, gap };
    }
  }

  return { inGap: false };
}

/**
 * Convert data progress (0-1 on full timeline) to video progress (0-1 on compressed timeline)
 * @param {number} dataProgress - Progress on the full data timeline (0-1)
 * @param {{start: Date, end: Date}} timeRange - Full data time range
 * @param {Array<{start: Date, end: Date, durationMs: number}>} parsedGaps - Parsed gaps array
 * @param {number} totalGapDuration - Total duration of all gaps in milliseconds
 * @returns {number} Progress on the video timeline (0-1)
 */
export function dataProgressToVideoProgress(dataProgress, timeRange, parsedGaps, totalGapDuration) {
  // Edge cases: pass through boundary values
  if (dataProgress <= 0) return 0;
  if (dataProgress >= 1) return 1;

  // Empty gaps: no conversion needed
  if (!parsedGaps || parsedGaps.length === 0 || totalGapDuration === 0) {
    return dataProgress;
  }

  const timeRangeStart = timeRange.start.getTime();
  const timeRangeEnd = timeRange.end.getTime();
  const fullDuration = timeRangeEnd - timeRangeStart;
  const videoDuration = fullDuration - totalGapDuration;

  // Calculate the timestamp corresponding to this progress
  const currentTimestamp = new Date(timeRangeStart + dataProgress * fullDuration);

  // Calculate how much gap time has elapsed before this timestamp
  const gapDurationBefore = calculateGapDurationBefore(parsedGaps, currentTimestamp);

  // Calculate "video time" - time elapsed minus gap time
  const dataTimeElapsed = dataProgress * fullDuration;
  const videoTimeElapsed = dataTimeElapsed - gapDurationBefore;

  // Convert to video progress
  const videoProgress = videoTimeElapsed / videoDuration;

  // Clamp to valid range
  return Math.max(0, Math.min(1, videoProgress));
}

/**
 * Convert video progress (0-1 on compressed timeline) to data progress (0-1 on full timeline)
 * This is the inverse of dataProgressToVideoProgress
 * @param {number} videoProgress - Progress on the video timeline (0-1)
 * @param {{start: Date, end: Date}} timeRange - Full data time range
 * @param {Array<{start: Date, end: Date, durationMs: number}>} parsedGaps - Parsed gaps array
 * @param {number} totalGapDuration - Total duration of all gaps in milliseconds
 * @returns {number} Progress on the data timeline (0-1)
 */
export function videoProgressToDataProgress(videoProgress, timeRange, parsedGaps, totalGapDuration) {
  // Edge cases: pass through boundary values
  if (videoProgress <= 0) return 0;
  if (videoProgress >= 1) return 1;

  // Empty gaps: no conversion needed
  if (!parsedGaps || parsedGaps.length === 0 || totalGapDuration === 0) {
    return videoProgress;
  }

  const timeRangeStart = timeRange.start.getTime();
  const timeRangeEnd = timeRange.end.getTime();
  const fullDuration = timeRangeEnd - timeRangeStart;
  const videoDuration = fullDuration - totalGapDuration;

  // Calculate video time elapsed
  const videoTimeElapsed = videoProgress * videoDuration;

  // We need to find data time such that: dataTime - gapsBefore(dataTime) = videoTime
  // This requires iterative approach since gapsBefore depends on dataTime

  let dataTimeElapsed = videoTimeElapsed;
  let cumulativeGapTime = 0;

  for (const gap of parsedGaps) {
    const gapStartOffset = gap.start.getTime() - timeRangeStart;
    const gapEndOffset = gap.end.getTime() - timeRangeStart;

    // Video time (without gaps) that corresponds to the gap start
    const videoTimeAtGapStart = gapStartOffset - cumulativeGapTime;

    if (videoTimeElapsed < videoTimeAtGapStart) {
      // We're before this gap in video time
      break;
    }

    // We've passed this gap, add its duration to data time
    dataTimeElapsed = videoTimeElapsed + cumulativeGapTime + gap.durationMs;
    cumulativeGapTime += gap.durationMs;
  }

  // Final calculation: video time + all gaps before this point
  dataTimeElapsed = videoTimeElapsed + calculateGapDurationBefore(
    parsedGaps,
    new Date(timeRangeStart + dataTimeElapsed)
  );

  // Convert to progress
  const dataProgress = dataTimeElapsed / fullDuration;

  // Clamp to valid range
  return Math.max(0, Math.min(1, dataProgress));
}

/**
 * Create a gap configuration object from raw gaps and time range
 * @param {Array<{start: string, end: string}>} rawGaps - Raw gap data with timestamp strings
 * @param {{start: Date, end: Date}} timeRange - Full data time range
 * @returns {{timeRange: {start: Date, end: Date}, parsedGaps: Array, totalGapDuration: number}} Gap configuration
 */
export function createGapConfig(rawGaps, timeRange) {
  const parsedGaps = parseGaps(rawGaps);
  const totalGapDuration = getTotalGapDuration(parsedGaps);

  return {
    timeRange,
    parsedGaps,
    totalGapDuration
  };
}
