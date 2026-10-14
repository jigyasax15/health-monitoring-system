const LeaveRequest = require("../models/LeaveRequest");
const Doctor = require("../models/Doctor");
const Alert = require("../models/Alert");
const { isWorkingDay, getApplicableHolidays } = require("../utils/workingDays");
const { getTodayDateString } = require("../utils/dateTime");

/**
 * Validates date string in YYYY-MM-DD format.
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(d.getTime()) && dateStr === d.toISOString().slice(0, 10);
}

/**
 * Validates startDate and endDate parameters for leave requests.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLeaveDates(startDate, endDate) {
  if (!isValidDateString(startDate)) {
    return { valid: false, error: "Invalid startDate format. Expected YYYY-MM-DD." };
  }
  if (!isValidDateString(endDate)) {
    return { valid: false, error: "Invalid endDate format. Expected YYYY-MM-DD." };
  }
  if (startDate > endDate) {
    return { valid: false, error: "startDate cannot be after endDate." };
  }

  // Cap maximum single request duration to 90 days to prevent erroneous ranges
  const startD = new Date(`${startDate}T00:00:00Z`);
  const endD = new Date(`${endDate}T00:00:00Z`);
  const dayDiff = Math.round((endD - startD) / (24 * 60 * 60 * 1000)) + 1;
  if (dayDiff > 90) {
    return { valid: false, error: "Leave request cannot exceed 90 days." };
  }

  return { valid: true };
}

/**
 * Calculates scheduled working days in a date range for a specific health centre.
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string} healthCentre
 * @param {Array<Object>} [holidayList=[]]
 * @returns {{ workingDates: string[], workingDaysCount: number }}
 */
function calculateWorkingDaysForLeave(startDate, endDate, healthCentre, holidayList = []) {
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

  return {
    workingDates,
    workingDaysCount: workingDates.length,
  };
}

/**
 * Checks for overlapping PENDING or APPROVED leave requests for a doctor.
 *
 * @param {string} doctorEmail
 * @param {string} startDate
 * @param {string} endDate
 * @param {string|null} [excludeLeaveId=null]
 * @returns {Promise<Object|null>} Overlapping leave document or null
 */
async function findOverlappingLeave(doctorEmail, startDate, endDate, excludeLeaveId = null) {
  const query = {
    doctorEmail: doctorEmail.toLowerCase().trim(),
    status: { $in: ["PENDING", "APPROVED"] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };

  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }

  return await LeaveRequest.findOne(query).lean();
}

/**
 * Single batch query helper for approved leaves within a date range.
 *
 * @param {Object} [filter={}]
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array<Object>>}
 */
async function getApprovedLeavesForRange(filter = {}, startDate, endDate) {
  const query = {
    status: "APPROVED",
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    ...filter,
  };

  return await LeaveRequest.find(query).sort({ startDate: 1 }).lean();
}

/**
 * Builds a Map of approved leave dates for quick in-memory lookups.
 * Key format: `${doctorEmail}_${date}`
 *
 * @param {Array<Object>} approvedLeaves
 * @returns {Map<string, Object>}
 */
function buildApprovedLeavesMap(approvedLeaves = []) {
  const map = new Map();

  for (const leave of approvedLeaves) {
    if (!leave || leave.status !== "APPROVED") continue;
    const curr = new Date(`${leave.startDate}T00:00:00Z`);
    const end = new Date(`${leave.endDate}T00:00:00Z`);

    while (curr <= end) {
      const year = curr.getUTCFullYear();
      const month = String(curr.getUTCMonth() + 1).padStart(2, "0");
      const day = String(curr.getUTCDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      map.set(`${leave.doctorEmail}_${dateStr}`, leave);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
  }

  return map;
}

module.exports = {
  isValidDateString,
  validateLeaveDates,
  calculateWorkingDaysForLeave,
  findOverlappingLeave,
  getApprovedLeavesForRange,
  buildApprovedLeavesMap,
};
