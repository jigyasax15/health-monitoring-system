const { attendanceCutoffTime } = require("../config/attendanceConfig");
const { getTodayDateString, isAfterCutoff } = require("./dateTime");
const { isWorkingDay } = require("./workingDays");

const ATTENDANCE_STATUS = {
  PRESENT: "Present",
  NOT_MARKED: "Not Marked",
  ABSENT: "Absent",
  NON_WORKING_DAY: "Non-Working Day",
};

/**
 * Determines attendance status for a doctor on a given date.
 *
 * Rules:
 * 1. If an attendance document exists with status "Present", return "Present" (preserves real attendance even on non-working days).
 * 2. If an attendance document exists with status "Absent", return "Absent".
 * 3. If no attendance document exists:
 *    - If target date is a NON-WORKING day (weekly off or holiday), return "Non-Working Day".
 *    - If target date is a WORKING day:
 *        * If target date is in the past (before today in IST), return "Absent".
 *        * If target date is in the future (after today in IST), return "Not Marked".
 *        * If target date is today:
 *            - If current time is at or after cutoffTime (10:00 IST), return "Absent".
 *            - If current time is before cutoffTime, return "Not Marked".
 *
 * @param {Object|null} attendanceRecord - Attendance record from database
 * @param {Object} [options={}]
 * @param {string} [options.targetDate] - Target date (YYYY-MM-DD), defaults to today in IST
 * @param {Date} [options.referenceDate] - Current reference Date object (useful for tests)
 * @param {string} [options.cutoffTime] - Cutoff time HH:MM, defaults to attendanceCutoffTime
 * @param {string|null} [options.healthCentre] - Health centre name for centre-specific holiday checks
 * @param {Array<Object>} [options.holidayList] - Pre-fetched holiday records for batch evaluation
 * @returns {string} "Present" | "Not Marked" | "Absent" | "Non-Working Day"
 */
function determineAttendanceStatus(attendanceRecord, options = {}) {
  // 1. If an attendance record exists, respect its recorded status
  if (attendanceRecord && attendanceRecord.status) {
    if (attendanceRecord.status === "Present") {
      return ATTENDANCE_STATUS.PRESENT;
    }
    if (attendanceRecord.status === "Absent") {
      return ATTENDANCE_STATUS.ABSENT;
    }
  }

  const referenceDate = options.referenceDate || new Date();
  const todayStr = getTodayDateString(referenceDate);
  const targetDate = options.targetDate || todayStr;
  const cutoffTime = options.cutoffTime || attendanceCutoffTime;

  // 2. Check if target date is a non-working day (weekly off or holiday)
  const working = isWorkingDay(targetDate, {
    healthCentre: options.healthCentre || null,
    holidayList: options.holidayList || [],
  });

  if (!working) {
    return ATTENDANCE_STATUS.NON_WORKING_DAY;
  }

  // 3. Target date is in the past
  if (targetDate < todayStr) {
    return ATTENDANCE_STATUS.ABSENT;
  }

  // 4. Target date is in the future
  if (targetDate > todayStr) {
    return ATTENDANCE_STATUS.NOT_MARKED;
  }

  // 5. Target date is today in IST -> check cutoff time
  const pastCutoff = isAfterCutoff(cutoffTime, referenceDate);
  if (pastCutoff) {
    return ATTENDANCE_STATUS.ABSENT;
  }

  return ATTENDANCE_STATUS.NOT_MARKED;
}

module.exports = {
  ATTENDANCE_STATUS,
  determineAttendanceStatus,
};

