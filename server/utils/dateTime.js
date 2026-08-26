const { timezone } = require("../config/attendanceConfig");

/**
 * Formats a Date object into YYYY-MM-DD string in the specified timezone (default Asia/Kolkata).
 *
 * @param {Date} [referenceDate=new Date()]
 * @param {string} [tz=timezone]
 * @returns {string} Date formatted as YYYY-MM-DD
 */
function getTodayDateString(referenceDate = new Date(), tz = timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(referenceDate);
}

/**
 * Formats a Date object into HH:MM (24-hour) string in the specified timezone (default Asia/Kolkata).
 *
 * @param {Date} [referenceDate=new Date()]
 * @param {string} [tz=timezone]
 * @returns {string} Time formatted as HH:MM
 */
function getCurrentTimeString(referenceDate = new Date(), tz = timezone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(referenceDate);
}

/**
 * Checks if the reference time is at or after the given cutoff time string (HH:MM).
 *
 * @param {string} cutoffTimeStr - Time in HH:MM format (e.g. "10:00")
 * @param {Date} [referenceDate=new Date()]
 * @param {string} [tz=timezone]
 * @returns {boolean} True if current time >= cutoff time
 */
function isAfterCutoff(cutoffTimeStr, referenceDate = new Date(), tz = timezone) {
  const currentTime = getCurrentTimeString(referenceDate, tz);
  return currentTime >= cutoffTimeStr;
}

/**
 * Returns a date string YYYY-MM-DD for N days prior to the reference date in the specified timezone.
 *
 * @param {number} daysAgo
 * @param {Date} [referenceDate=new Date()]
 * @param {string} [tz=timezone]
 * @returns {string} Date formatted as YYYY-MM-DD
 */
function getPreviousDateString(daysAgo = 1, referenceDate = new Date(), tz = timezone) {
  const d = new Date(referenceDate);
  d.setDate(d.getDate() - daysAgo);
  return getTodayDateString(d, tz);
}

module.exports = {
  getTodayDateString,
  getCurrentTimeString,
  isAfterCutoff,
  getPreviousDateString,
};
