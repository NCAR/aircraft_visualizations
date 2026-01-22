/**
 * Gap Utilities Test Suite
 * Run this in browser console to verify gap utilities work correctly
 *
 * Usage: import('./store/gapTests.js').then(m => m.runGapTests())
 */

import {
  parseGapTimestamp,
  parseGaps,
  getTotalGapDuration,
  calculateGapDurationBefore,
  isWithinGap,
  dataProgressToVideoProgress,
  videoProgressToDataProgress,
  createGapConfig
} from '../modules/shared/gapUtils.js';

// RF09 Test Data - Actual camera gaps from flight
const rf09Gaps = [
  // Initial gap: data start to movie start
  { start: "250805-212047", end: "250805-212140" },
  { start: "250805-211141", end: "250805-212139" },  // 599 seconds
  { start: "250806-000242", end: "250806-000242" },  // 1 seconds
  { start: "250806-000340", end: "250806-000340" },  // 1 seconds
  { start: "250806-000342", end: "250806-000405" },  // 24 seconds
  { start: "250806-001015", end: "250806-001019" },  // 5 seconds
  { start: "250806-001226", end: "250806-001230" },  // 5 seconds
  { start: "250806-003611", end: "250806-003611" },  // 1 seconds
  { start: "250806-003613", end: "250806-003616" },  // 4 seconds
  { start: "250806-003817", end: "250806-003821" },  // 5 seconds
  { start: "250806-004155", end: "250806-004155" },  // 1 seconds
  { start: "250806-004157", end: "250806-004200" },  // 4 seconds
  { start: "250806-012624", end: "250806-012624" },  // 1 seconds
  { start: "250806-012626", end: "250806-012634" },  // 9 seconds
  { start: "250806-012853", end: "250806-012853" },  // 1 seconds
  { start: "250806-012855", end: "250806-012904" },  // 10 seconds
  { start: "250806-013132", end: "250806-025423" },  // 4972 seconds
  { start: "250806-025425", end: "250806-025427" },  // 3 seconds
  { start: "250806-025429", end: "250806-025434" },  // 6 seconds
  { start: "250806-025436", end: "250806-025648" },  // 133 seconds
];

/**
 * Run all gap utility tests
 */
