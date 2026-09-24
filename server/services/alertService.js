const Alert = require("../models/Alert");
const Doctor = require("../models/Doctor");
const Attendance = require("../models/Attendance");
const HealthCentre = require("../models/HealthCentre");
const alertConfig = require("../config/alertConfig");
const {
  getTodayDateString,
  getPreviousDateString,
} = require("../utils/dateTime");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");
const { getApplicableHolidays } = require("../utils/workingDays");

const SEVERITY_WEIGHT = alertConfig.severityWeight || {
  critical: 3,
  high: 2,
  medium: 1,
  low: 1,
};

/**
 * Calculates consecutive absence streak for a doctor ending on today's date.
 *
 * Rules:
 * - If today is not Absent (e.g. Present, Not Marked before cutoff, or Non-Working Day), return 0.
 * - If today is Absent, start streak with 1 missed working day.
 * - When scanning backwards:
 *   * Non-working day (weekend or holiday) -> skip and continue streak without incrementing missed working days.
 *   * Working day + Absent -> increment streak (consecutiveDays++).
 *   * Working day + Present -> break streak.
 *   * Working day + Not Marked -> break streak.
 *
 * @param {Object} doctor
 * @param {Array} attendanceRecords - Attendance records for this doctor
 * @param {Object} [options={}]
 * @param {Array<Object>} [options.holidayList=[]]
 * @returns {number} Number of consecutive missed working days
 */
function calculateConsecutiveAbsences(doctor, attendanceRecords, options = {}) {
  const referenceDate = options.referenceDate || new Date();
  const todayStr = getTodayDateString(referenceDate);
  const holidayList = options.holidayList || [];

  // Check today's status first
  const todayRecord = attendanceRecords.find(
    (r) => r.doctorEmail === doctor.email && r.date === todayStr
  );
  const todayStatus = determineAttendanceStatus(todayRecord, {
    targetDate: todayStr,
    referenceDate,
    healthCentre: doctor.healthCentre,
    holidayList,
  });

  // If today is not Absent (Present, Not Marked before cutoff, or Non-Working Day), no active streak ending today
  if (todayStatus !== "Absent") {
    return 0;
  }

  let consecutiveDays = 1;

  // Search backwards up to 30 days
  for (let daysAgo = 1; daysAgo <= 30; daysAgo++) {
    const pastDateStr = getPreviousDateString(daysAgo, referenceDate);
    const pastRecord = attendanceRecords.find(
      (r) => r.doctorEmail === doctor.email && r.date === pastDateStr
    );
    const pastStatus = determineAttendanceStatus(pastRecord, {
      targetDate: pastDateStr,
      referenceDate,
      healthCentre: doctor.healthCentre,
      holidayList,
    });

    if (pastStatus === "Non-Working Day") {
      // Non-working day (weekend/holiday): skip and continue without incrementing count
      continue;
    } else if (pastStatus === "Absent") {
      // Missed working day
      consecutiveDays++;
    } else {
      // Present or Not Marked on a working day breaks the consecutive absence streak
      break;
    }
  }

  return consecutiveDays;
}

/**
 * Derives and attaches escalation status to alert object.
 *
 * @param {Object} alert
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} Alert with isEscalated property
 */
function attachEscalationStatus(alert, referenceDate = new Date()) {
  const isEscalated = alertConfig.isAlertEscalated(alert, referenceDate);
  return {
    ...alert,
    isEscalated: alert.isEscalated || isEscalated,
  };
}

/**
 * Evaluates doctors, updates Alert records in MongoDB, and returns active unresolved alerts.
 *
 * @param {Object} [filter={}]
 * @param {string} [filter.centreName] - Specific health centre name (for centre admin)
 * @param {Object} [options={}] - Optional referenceDate for testing
 * @returns {Promise<Array>} List of active alerts sorted by severity (critical -> high -> medium)
 */
