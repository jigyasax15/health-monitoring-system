const Alert = require("../models/Alert");
const Doctor = require("../models/Doctor");
const Attendance = require("../models/Attendance");
const HealthCentre = require("../models/HealthCentre");
const {
  getTodayDateString,
  getPreviousDateString,
} = require("../utils/dateTime");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");
const { getApplicableHolidays } = require("../utils/workingDays");

const SEVERITY_WEIGHT = {
  critical: 3,
  high: 2,
  medium: 1,
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

      // Upsert alert in DB to prevent duplicates
      await Alert.findOneAndUpdate(
        {
          doctorEmail: doctor.email,
          date: todayStr,
          type: alertType,
        },
        {
          doctorId: doctor._id,
          doctorName: doctor.name,
          doctorEmail: doctor.email,
          healthCentre: doctor.healthCentre,
          type: alertType,
          severity,
          message,
          date: todayStr,
          consecutiveDays,
          resolved: false,
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        }
      );
    } else {
      // If doctor is Present or Not Marked today, resolve any open alerts created for today
      await Alert.updateMany(
        {
          doctorEmail: doctor.email,
          date: todayStr,
          resolved: false,
        },
        {
          $set: {
            resolved: true,
            resolvedAt: new Date(),
          },
        }
      );
    }
  }

  // 5. Query active alerts
  const alertQuery = { resolved: false };
  if (filter.centreName) {
    alertQuery.healthCentre = filter.centreName;
  }

  const activeAlerts = await Alert.find(alertQuery).lean();

  // Sort: critical first, then high, then medium, then by createdAt desc
  activeAlerts.sort((a, b) => {
    const weightA = SEVERITY_WEIGHT[a.severity] || 0;
    const weightB = SEVERITY_WEIGHT[b.severity] || 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return activeAlerts;
}

/**
 * Resolves an alert by ID.
 *
 * @param {string} alertId
 * @returns {Promise<Object|null>}
 */
async function resolveAlert(alertId) {
  const alert = await Alert.findByIdAndUpdate(
    alertId,
    {
      resolved: true,
      resolvedAt: new Date(),
    },
    { returnDocument: "after" }
  );
  return alert;
}

module.exports = {
  calculateConsecutiveAbsences,
  generateAndGetActiveAlerts,
  resolveAlert,
};