export function runGapTests() {
  console.log('%c=== Gap Utilities Tests ===', 'color: #2196F3; font-size: 16px; font-weight: bold;');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`%c✓ PASS: ${message}`, 'color: #4CAF50;');
      testsPassed++;
    } else {
      console.error(`%c✗ FAIL: ${message}`, 'color: #F44336;');
      testsFailed++;
    }
  }

  function assertApprox(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    if (diff <= tolerance) {
      console.log(`%c✓ PASS: ${message} (actual: ${actual.toFixed(6)}, expected: ${expected.toFixed(6)})`, 'color: #4CAF50;');
      testsPassed++;
    } else {
      console.error(`%c✗ FAIL: ${message} (actual: ${actual.toFixed(6)}, expected: ${expected.toFixed(6)}, diff: ${diff.toFixed(6)})`, 'color: #F44336;');
      testsFailed++;
    }
  }

  // ============================================
  // Test 1: parseGapTimestamp
  // ============================================
  console.log('\n%c--- parseGapTimestamp Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsed = parseGapTimestamp("250806-003532");

    assert(parsed.getFullYear() === 2025, 'parseGapTimestamp: Year is 2025');
    assert(parsed.getMonth() === 7, 'parseGapTimestamp: Month is August (index 7)');
    assert(parsed.getDate() === 6, 'parseGapTimestamp: Day is 6');
    assert(parsed.getHours() === 0, 'parseGapTimestamp: Hours is 0');
    assert(parsed.getMinutes() === 35, 'parseGapTimestamp: Minutes is 35');
    assert(parsed.getSeconds() === 32, 'parseGapTimestamp: Seconds is 32');
  } catch (error) {
    assert(false, `parseGapTimestamp threw error: ${error.message}`);
  }

  // ============================================
  // Test 2: parseGaps
  // ============================================
  console.log('\n%c--- parseGaps Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);

    assert(parsedGaps.length === 20, 'parseGaps: Returns 20 gaps');
    assert(parsedGaps[0].start instanceof Date, 'parseGaps: First gap start is a Date');
    assert(parsedGaps[0].end instanceof Date, 'parseGaps: First gap end is a Date');

    // First gap: "250805-212047" to "250805-212140" (initial gap)
    // Duration: 21:20:47 to 21:21:40 = 53 seconds = 53000 ms
    assert(parsedGaps[0].durationMs === 53000, 'parseGaps: First gap (initial) duration is 53000ms (53 sec)');

    // Second gap: "250805-211141" to "250805-212139"
    // Duration: 599 seconds = 599000 ms
    assert(parsedGaps[1].durationMs === 599000, 'parseGaps: Second gap duration is 599000ms (599 sec)');
  } catch (error) {
    assert(false, `parseGaps threw error: ${error.message}`);
  }

  // ============================================
  // Test 3: getTotalGapDuration
  // ============================================
  console.log('\n%c--- getTotalGapDuration Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);
    const totalDuration = getTotalGapDuration(parsedGaps);

    assert(totalDuration > 0, 'getTotalGapDuration: Returns positive value');
    assert(typeof totalDuration === 'number', 'getTotalGapDuration: Returns a number');

    // Log the total for reference
    const totalMinutes = totalDuration / 60000;
    console.log(`%c  Info: Total gap duration = ${totalMinutes.toFixed(2)} minutes`, 'color: #607D8B;');
  } catch (error) {
    assert(false, `getTotalGapDuration threw error: ${error.message}`);
  }

  // ============================================
  // Test 4: calculateGapDurationBefore
  // ============================================
  console.log('\n%c--- calculateGapDurationBefore Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);

    // Timestamp before all gaps (before flight start)
    const beforeAll = new Date(2025, 7, 5, 21, 0, 0); // Aug 5, 2025 21:00:00
    const durationBeforeAll = calculateGapDurationBefore(parsedGaps, beforeAll);
    assert(durationBeforeAll === 0, 'calculateGapDurationBefore: 0ms before all gaps');

    // Timestamp after first gap (21:21:40 end on Aug 5)
    const afterFirst = new Date(2025, 7, 5, 21, 22, 0); // Aug 5, 2025 21:22:00
    const durationAfterFirst = calculateGapDurationBefore(parsedGaps, afterFirst);
    assert(durationAfterFirst === 53000, 'calculateGapDurationBefore: 53000ms after first gap');

    // Timestamp after second gap (21:21:39 end)
    const afterSecond = new Date(2025, 7, 5, 21, 22, 0); // Aug 5, 2025 21:22:00
    const durationAfterSecond = calculateGapDurationBefore(parsedGaps, afterSecond);
    // Should be first gap (53000) + second gap (599000) = 652000ms
    assert(durationAfterSecond === 652000, 'calculateGapDurationBefore: 652000ms after second gap');

    // Timestamp within first gap (within 21:20:47-21:21:40 on Aug 5)
    const withinFirst = new Date(2025, 7, 5, 21, 21, 0); // Aug 5, 2025 21:21:00
    const durationWithinFirst = calculateGapDurationBefore(parsedGaps, withinFirst);
    // Should be partial first gap (21:20:47 to 21:21:00 = 13 seconds = 13000ms)
    assert(durationWithinFirst === 13000, 'calculateGapDurationBefore: 13000ms when within first gap');
  } catch (error) {
    assert(false, `calculateGapDurationBefore threw error: ${error.message}`);
  }

  // ============================================
  // Test 5: isWithinGap
  // ============================================
  console.log('\n%c--- isWithinGap Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);

    // Outside gaps (before flight start)
    const outsideGap = new Date(2025, 7, 6, 0, 0, 0); // Before first gap
    const outsideResult = isWithinGap(parsedGaps, outsideGap);
    assert(outsideResult.inGap === false, 'isWithinGap: Returns false outside gaps');
    assert(outsideResult.gap === undefined, 'isWithinGap: No gap object when outside');

    // Inside first gap (00:01:36-00:02:37 on Aug 6)
    const insideFirst = new Date(2025, 7, 6, 0, 2, 0); // Within first gap
    const insideFirstResult = isWithinGap(parsedGaps, insideFirst);
    assert(insideFirstResult.inGap === true, 'isWithinGap: Returns true inside first gap');
    assert(insideFirstResult.gap !== undefined, 'isWithinGap: Returns gap object when inside');
    assert(insideFirstResult.gap.durationMs === 61000, 'isWithinGap: Returns correct first gap');

    // Inside third gap (00:04:05-00:10:15 on Aug 6)
    const insideThird = new Date(2025, 7, 6, 0, 5, 0);
    const insideThirdResult = isWithinGap(parsedGaps, insideThird);
    assert(insideThirdResult.inGap === true, 'isWithinGap: Returns true inside third gap');
    assert(insideThirdResult.gap.durationMs === 370000, 'isWithinGap: Returns correct third gap');

    // Exactly at gap start (should be inside)
    const atGapStart = parseGapTimestamp("250806-000136");
    const atStartResult = isWithinGap(parsedGaps, atGapStart);
    assert(atStartResult.inGap === true, 'isWithinGap: Returns true at gap start (inclusive)');

    // Exactly at gap end (should be outside)
    const atGapEnd = parseGapTimestamp("250806-000237");
    const atEndResult = isWithinGap(parsedGaps, atGapEnd);
    assert(atEndResult.inGap === false, 'isWithinGap: Returns false at gap end (exclusive)');
  } catch (error) {
    assert(false, `isWithinGap threw error: ${error.message}`);
  }

  // ============================================
  // Test 6: dataProgressToVideoProgress
  // ============================================
  console.log('\n%c--- dataProgressToVideoProgress Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);
    const totalGapDuration = getTotalGapDuration(parsedGaps);

    // Create a time range matching the flight (Aug 5-6, 2025)
    const timeRange = {
      start: new Date(2025, 7, 5, 21, 20, 47),  // Aug 5, 2025 21:20:47 (data start)
      end: new Date(2025, 7, 6, 2, 54, 35)     // Aug 6, 2025 02:54:35 (data end)
    };

    // Boundary: progress 0 -> 0
    const zeroProgress = dataProgressToVideoProgress(0, timeRange, parsedGaps, totalGapDuration);
    assert(zeroProgress === 0, 'dataProgressToVideoProgress: Progress 0 → 0');

    // Boundary: progress 1 -> 1
    const oneProgress = dataProgressToVideoProgress(1, timeRange, parsedGaps, totalGapDuration);
    assert(oneProgress === 1, 'dataProgressToVideoProgress: Progress 1 → 1');

    // Mid-progress should differ from input (gaps compress time)
    const midProgress = dataProgressToVideoProgress(0.5, timeRange, parsedGaps, totalGapDuration);
    assert(midProgress !== 0.5, 'dataProgressToVideoProgress: Mid-progress differs from input');
    assert(midProgress >= 0 && midProgress <= 1, 'dataProgressToVideoProgress: Mid-progress in valid range');

    // Empty gaps should pass through
    const emptyGapsProgress = dataProgressToVideoProgress(0.5, timeRange, [], 0);
    assert(emptyGapsProgress === 0.5, 'dataProgressToVideoProgress: Empty gaps pass through');
  } catch (error) {
    assert(false, `dataProgressToVideoProgress threw error: ${error.message}`);
  }

  // ============================================
  // Test 7: videoProgressToDataProgress
  // ============================================
  console.log('\n%c--- videoProgressToDataProgress Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);
    const totalGapDuration = getTotalGapDuration(parsedGaps);

    const timeRange = {
      start: new Date(2025, 7, 5, 21, 20, 47),  // Aug 5, 2025 21:20:47 (data start)
      end: new Date(2025, 7, 6, 2, 54, 35)     // Aug 6, 2025 02:54:35 (data end)
    };

    // Boundary: progress 0 -> 0
    const zeroProgress = videoProgressToDataProgress(0, timeRange, parsedGaps, totalGapDuration);
    assert(zeroProgress === 0, 'videoProgressToDataProgress: Progress 0 → 0');

    // Boundary: progress 1 -> 1
    const oneProgress = videoProgressToDataProgress(1, timeRange, parsedGaps, totalGapDuration);
    assert(oneProgress === 1, 'videoProgressToDataProgress: Progress 1 → 1');

    // Empty gaps should pass through
    const emptyGapsProgress = videoProgressToDataProgress(0.5, timeRange, [], 0);
    assert(emptyGapsProgress === 0.5, 'videoProgressToDataProgress: Empty gaps pass through');
  } catch (error) {
    assert(false, `videoProgressToDataProgress threw error: ${error.message}`);
  }

  // ============================================
  // Test 8: Round-trip conversion accuracy
  // ============================================
  console.log('\n%c--- Round-trip Conversion Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);
    const totalGapDuration = getTotalGapDuration(parsedGaps);

    const timeRange = {
      start: new Date(2025, 7, 5, 21, 20, 47),  // Aug 5, 2025 21:20:47 (data start)
      end: new Date(2025, 7, 6, 2, 54, 35)     // Aug 6, 2025 02:54:35 (data end)
    };

    // Test several data progress values
    const testValues = [0.1, 0.25, 0.5, 0.75, 0.9];

    for (const originalProgress of testValues) {
      const videoProgress = dataProgressToVideoProgress(originalProgress, timeRange, parsedGaps, totalGapDuration);
      const roundTrip = videoProgressToDataProgress(videoProgress, timeRange, parsedGaps, totalGapDuration);

      assertApprox(roundTrip, originalProgress, 0.01,
        `Round-trip: dataProgress ${originalProgress} → video → data`);
    }
  } catch (error) {
    assert(false, `Round-trip conversion threw error: ${error.message}`);
  }

  // ============================================
  // Test 9: createGapConfig
  // ============================================
  console.log('\n%c--- createGapConfig Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const timeRange = {
      start: new Date(2025, 7, 5, 21, 20, 47),  // Aug 5, 2025 21:20:47 (data start)
      end: new Date(2025, 7, 6, 2, 54, 35)     // Aug 6, 2025 02:54:35 (data end)
    };

    const config = createGapConfig(rf09Gaps, timeRange);

    assert(config.timeRange === timeRange, 'createGapConfig: timeRange preserved');
    assert(Array.isArray(config.parsedGaps), 'createGapConfig: parsedGaps is array');
    assert(config.parsedGaps.length === 31, 'createGapConfig: parsedGaps has 31 items');
    assert(typeof config.totalGapDuration === 'number', 'createGapConfig: totalGapDuration is number');
    assert(config.totalGapDuration > 0, 'createGapConfig: totalGapDuration is positive');
  } catch (error) {
    assert(false, `createGapConfig threw error: ${error.message}`);
  }

  // ============================================
  // Test 10: Adjacent gaps handling
  // ============================================
  console.log('\n%c--- Adjacent Gaps Tests ---', 'color: #9C27B0; font-weight: bold;');

  try {
    const parsedGaps = parseGaps(rf09Gaps);

    // Gaps 3 and 4 are adjacent: gap[2].end = "250806-004906", gap[3].start = "250806-004906"
    const adjacentTime = parseGapTimestamp("250806-004906");
    const result = isWithinGap(parsedGaps, adjacentTime);

    // At the end of gap[1] (exclusive), should check if in gap[2] (inclusive)
    // Since 004906 is the start of gap[2], it should be inside gap[2]
    assert(result.inGap === true, 'Adjacent gaps: Timestamp at boundary is inside second gap');
  } catch (error) {
    assert(false, `Adjacent gaps test threw error: ${error.message}`);
  }

  // ============================================
  // Summary
  // ============================================
  console.log('\n%c=== Test Summary ===', 'color: #2196F3; font-size: 16px; font-weight: bold;');
  console.log(`%cTests Passed: ${testsPassed}`, 'color: #4CAF50; font-weight: bold;');
  console.log(`%cTests Failed: ${testsFailed}`, 'color: #F44336; font-weight: bold;');

  if (testsFailed === 0) {
    console.log('%c\n✓ All tests passed! Gap utilities are working correctly.', 'color: #4CAF50; font-size: 14px; font-weight: bold;');
  } else {
    console.log('%c\n✗ Some tests failed. Check implementation.', 'color: #F44336; font-size: 14px; font-weight: bold;');
  }

  return { testsPassed, testsFailed };
}

// Auto-run message if loaded directly
if (typeof window !== 'undefined') {
  console.log('%cGap test module loaded. Run runGapTests() to test gap utilities.', 'color: #2196F3;');
}