async function generateAndGetActiveAlerts(filter = {}, options = {}) {
  const referenceDate = options.referenceDate || new Date();
  const todayStr = getTodayDateString(referenceDate);
  const startDate = getPreviousDateString(30, referenceDate);

  // 1. Find target active health centres
  const centreQuery = { isActive: { $ne: false } };
  if (filter.centreName) {
    centreQuery.name = filter.centreName;
  }
  const centres = await HealthCentre.find(centreQuery);
  const centreNames = centres.map((c) => c.name);

  // 2. Find doctors in these centres
  const doctorQuery = { healthCentre: { $in: centreNames } };
  const doctors = await Doctor.find(doctorQuery);

  if (doctors.length === 0) {
    return [];
  }

  const doctorEmails = doctors.map((d) => d.email);

  // 3. Batch query attendance records and applicable holidays in the 30-day window
  const [attendanceRecords, holidayList] = await Promise.all([
    Attendance.find({
      doctorEmail: { $in: doctorEmails },
      date: { $gte: startDate, $lte: todayStr },
    }),
    getApplicableHolidays(startDate, todayStr, filter.centreName || null),
  ]);

  // 4. Evaluate each doctor
  for (const doctor of doctors) {
    const docRecords = attendanceRecords.filter(
      (r) => r.doctorEmail === doctor.email
    );

    const consecutiveDays = calculateConsecutiveAbsences(
      doctor,
      docRecords,
      { ...options, holidayList }
    );

    if (consecutiveDays > 0) {
      let alertType;
      let severity;
      let message;

      if (consecutiveDays === 1) {
        alertType = "ABSENT_TODAY";
        severity = "medium";
        message = "Absent today";
      } else if (consecutiveDays === 2) {
        alertType = "CONSECUTIVE_ABSENCE_2_DAYS";
        severity = "high";
        message = "Absent for 2 consecutive days";
      } else {
        alertType = "CONSECUTIVE_ABSENCE_3_PLUS_DAYS";
        severity = "critical";
        message = `Absent for ${consecutiveDays} consecutive days`;
      }

      // Check if an unresolved alert already exists for this doctor
      const existingUnresolvedAlert = await Alert.findOne({
        doctorEmail: doctor.email,
        status: { $in: ["ACTIVE", "ACKNOWLEDGED"] },
        resolved: false,
      });

      if (existingUnresolvedAlert) {
        // Update existing alert with new streak days, type, and severity
        const streakChanged = existingUnresolvedAlert.consecutiveDays !== consecutiveDays;
        existingUnresolvedAlert.consecutiveDays = consecutiveDays;
        existingUnresolvedAlert.type = alertType;
        existingUnresolvedAlert.severity = severity;
        existingUnresolvedAlert.message = message;
        existingUnresolvedAlert.date = todayStr;

        if (streakChanged) {
          existingUnresolvedAlert.actions.push({
            action: "STREAK_UPDATED",
            performedBy: "system",
            role: "system",
            note: `Consecutive absence updated to ${consecutiveDays} missed working days`,
            timestamp: referenceDate,
          });
        }

        // Derive escalation if threshold reached
        if (
          alertConfig.isAlertEscalated(existingUnresolvedAlert, referenceDate) &&
          !existingUnresolvedAlert.isEscalated
        ) {
          existingUnresolvedAlert.isEscalated = true;
          existingUnresolvedAlert.escalatedAt = referenceDate;
          existingUnresolvedAlert.actions.push({
            action: "ESCALATED",
            performedBy: "system",
            role: "system",
            note: `Alert escalated due to no acknowledgement within ${alertConfig.escalationAfterHours} hours`,
            timestamp: referenceDate,
          });
        }

        await existingUnresolvedAlert.save();
      } else {
        // Create a new ACTIVE alert
        const newAlert = new Alert({
          doctorId: doctor._id,
          doctorName: doctor.name,
          doctorEmail: doctor.email,
          healthCentre: doctor.healthCentre,
          type: alertType,
          severity,
          message,
          date: todayStr,
          consecutiveDays,
          status: "ACTIVE",
          resolved: false,
          actions: [
            {
              action: "CREATED",
              performedBy: "system",
              role: "system",
              note: `Absence alert generated: ${message}`,
              timestamp: referenceDate,
            },
          ],
        });

        await newAlert.save();
      }
    }
  }

  // 5. Query active/unresolved alerts
  const alertQuery = {
    status: { $in: ["ACTIVE", "ACKNOWLEDGED"] },
    resolved: false,
  };
  if (filter.centreName) {
    alertQuery.healthCentre = filter.centreName;
  }

  const rawAlerts = await Alert.find(alertQuery).lean();

  const activeAlerts = rawAlerts.map((alert) =>
    attachEscalationStatus(alert, referenceDate)
  );

  // Sort: critical first, then high, then medium, then by createdAt desc
  activeAlerts.sort((a, b) => {
    const weightA = SEVERITY_WEIGHT[a.severity?.toLowerCase()] || 0;
    const weightB = SEVERITY_WEIGHT[b.severity?.toLowerCase()] || 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return activeAlerts;
}

/**
 * Acknowledges an alert by ID.
 *
 * @param {string} alertId
 * @param {Object} actor - { email, role }
 * @param {string} [actionNote]
 * @returns {Promise<Object>}
 */
async function acknowledgeAlert(alertId, actor, actionNote = "") {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    const error = new Error("Alert not found");
    error.statusCode = 404;
    throw error;
  }

  if (alert.status === "RESOLVED" || alert.resolved) {
    const error = new Error("Cannot acknowledge an already resolved alert");
    error.statusCode = 409;
    throw error;
  }

  if (alert.status === "ACKNOWLEDGED") {
    const error = new Error("Alert is already acknowledged");
    error.statusCode = 409;
    throw error;
  }

  const noteText = actionNote && actionNote.trim() ? actionNote.trim() : "Alert acknowledged";

  alert.status = "ACKNOWLEDGED";
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = actor.email;
  if (actionNote && actionNote.trim()) {
    alert.latestActionNote = noteText;
  }

  alert.actions.push({
    action: "ACKNOWLEDGED",
    performedBy: actor.email,
    role: actor.role,
    note: noteText,
    timestamp: new Date(),
  });

  await alert.save();
  return attachEscalationStatus(alert.toObject());
}

/**
 * Adds an administrative note to an alert.
 *
 * @param {string} alertId
 * @param {Object} actor - { email, role }
 * @param {string} note
 * @returns {Promise<Object>}
 */
async function addAlertNote(alertId, actor, note) {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    const error = new Error("Alert not found");
    error.statusCode = 404;
    throw error;
  }

  const noteText = note ? note.trim() : "";
  if (!noteText) {
    const error = new Error("Note content is required");
    error.statusCode = 400;
    throw error;
  }

  alert.latestActionNote = noteText;
  alert.actions.push({
    action: "NOTE_ADDED",
    performedBy: actor.email,
    role: actor.role,
    note: noteText,
    timestamp: new Date(),
  });

  await alert.save();
  return attachEscalationStatus(alert.toObject());
}

