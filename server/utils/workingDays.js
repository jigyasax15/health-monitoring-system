const Holiday = require("../models/Holiday");
const { workingDays, weeklyOffDays, timezone } = require("../config/attendanceConfig");

/**
 * Returns the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * for a given YYYY-MM-DD date string in the configured timezone.
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {number} 0 to 6
 */
function getDayOfWeek(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return -1;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return -1;
  // 12:00:00 UTC ensures identical date and day of week in Asia/Kolkata (+05:30)
  const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  return utcDate.getUTCDay();
}

/**
 * Checks if a date string is a configured weekly off day (e.g. Saturday or Sunday).
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Object} [options={}]
 * @param {number[]} [options.weeklyOffs=weeklyOffDays]
 * @returns {boolean}
 */
function isWeeklyOff(dateStr, options = {}) {
  const offs = options.weeklyOffs || weeklyOffDays;
  const day = getDayOfWeek(dateStr);
  return offs.includes(day);
}

/**
 * Checks if a date matches an active holiday applicable to the given health centre.
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string|null} [healthCentre=null]
 * @param {Array<Object>} [holidayList=[]] - Pre-fetched list of active holiday objects
 * @returns {Object|null} Matching holiday object or null
 */
function isHoliday(dateStr, healthCentre = null, holidayList = []) {
  if (!Array.isArray(holidayList) || holidayList.length === 0) {
    return null;
  }

  const match = holidayList.find((h) => {
    if (!h || h.active === false || h.date !== dateStr) {
      return false;
    }

    // DISTRICT scope applies to all centres
    if (h.scope === "DISTRICT" || (!h.scope && !h.healthCentre)) {
      return true;
    }

    // CENTRE scope applies strictly to specified healthCentre
    if (h.scope === "CENTRE" || h.healthCentre) {
      return healthCentre ? h.healthCentre === healthCentre : false;
    }

    return false;
  });

  return match || null;
}

/**
 * Checks whether a given date is a working day (neither weekly off nor applicable holiday).
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Object} [options={}]
 * @param {string|null} [options.healthCentre=null]
 * @param {Array<Object>} [options.holidayList=[]]
 * @returns {boolean}
 */
function isWorkingDay(dateStr, options = {}) {
  if (isWeeklyOff(dateStr, options)) {
    return false;
  }

  const holiday = isHoliday(
    dateStr,
    options.healthCentre || null,
    options.holidayList || []
  );

  if (holiday) {
    return false;
  }

  return true;
}

/**
 * Returns all working dates (YYYY-MM-DD) between startDate and endDate (inclusive)
 * for a specific health centre given a pre-loaded holiday list.
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string|null} [healthCentre=null]
 * @param {Array<Object>} [holidayList=[]]
 * @returns {string[]}
 */
function getEligibleWorkingDates(startDate, endDate, healthCentre = null, holidayList = []) {
  const workingDates = [];
  const curr = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (curr <= end) {
    const year = curr.getUTCFullYear();
    const month = String(curr.getUTCMonth() + 1).padStart(2, "0");
    const day = String(curr.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    if (isWorkingDay(dateStr, { healthCentre, holidayList })) {
      workingDates.push(dateStr);
    }

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return workingDates;
}

/**
 * Queries MongoDB for active holidays within a date range applicable to a health centre
 * (or all active holidays if healthCentre is null).
 * Single batch query helper.
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string|null} [healthCentre=null]
 * @returns {Promise<Array<Object>>}
 */
async function getApplicableHolidays(startDate, endDate, healthCentre = null) {
  const query = {
    active: true,
    date: { $gte: startDate, $lte: endDate },
  };

  if (healthCentre) {
    query.$or = [
      { scope: "DISTRICT" },
      { scope: "CENTRE", healthCentre },
      { healthCentre: null },
      { healthCentre: "" },
    ];
  }

  return await Holiday.find(query).sort({ date: 1 }).lean();
}

module.exports = {
  getDayOfWeek,
  isWeeklyOff,
  isHoliday,
  isWorkingDay,
  getEligibleWorkingDates,
  getApplicableHolidays,
};
