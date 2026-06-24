/**
 * formatYearRange — Formats year fields into a display string.
 *
 * Handles three cases:
 *   yearStart only          → "2024"
 *   yearStart + yearEnd     → "2023–2025"
 *   yearStart + isOngoing   → "2024–current"
 *
 * @param {number|null} yearStart
 * @param {number|null} yearEnd
 * @param {boolean}     isOngoing
 * @returns {string|null}
 */
export function formatYearRange(yearStart, yearEnd, isOngoing) {
  if (!yearStart) return null;
  if (isOngoing) return `${yearStart}–current`;
  if (yearEnd && yearEnd !== yearStart) return `${yearStart}–${yearEnd}`;
  return `${yearStart}`;
}