/**
 * Resolves an alert by ID.
 *
 * @param {string} alertId
 * @param {Object} actor - { email, role }
 * @param {string} resolutionNote
 * @returns {Promise<Object>}
 */
async function resolveAlert(alertId, actor = { email: "system", role: "system" }, resolutionNote = "") {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    const error = new Error("Alert not found");
    error.statusCode = 404;
    throw error;
  }

  if (alert.status === "RESOLVED" || alert.resolved) {
    const error = new Error("Alert is already resolved");
    error.statusCode = 409;
    throw error;
  }

  const noteText = resolutionNote && resolutionNote.trim()
    ? resolutionNote.trim()
    : "Alert resolved by administrator";

  alert.status = "RESOLVED";
  alert.resolved = true;
  alert.resolvedAt = new Date();
  alert.resolvedBy = actor.email;
  alert.resolutionNote = noteText;
  alert.latestActionNote = noteText;

  alert.actions.push({
    action: "RESOLVED",
    performedBy: actor.email,
    role: actor.role,
    note: noteText,
    timestamp: new Date(),
  });

  await alert.save();
  return attachEscalationStatus(alert.toObject());
}

/**
 * Computes role-scoped summary counts for alerts.
 *
 * @param {Object} filter
 * @param {string} [filter.healthCentre]
 * @returns {Promise<Object>}
 */
async function getAlertsSummary(filter = {}) {
  const query = {};
  if (filter.healthCentre) {
    query.healthCentre = filter.healthCentre;
  }

  const allAlerts = await Alert.find(query).lean();
  const now = new Date();

  let active = 0;
  let acknowledged = 0;
  let resolved = 0;
  let highPriority = 0;
  let escalated = 0;
  let unacknowledged = 0;

  for (const alert of allAlerts) {
    const isEsc = alertConfig.isAlertEscalated(alert, now) || alert.isEscalated;
    const isResolved = alert.status === "RESOLVED" || alert.resolved;
    const isAck = alert.status === "ACKNOWLEDGED";
    const isActive = (alert.status === "ACTIVE" || (!alert.status && !alert.resolved)) && !isResolved;

    if (isResolved) {
      resolved++;
    } else if (isAck) {
      acknowledged++;
    } else {
      active++;
      unacknowledged++;
    }

    if (!isResolved && (alert.severity === "high" || alert.severity === "critical")) {
      highPriority++;
    }

    if (!isResolved && isEsc) {
      escalated++;
    }
  }

  return {
    active,
    acknowledged,
    resolved,
    highPriority,
    escalated,
    unacknowledged,
    total: allAlerts.length,
  };
}

module.exports = {
  calculateConsecutiveAbsences,
  generateAndGetActiveAlerts,
  acknowledgeAlert,
  addAlertNote,
  resolveAlert,
  getAlertsSummary,
  attachEscalationStatus,
};
