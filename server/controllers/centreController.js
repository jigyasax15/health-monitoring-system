const Doctor = require("../models/Doctor");
const Attendance = require("../models/Attendance");
const HealthCentre = require("../models/HealthCentre");
const { getTodayDateString } = require("../utils/dateTime");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");
const { getApplicableHolidays } = require("../utils/workingDays");

// Get daily attendance summary for a specific health centre
const getPhcSummary = async (req, res) => {
  try {
    let targetCentre = req.query.centre;

    // Enforce centre data isolation for centre-admin
    if (req.user.role === "centre-admin") {
      if (!req.user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "No health centre assigned to this administrator account",
        });
      }

      if (targetCentre && targetCentre.trim() !== req.user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "Access denied: you can only access your assigned health centre",
        });
      }

      targetCentre = req.user.healthCentre;
    }

    if (!targetCentre || !targetCentre.trim()) {
      return res.status(400).json({
        success: false,
        message: "Health centre parameter is required",
      });
    }

    const centreName = targetCentre.trim();

    // Verify centre exists in database
    const healthCentreDoc = await HealthCentre.findOne({
      name: centreName,
    });

    if (!healthCentreDoc) {
      return res.status(404).json({
        success: false,
        message: "Health centre not found",
      });
    }

    const today = getTodayDateString();

    const [doctors, attendanceRecords, holidayList] = await Promise.all([
      Doctor.find({ healthCentre: healthCentreDoc.name }),
      Attendance.find({
        healthCentre: healthCentreDoc.name,
        date: today,
      }),
      getApplicableHolidays(today, today, healthCentreDoc.name),
    ]);

    const doctorData = doctors.map((doctor) => {
      const attendance = attendanceRecords.find(
        (record) => record.doctorEmail === doctor.email
      );

      const status = determineAttendanceStatus(attendance, {
        targetDate: today,
        healthCentre: doctor.healthCentre,
        holidayList,
      });

      return {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        department: doctor.department,
        healthCentre: doctor.healthCentre,
        status,
      };
    });

    const present = doctorData.filter(
      (doctor) => doctor.status === "Present"
    ).length;

    const absent = doctorData.filter(
      (doctor) => doctor.status === "Absent"
    ).length;

    const notMarked = doctorData.filter(
      (doctor) => doctor.status === "Not Marked"
    ).length;

    const nonWorking = doctorData.filter(
      (doctor) => doctor.status === "Non-Working Day"
    ).length;

    res.json({
      success: true,
      healthCentre: healthCentreDoc.name,
      date: today,
      totalDoctors: doctorData.length,
      present,
      absent,
      notMarked,
      nonWorking,
      doctors: doctorData,
    });
  } catch (error) {
    console.error("getPhcSummary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getPhcSummary,
};
