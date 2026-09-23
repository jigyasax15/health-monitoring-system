const Attendance = require("../models/Attendance");
const Doctor = require("../models/Doctor");
const { getTodayDateString } = require("../utils/dateTime");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");
const {
  getAttendanceHistoryData,
  getDoctorAttendanceSummary,
} = require("../services/reportService");

// Mark daily attendance for the authenticated doctor
const markAttendance = async (req, res) => {
  try {
    // Rely strictly on verified user from JWT token
    const doctorEmail = req.user.email.toLowerCase().trim();

    const doctor = await Doctor.findOne({
      email: doctorEmail,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const today = getTodayDateString();

    const existingAttendance = await Attendance.findOne({
      doctorEmail,
      date: today,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked today",
      });
    }

    const attendance = new Attendance({
      doctorEmail,
      doctorName: doctor.name,
      healthCentre: doctor.healthCentre,
      status: "Present",
      date: today,
    });

    const savedAttendance = await attendance.save();

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      attendance: savedAttendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked today",
      });
    }

    console.error("markAttendance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all attendance records (isolated for centre admins)
const getAllAttendance = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "centre-admin") {
      filter.healthCentre = req.user.healthCentre;
    }

    const records = await Attendance.find(filter).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: records.length,
      attendance: records,
    });
  } catch (error) {
    console.error("getAllAttendance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get today's attendance for one doctor
const getTodayAttendance = async (req, res) => {
  try {
    const email = (req.params.email || "").toLowerCase().trim();

    // Enforce role authorization
    if (req.user.role === "doctor" && req.user.email !== email) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot access another doctor's attendance",
      });
    }

    const today = getTodayDateString();

    const doctor = await Doctor.findOne({ email }).lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    if (
      req.user.role === "centre-admin" &&
      doctor.healthCentre !== req.user.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: doctor belongs to a different health centre",
      });
    }

    const { getApplicableHolidays } = require("../utils/workingDays");
    const [attendance, holidayList] = await Promise.all([
      Attendance.findOne({
        doctorEmail: email,
        date: today,
      }),
      getApplicableHolidays(today, today, doctor.healthCentre),
    ]);

    const derivedStatus = determineAttendanceStatus(attendance, {
      targetDate: today,
      healthCentre: doctor.healthCentre,
      holidayList,
    });

    if (!attendance) {
      return res.json({
        success: true,
        marked: false,
        status: derivedStatus,
      });
    }

    res.json({
      success: true,
      marked: true,
      status: attendance.status,
      attendance,
    });
  } catch (error) {
    console.error("getTodayAttendance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/attendance/history
const getAttendanceHistory = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      doctorEmail,
      department,
      healthCentre,
      page,
      limit,
    } = req.query;

    const result = await getAttendanceHistoryData({
      userRole: req.user.role,
      userEmail: req.user.email,
      userHealthCentre: req.user.healthCentre,
      startDate,
      endDate,
      status,
      doctorEmail,
      department,
      healthCentre,
      page,
      limit,
    });

    if (result.error) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.error,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("getAttendanceHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/attendance/my-summary
const getMyAttendanceSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const doctorEmail = req.user.email;

    const result = await getDoctorAttendanceSummary(
      doctorEmail,
      startDate,
      endDate
    );

    if (result.error) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.error,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("getMyAttendanceSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  markAttendance,
  getAllAttendance,
  getTodayAttendance,
  getAttendanceHistory,
  getMyAttendanceSummary,
};
