import {
  parseGapTimestamp,
  parseGaps,
  getTotalGapDuration,
  calculateGapDurationBefore,
  isWithinGap,
  dataProgressToVideoProgress,
  videoProgressToDataProgress,
  createGapConfig,
} from '../../../public/modules/shared/gapUtils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Two-hour flight: 08:00 – 10:00 */
const RANGE = {
  start: new Date(2025, 0, 15, 8, 0, 0),   // 08:00
  end:   new Date(2025, 0, 15, 10, 0, 0),  // 10:00
};
const RANGE_MS = RANGE.end.getTime() - RANGE.start.getTime(); // 7_200_000

/** Single 30-minute gap at 09:00 – 09:30 */
const RAW_GAPS_ONE = [{ start: '250115-090000', end: '250115-093000' }];
/** Two gaps: 09:00–09:10 and 09:30–09:45 */
const RAW_GAPS_TWO = [
  { start: '250115-090000', end: '250115-091000' },
  { start: '250115-093000', end: '250115-094500' },
];

// ---------------------------------------------------------------------------
// parseGapTimestamp
// ---------------------------------------------------------------------------

describe('parseGapTimestamp', () => {
  test('parses a valid timestamp string', () => {
    const d = parseGapTimestamp('250115-090000');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  test('parses hours/minutes/seconds independently', () => {
    const d = parseGapTimestamp('250115-134527');
    expect(d.getHours()).toBe(13);
    expect(d.getMinutes()).toBe(45);
    expect(d.getSeconds()).toBe(27);
  });
});

// ---------------------------------------------------------------------------
// parseGaps
// ---------------------------------------------------------------------------

describe('parseGaps', () => {
  test('returns an array of parsed gap objects', () => {
    const gaps = parseGaps(RAW_GAPS_ONE);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].start).toBeInstanceOf(Date);
    expect(gaps[0].end).toBeInstanceOf(Date);
    expect(gaps[0].durationMs).toBe(30 * 60 * 1000); // 30 min
  });

  test('calculates durationMs correctly', () => {
    const gaps = parseGaps(RAW_GAPS_TWO);
    expect(gaps[0].durationMs).toBe(10 * 60 * 1000); // 10 min
    expect(gaps[1].durationMs).toBe(15 * 60 * 1000); // 15 min
  });

  test('returns empty array for empty input', () => {
    expect(parseGaps([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTotalGapDuration
// ---------------------------------------------------------------------------

describe('getTotalGapDuration', () => {
  test('sums all gap durations', () => {
    const gaps = parseGaps(RAW_GAPS_TWO);
    expect(getTotalGapDuration(gaps)).toBe((10 + 15) * 60 * 1000);
  });

  test('returns 0 for empty gaps', () => {
    expect(getTotalGapDuration([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateGapDurationBefore
// ---------------------------------------------------------------------------

describe('calculateGapDurationBefore', () => {
  const gaps = parseGaps(RAW_GAPS_TWO); // 09:00–09:10, 09:30–09:45

  test('returns 0 before any gap', () => {
    const ts = new Date(2025, 0, 15, 8, 30, 0); // 08:30
    expect(calculateGapDurationBefore(gaps, ts)).toBe(0);
  });

  test('returns full first gap after it ends', () => {
    const ts = new Date(2025, 0, 15, 9, 15, 0); // 09:15 (between gaps)
    expect(calculateGapDurationBefore(gaps, ts)).toBe(10 * 60 * 1000);
  });

  test('returns both gaps after they both end', () => {
    const ts = new Date(2025, 0, 15, 9, 50, 0); // 09:50
    expect(calculateGapDurationBefore(gaps, ts)).toBe((10 + 15) * 60 * 1000);
  });

  test('returns partial gap when timestamp is inside a gap', () => {
    const ts = new Date(2025, 0, 15, 9, 5, 0); // 09:05 (5 min into first gap)
    expect(calculateGapDurationBefore(gaps, ts)).toBe(5 * 60 * 1000);
  });

  test('returns 0 for empty gaps array', () => {
    const ts = new Date(2025, 0, 15, 9, 0, 0);
    expect(calculateGapDurationBefore([], ts)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isWithinGap
// ---------------------------------------------------------------------------

describe('isWithinGap', () => {
  const gaps = parseGaps(RAW_GAPS_ONE); // 09:00–09:30

  test('returns inGap=false before the gap', () => {
    const ts = new Date(2025, 0, 15, 8, 45, 0);
    expect(isWithinGap(gaps, ts)).toEqual({ inGap: false });
  });

  test('returns inGap=true at the start of the gap', () => {
    const ts = new Date(2025, 0, 15, 9, 0, 0);
    expect(isWithinGap(gaps, ts).inGap).toBe(true);
  });

  test('returns inGap=true inside the gap', () => {
    const ts = new Date(2025, 0, 15, 9, 15, 0);
    const result = isWithinGap(gaps, ts);
    expect(result.inGap).toBe(true);
    expect(result.gap).toBeDefined();
  });

  test('returns inGap=false at the end boundary (exclusive)', () => {
    const ts = new Date(2025, 0, 15, 9, 30, 0);
    expect(isWithinGap(gaps, ts)).toEqual({ inGap: false });
  });

  test('returns inGap=false after the gap', () => {
    const ts = new Date(2025, 0, 15, 9, 45, 0);
    expect(isWithinGap(gaps, ts)).toEqual({ inGap: false });
  });

  test('returns inGap=false for empty gaps', () => {
    const ts = new Date(2025, 0, 15, 9, 0, 0);
    expect(isWithinGap([], ts)).toEqual({ inGap: false });
  });
});

// ---------------------------------------------------------------------------
// dataProgressToVideoProgress
// ---------------------------------------------------------------------------

describe('dataProgressToVideoProgress', () => {
  const gaps = parseGaps(RAW_GAPS_ONE); // 30-min gap out of 120-min flight
  const totalGap = getTotalGapDuration(gaps); // 1_800_000 ms

  test('progress 0 → 0', () => {
    expect(dataProgressToVideoProgress(0, RANGE, gaps, totalGap)).toBe(0);
  });

  test('progress 1 → 1', () => {
    expect(dataProgressToVideoProgress(1, RANGE, gaps, totalGap)).toBe(1);
  });

  test('passes through when no gaps', () => {
    expect(dataProgressToVideoProgress(0.5, RANGE, [], 0)).toBe(0.5);
  });

  test('progress before the gap is unaffected', () => {
    // 08:30 = 30 min into 120-min flight = 0.25 progress
    const p = dataProgressToVideoProgress(0.25, RANGE, gaps, totalGap);
    // No gaps elapsed yet → video progress = dataTimeElapsed / videoDuration
    // dataTimeElapsed = 0.25 * 7_200_000 = 1_800_000 ms
    // videoDuration = 7_200_000 - 1_800_000 = 5_400_000 ms
    // videoProgress = 1_800_000 / 5_400_000 = 1/3
    expect(p).toBeCloseTo(1 / 3, 5);
  });

  test('progress after the gap is compressed', () => {
    // 09:45 = 105 min into 120-min flight = 0.875 data progress
    const p = dataProgressToVideoProgress(0.875, RANGE, gaps, totalGap);
    // dataTimeElapsed = 0.875 * 7_200_000 = 6_300_000 ms
    // gapsBefore = 1_800_000 ms (full gap elapsed)
    // videoTimeElapsed = 6_300_000 - 1_800_000 = 4_500_000 ms
    // videoDuration = 5_400_000 ms
    // videoProgress = 4_500_000 / 5_400_000 = 5/6
    expect(p).toBeCloseTo(5 / 6, 5);
  });

  test('clamps result to [0, 1]', () => {
    expect(dataProgressToVideoProgress(-0.1, RANGE, gaps, totalGap)).toBe(0);
    expect(dataProgressToVideoProgress(1.1, RANGE, gaps, totalGap)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// videoProgressToDataProgress (round-trip)
// ---------------------------------------------------------------------------

describe('videoProgressToDataProgress', () => {
  const gaps = parseGaps(RAW_GAPS_ONE);
  const totalGap = getTotalGapDuration(gaps);

  test('progress 0 → 0', () => {
    expect(videoProgressToDataProgress(0, RANGE, gaps, totalGap)).toBe(0);
  });

  test('progress 1 → 1', () => {
    expect(videoProgressToDataProgress(1, RANGE, gaps, totalGap)).toBe(1);
  });

  test('passes through when no gaps', () => {
    expect(videoProgressToDataProgress(0.5, RANGE, [], 0)).toBe(0.5);
  });

  test('round-trips correctly with dataProgressToVideoProgress', () => {
    const testValues = [0.1, 0.3, 0.6, 0.9];
    for (const p of testValues) {
      // Skip values inside the gap (0.5 data = 09:00, start of gap)
      if (p >= 0.5 && p < 0.75) continue;
      const video = dataProgressToVideoProgress(p, RANGE, gaps, totalGap);
      const roundTrip = videoProgressToDataProgress(video, RANGE, gaps, totalGap);
      expect(roundTrip).toBeCloseTo(p, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// createGapConfig
// ---------------------------------------------------------------------------

describe('createGapConfig', () => {
  test('returns object with timeRange, parsedGaps, totalGapDuration', () => {
    const config = createGapConfig(RAW_GAPS_ONE, RANGE);
    expect(config.timeRange).toBe(RANGE);
    expect(Array.isArray(config.parsedGaps)).toBe(true);
    expect(config.parsedGaps).toHaveLength(1);
    expect(config.totalGapDuration).toBe(30 * 60 * 1000);
  });

  test('handles multiple gaps', () => {
    const config = createGapConfig(RAW_GAPS_TWO, RANGE);
    expect(config.parsedGaps).toHaveLength(2);
    expect(config.totalGapDuration).toBe((10 + 15) * 60 * 1000);
  });
});
