const Doctor = require("../models/Doctor");
const Attendance = require("../models/Attendance");
const HealthCentre = require("../models/HealthCentre");
const { getTodayDateString } = require("../utils/dateTime");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");

// Get daily attendance summary for a specific health centre
const getPhcSummary = async (req, res) => {
  try {
    const { centre } = req.query;

    if (!centre || !centre.trim()) {
      return res.status(400).json({
        success: false,
        message: "Health centre parameter is required",
      });
    }

    const centreName = centre.trim();

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

    const doctors = await Doctor.find({
      healthCentre: healthCentreDoc.name,
    });

    const attendanceRecords = await Attendance.find({
      healthCentre: healthCentreDoc.name,
      date: today,
    });

    const doctorData = doctors.map((doctor) => {
      const attendance = attendanceRecords.find(
        (record) => record.doctorEmail === doctor.email
      );

      const status = determineAttendanceStatus(attendance, {
        targetDate: today,
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

    res.json({
      success: true,
      healthCentre: healthCentreDoc.name,
      date: today,
      totalDoctors: doctorData.length,
      present,
      absent,
      notMarked,
      doctors: doctorData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getPhcSummary,
};

