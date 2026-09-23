const Doctor = require("../models/Doctor");
const Attendance = require("../models/Attendance");
const HealthCentre = require("../models/HealthCentre");
const { getTodayDateString, getPreviousDateString } = require("../utils/dateTime");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");
const { getApplicableHolidays, isWorkingDay } = require("../utils/workingDays");

/**
 * Generates an array of YYYY-MM-DD date strings between startDate and endDate (inclusive).
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {string[]}
 */
function getDateRangeArray(startDate, endDate) {
  const dates = [];
  const curr = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (curr <= end) {
    const year = curr.getUTCFullYear();
    const month = String(curr.getUTCMonth() + 1).padStart(2, "0");
    const day = String(curr.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dates;
}

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
 * Normalizes and validates date range parameters.
 * Defaults to the last 30 days (up to today in IST) if not provided.
 * @param {string} [start]
 * @param {string} [end]
 * @returns {{ startDate: string, endDate: string, error?: string }}
 */
function resolveDateRange(start, end) {
  const today = getTodayDateString();

  const startDate = start ? start.trim() : getPreviousDateString(29);
  const endDate = end ? end.trim() : today;

  if (start && !isValidDateString(start)) {
    return { error: "Invalid startDate format. Expected YYYY-MM-DD." };
  }
  if (end && !isValidDateString(end)) {
    return { error: "Invalid endDate format. Expected YYYY-MM-DD." };
  }

  if (startDate > endDate) {
    return { error: "startDate cannot be after endDate." };
  }

  // Cap maximum range to 365 days
  const dateList = getDateRangeArray(startDate, endDate);
  if (dateList.length > 365) {
    return { error: "Date range cannot exceed 365 days." };
  }

  return { startDate, endDate, dateList };
}

/**
 * Calculates attendance metrics for a doctor over a list of dates.
 * Uses batch Attendance records and determineAttendanceStatus.
 *
 * Attendance percentage denominator policy:
 * - Only scheduled working days count towards eligibleDays / denominator.
 * - Non-working days (weekends, holidays) and future dates are excluded from denominator.
 * - Real Present marks on non-working days are preserved in records and presentDays, but do not alter normal eligibleDays.
 *
 * @param {Object} doctor - Doctor document / object
 * @param {string[]} dateList - List of YYYY-MM-DD strings
 * @param {Map<string, Object>} attendanceMap - Map keyed by `${doctorEmail}_${date}`
 * @param {string} todayStr - Today's date string in IST
 * @param {Array<Object>} [holidayList=[]] - Pre-fetched applicable holidays
 * @returns {Object}
 */
function calculateDoctorMetricsForDates(doctor, dateList, attendanceMap, todayStr, holidayList = [], options = {}) {
  let presentDays = 0;
  let presentWorkingDays = 0;
  let presentNonWorkingDays = 0;
  let absentDays = 0;
  let notMarkedDays = 0;
  let nonWorkingDays = 0;
  let eligibleWorkingDays = 0;

  const records = [];

  for (const date of dateList) {
    const key = `${doctor.email}_${date}`;
    const attendanceDoc = attendanceMap.get(key) || null;

    const working = isWorkingDay(date, {
      healthCentre: doctor.healthCentre,
      holidayList,
    });

    const derivedStatus = determineAttendanceStatus(attendanceDoc, {
      targetDate: date,
      referenceDate: options.referenceDate,
      healthCentre: doctor.healthCentre,
      holidayList,
    });

    if (derivedStatus === "Present") {
      presentDays++;
      if (working) {
        presentWorkingDays++;
        eligibleWorkingDays++;
      } else {
        presentNonWorkingDays++;
      }
    } else if (derivedStatus === "Absent") {
      absentDays++;
      if (working) {
        eligibleWorkingDays++;
      }
    } else if (derivedStatus === "Non-Working Day") {
      nonWorkingDays++;
      // Excluded from percentage denominator
    } else {
      notMarkedDays++;
      // Excluded from percentage denominator (e.g. future working day or today before cutoff)
    }

    records.push({
      doctorId: doctor._id,
      doctorName: doctor.name,
      doctorEmail: doctor.email,
      department: doctor.department,
      healthCentre: doctor.healthCentre,
      date,
      status: derivedStatus,
      isWorkingDay: working,
      markedAt: attendanceDoc ? attendanceDoc.markedAt || attendanceDoc.createdAt : null,
      isRecorded: !!attendanceDoc,
    });
  }

  const attendancePercentage =
    eligibleWorkingDays > 0
      ? Math.round((presentWorkingDays / eligibleWorkingDays) * 100 * 10) / 10
      : 0;

  return {
    doctor: {
      id: doctor._id,
      name: doctor.name,
      email: doctor.email,
      department: doctor.department,
      healthCentre: doctor.healthCentre,
    },
    totalDays: dateList.length,
    eligibleDays: eligibleWorkingDays,
    eligibleWorkingDays,
    presentDays,
    presentWorkingDays,
    presentNonWorkingDays,
    absentDays,
    notMarkedDays,
    nonWorkingDays,
    attendancePercentage,
    records,
  };
}

/**
 * Retrieves attendance summary for a single doctor over a date range.
 */
async function getDoctorAttendanceSummary(doctorEmail, start, end) {
  const { startDate, endDate, dateList, error } = resolveDateRange(start, end);
  if (error) {
    return { error, statusCode: 400 };
  }

  const doctor = await Doctor.findOne({ email: doctorEmail.toLowerCase().trim() }).lean();
  if (!doctor) {
    return { error: "Doctor profile not found", statusCode: 404 };
  }

  // Batch query attendance documents and applicable holidays
  const [attendanceDocs, holidayList] = await Promise.all([
    Attendance.find({
      doctorEmail: doctor.email,
      date: { $gte: startDate, $lte: endDate },
    }).lean(),
    getApplicableHolidays(startDate, endDate, doctor.healthCentre),
  ]);

  const attendanceMap = new Map();
  for (const doc of attendanceDocs) {
    attendanceMap.set(`${doc.doctorEmail}_${doc.date}`, doc);
  }

  const todayStr = getTodayDateString();
  const metrics = calculateDoctorMetricsForDates(
    doctor,
    dateList,
    attendanceMap,
    todayStr,
    holidayList
  );

  return {
    success: true,
    startDate,
    endDate,
    doctor: metrics.doctor,
    totalDays: metrics.totalDays,
    eligibleDays: metrics.eligibleWorkingDays,
    eligibleWorkingDays: metrics.eligibleWorkingDays,
    presentDays: metrics.presentDays,
    presentWorkingDays: metrics.presentWorkingDays,
    presentNonWorkingDays: metrics.presentNonWorkingDays,
    absentDays: metrics.absentDays,
    notMarkedDays: metrics.notMarkedDays,
    nonWorkingDays: metrics.nonWorkingDays,
    attendancePercentage: metrics.attendancePercentage,
  };
}

/**
 * Retrieves filtered, paginated attendance history records.
 */
async function getAttendanceHistoryData(filterOptions) {
  const {
    userRole,
    userEmail,
    userHealthCentre,
    startDate: reqStart,
    endDate: reqEnd,
    doctorEmail: reqDoctorEmail,
    department: reqDepartment,
    healthCentre: reqHealthCentre,
    status: reqStatus,
    page = 1,
    limit = 20,
  } = filterOptions;

  // 1. Pagination Validation
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  if (isNaN(parsedPage) || parsedPage < 1) {
    return { error: "Invalid page parameter. Page must be a positive integer.", statusCode: 400 };
  }
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return { error: "Invalid limit parameter. Limit must be an integer between 1 and 100.", statusCode: 400 };
  }

  // 2. Status Validation
  const validStatuses = ["Present", "Absent", "Not Marked", "Non-Working Day"];
  if (reqStatus && !validStatuses.includes(reqStatus)) {
    return { error: `Invalid status parameter. Must be one of: ${validStatuses.join(", ")}`, statusCode: 400 };
  }

  // 3. Date Range Validation
  const { startDate, endDate, dateList, error } = resolveDateRange(reqStart, reqEnd);
  if (error) {
    return { error, statusCode: 400 };
  }

  // 4. Build Doctor Query based on Role and Filters
  const doctorQuery = {};

  if (userRole === "doctor") {
    doctorQuery.email = userEmail.toLowerCase().trim();
  } else if (userRole === "centre-admin") {
    if (!userHealthCentre) {
      return { error: "No health centre assigned to this administrator account", statusCode: 403 };
    }
    doctorQuery.healthCentre = userHealthCentre;

    if (reqDoctorEmail) {
      doctorQuery.email = reqDoctorEmail.toLowerCase().trim();
    }
    if (reqDepartment) {
      doctorQuery.department = reqDepartment.trim();
    }
  } else if (userRole === "ddhs") {
    if (reqHealthCentre && reqHealthCentre.trim()) {
      const centreExists = await HealthCentre.findOne({
        name: reqHealthCentre.trim(),
        isActive: { $ne: false },
      }).lean();
      if (!centreExists) {
        return { error: "Health centre not found", statusCode: 404 };
      }
      doctorQuery.healthCentre = reqHealthCentre.trim();
    }

    if (reqDoctorEmail) {
      doctorQuery.email = reqDoctorEmail.toLowerCase().trim();
    }
    if (reqDepartment) {
      doctorQuery.department = reqDepartment.trim();
    }
  } else {
    return { error: "Access denied", statusCode: 403 };
  }

  const doctors = await Doctor.find(doctorQuery).lean();
  if (doctors.length === 0) {
    return {
      success: true,
      items: [],
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  const doctorEmails = doctors.map((d) => d.email);

  // 5. Batch Query Attendance Documents and Applicable Holidays
  const targetScopeCentre =
    userRole === "centre-admin"
      ? userHealthCentre
      : reqHealthCentre && reqHealthCentre.trim()
      ? reqHealthCentre.trim()
      : null;

  const [attendanceDocs, holidayList] = await Promise.all([
    Attendance.find({
      doctorEmail: { $in: doctorEmails },
      date: { $gte: startDate, $lte: endDate },
    }).lean(),
    getApplicableHolidays(startDate, endDate, targetScopeCentre),
  ]);

  const attendanceMap = new Map();
  for (const doc of attendanceDocs) {
    attendanceMap.set(`${doc.doctorEmail}_${doc.date}`, doc);
  }

  // 6. Generate All Derived History Records
  let allRecords = [];

  // Sort dates descending (newest first)
  const sortedDates = [...dateList].reverse();

  for (const date of sortedDates) {
    for (const doctor of doctors) {
      const key = `${doctor.email}_${date}`;
      const doc = attendanceMap.get(key) || null;
      const derivedStatus = determineAttendanceStatus(doc, {
        targetDate: date,
        healthCentre: doctor.healthCentre,
        holidayList,
      });

      if (reqStatus && derivedStatus !== reqStatus) {
        continue;
      }

      allRecords.push({
        id: doc ? doc._id : `${doctor._id}_${date}`,
        doctorId: doctor._id,
        doctorName: doctor.name,
        doctorEmail: doctor.email,
        department: doctor.department,
        healthCentre: doctor.healthCentre,
        date,
        status: derivedStatus,
        markedAt: doc ? doc.markedAt || doc.createdAt : null,
        isRecorded: !!doc,
      });
    }
  }

  // 7. Paginate
  const totalItems = allRecords.length;
  const totalPages = Math.ceil(totalItems / parsedLimit);
  const startIndex = (parsedPage - 1) * parsedLimit;
  const items = allRecords.slice(startIndex, startIndex + parsedLimit);

  return {
    success: true,
    startDate,
    endDate,
    items,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      totalItems,
      totalPages,
    },
  };
}

/**
 * Generates centre-level attendance report for a date range.
 */
async function getCentreAttendanceReport(centreName, start, end) {
  const { startDate, endDate, dateList, error } = resolveDateRange(start, end);
  if (error) {
    return { error, statusCode: 400 };
  }

  const centreDoc = await HealthCentre.findOne({ name: centreName.trim() }).lean();
  if (!centreDoc) {
    return { error: "Health centre not found", statusCode: 404 };
  }

  const doctors = await Doctor.find({ healthCentre: centreDoc.name }).lean();
  const doctorEmails = doctors.map((d) => d.email);

  // Batch query attendance docs and holidays for this health centre
  const [attendanceDocs, holidayList] = await Promise.all([
    Attendance.find({
      doctorEmail: { $in: doctorEmails },
      date: { $gte: startDate, $lte: endDate },
    }).lean(),
    getApplicableHolidays(startDate, endDate, centreDoc.name),
  ]);

  const attendanceMap = new Map();
  for (const doc of attendanceDocs) {
    attendanceMap.set(`${doc.doctorEmail}_${doc.date}`, doc);
  }

  const todayStr = getTodayDateString();

  let totalPresent = 0;
  let totalPresentWorking = 0;
  let totalAbsent = 0;
  let totalNotMarked = 0;
  let totalNonWorking = 0;
  let totalEligibleWorking = 0;

  const doctorSummaries = [];
  const departmentMap = new Map();

  for (const doctor of doctors) {
    const metrics = calculateDoctorMetricsForDates(
      doctor,
      dateList,
      attendanceMap,
      todayStr,
      holidayList
    );

    totalPresent += metrics.presentDays;
    totalPresentWorking += metrics.presentWorkingDays;
    totalAbsent += metrics.absentDays;
    totalNotMarked += metrics.notMarkedDays;
    totalNonWorking += metrics.nonWorkingDays;
    totalEligibleWorking += metrics.eligibleWorkingDays;

    doctorSummaries.push({
      id: doctor._id,
      name: doctor.name,
      email: doctor.email,
      department: doctor.department,
      healthCentre: doctor.healthCentre,
      presentDays: metrics.presentDays,
      presentWorkingDays: metrics.presentWorkingDays,
      presentNonWorkingDays: metrics.presentNonWorkingDays,
      absentDays: metrics.absentDays,
      notMarkedDays: metrics.notMarkedDays,
      nonWorkingDays: metrics.nonWorkingDays,
      eligibleDays: metrics.eligibleWorkingDays,
      eligibleWorkingDays: metrics.eligibleWorkingDays,
      attendancePercentage: metrics.attendancePercentage,
    });

    // Department grouping
    const dept = doctor.department || "General";
    if (!departmentMap.has(dept)) {
      departmentMap.set(dept, {
        department: dept,
        totalDoctors: 0,
        presentDays: 0,
        presentWorkingDays: 0,
        absentDays: 0,
        notMarkedDays: 0,
        nonWorkingDays: 0,
        eligibleDays: 0,
      });
    }

    const deptStats = departmentMap.get(dept);
    deptStats.totalDoctors += 1;
    deptStats.presentDays += metrics.presentDays;
    deptStats.presentWorkingDays += metrics.presentWorkingDays;
    deptStats.absentDays += metrics.absentDays;
    deptStats.notMarkedDays += metrics.notMarkedDays;
    deptStats.nonWorkingDays += metrics.nonWorkingDays;
    deptStats.eligibleDays += metrics.eligibleWorkingDays;
  }

  // Calculate department percentages based on scheduled working days
  const departmentSummaries = Array.from(departmentMap.values()).map((dept) => ({
    ...dept,
    attendancePercentage:
      dept.eligibleDays > 0
        ? Math.round((dept.presentWorkingDays / dept.eligibleDays) * 100 * 10) / 10
        : 0,
  }));

  const overallAttendancePercentage =
    totalEligibleWorking > 0
      ? Math.round((totalPresentWorking / totalEligibleWorking) * 100 * 10) / 10
      : 0;

  return {
    success: true,
    healthCentre: centreDoc.name,
    startDate,
    endDate,
    totalDays: dateList.length,
    totalDoctors: doctors.length,
    present: totalPresent,
    presentWorking: totalPresentWorking,
    absent: totalAbsent,
    notMarked: totalNotMarked,
    nonWorking: totalNonWorking,
    eligibleDays: totalEligibleWorking,
    eligibleWorkingDays: totalEligibleWorking,
    attendancePercentage: overallAttendancePercentage,
    doctorSummary: doctorSummaries,
    departmentSummary: departmentSummaries,
  };
}

/**
 * Generates district / division-wide attendance report for DDHS.
 */
async function getDdhsDistrictReport(start, end, options = {}) {
  const { startDate, endDate, dateList, error } = resolveDateRange(start, end);
  if (error) {
    return { error, statusCode: 400 };
  }

  const centreQuery = { isActive: { $ne: false } };
  if (options.centreName && options.centreName.trim()) {
    const centreExists = await HealthCentre.findOne({
      name: options.centreName.trim(),
      isActive: { $ne: false },
    }).lean();
    if (!centreExists) {
      return { error: "Health centre not found", statusCode: 404 };
    }
    centreQuery.name = options.centreName.trim();
  }

  const centres = await HealthCentre.find(centreQuery).sort({ name: 1 }).lean();
  const centreNames = centres.map((c) => c.name);

  const doctors = await Doctor.find({ healthCentre: { $in: centreNames } }).lean();
  const doctorEmails = doctors.map((d) => d.email);

  // Batch query attendance records and all active holidays for the range
  const [attendanceDocs, holidayList] = await Promise.all([
    Attendance.find({
      doctorEmail: { $in: doctorEmails },
      date: { $gte: startDate, $lte: endDate },
    }).lean(),
    getApplicableHolidays(startDate, endDate, options.centreName || null),
  ]);

  const attendanceMap = new Map();
  for (const doc of attendanceDocs) {
    attendanceMap.set(`${doc.doctorEmail}_${doc.date}`, doc);
  }

  const todayStr = getTodayDateString();

  let districtPresent = 0;
  let districtPresentWorking = 0;
  let districtAbsent = 0;
  let districtNotMarked = 0;
  let districtNonWorking = 0;
  let districtEligibleWorking = 0;

  const doctorRankings = [];
  const centreComparisons = [];

  for (const centre of centres) {
    const centreDoctors = doctors.filter((d) => d.healthCentre === centre.name);
    let centrePresent = 0;
    let centrePresentWorking = 0;
    let centreAbsent = 0;
    let centreNotMarked = 0;
    let centreNonWorking = 0;
    let centreEligibleWorking = 0;

    for (const doc of centreDoctors) {
      const metrics = calculateDoctorMetricsForDates(
        doc,
        dateList,
        attendanceMap,
        todayStr,
        holidayList
      );

      centrePresent += metrics.presentDays;
      centrePresentWorking += metrics.presentWorkingDays;
      centreAbsent += metrics.absentDays;
      centreNotMarked += metrics.notMarkedDays;
      centreNonWorking += metrics.nonWorkingDays;
      centreEligibleWorking += metrics.eligibleWorkingDays;

      doctorRankings.push({
        id: doc._id,
        name: doc.name,
        email: doc.email,
        department: doc.department,
        healthCentre: doc.healthCentre,
        presentDays: metrics.presentDays,
        presentWorkingDays: metrics.presentWorkingDays,
        absentDays: metrics.absentDays,
        notMarkedDays: metrics.notMarkedDays,
        nonWorkingDays: metrics.nonWorkingDays,
        eligibleDays: metrics.eligibleWorkingDays,
        eligibleWorkingDays: metrics.eligibleWorkingDays,
        attendancePercentage: metrics.attendancePercentage,
      });
    }

    districtPresent += centrePresent;
    districtPresentWorking += centrePresentWorking;
    districtAbsent += centreAbsent;
    districtNotMarked += centreNotMarked;
    districtNonWorking += centreNonWorking;
    districtEligibleWorking += centreEligibleWorking;

    const centrePct =
      centreEligibleWorking > 0
        ? Math.round((centrePresentWorking / centreEligibleWorking) * 100 * 10) / 10
        : 0;

    centreComparisons.push({
      id: centre._id,
      name: centre.name,
      type: centre.type,
      district: centre.district,
      division: centre.division,
      totalDoctors: centreDoctors.length,
      present: centrePresent,
      presentWorking: centrePresentWorking,
      absent: centreAbsent,
      notMarked: centreNotMarked,
      nonWorking: centreNonWorking,
      eligibleWorkingDays: centreEligibleWorking,
      attendancePercentage: centrePct,
    });
  }

  // Sort doctors by highest absenteeism (highest absentDays, lowest attendancePercentage)
  doctorRankings.sort((a, b) => {
    if (b.absentDays !== a.absentDays) {
      return b.absentDays - a.absentDays;
    }
    return a.attendancePercentage - b.attendancePercentage;
  });

  // Top high absenteeism doctors with at least 1 absent day
  const highAbsenteeismDoctors = doctorRankings
    .filter((d) => d.absentDays > 0)
    .slice(0, 10);

  const districtAttendancePercentage =
    districtEligibleWorking > 0
      ? Math.round((districtPresentWorking / districtEligibleWorking) * 100 * 10) / 10
      : 0;

  return {
    success: true,
    startDate,
    endDate,
    totalDays: dateList.length,
    overallStats: {
      activeHealthCentres: centres.length,
      totalDoctors: doctors.length,
      present: districtPresent,
      presentWorking: districtPresentWorking,
      absent: districtAbsent,
      notMarked: districtNotMarked,
      nonWorking: districtNonWorking,
      eligibleWorkingDays: districtEligibleWorking,
      attendancePercentage: districtAttendancePercentage,
    },
    centreComparison: centreComparisons,
    highAbsenteeismDoctors,
  };
}

module.exports = {
  isValidDateString,
  resolveDateRange,
  calculateDoctorMetricsForDates,
  getDoctorAttendanceSummary,
  getAttendanceHistoryData,
  getCentreAttendanceReport,
  getDdhsDistrictReport,
};
