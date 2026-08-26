const Attendance = require("../models/Attendance");
const Doctor = require("../models/Doctor");

// Mark daily attendance for a doctor
const markAttendance = async (req, res) => {
  try {
    const { doctorEmail, doctorName, healthCentre } = req.body;

    if (!doctorEmail || !doctorName || !healthCentre) {
      return res.status(400).json({
        success: false,
        message: "Doctor attendance information is incomplete",
      });
    }

    const normalizedEmail = doctorEmail.toLowerCase().trim();

    const doctor = await Doctor.findOne({
      email: normalizedEmail,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const existingAttendance = await Attendance.findOne({
      doctorEmail: normalizedEmail,
      date: today,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked today",
      });
    }

    const attendance = new Attendance({
      doctorEmail: normalizedEmail,
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

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all attendance records
const getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: records.length,
      attendance: records,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get today's attendance for one doctor
const getTodayAttendance = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();

    const today = new Date().toISOString().split("T")[0];

    const attendance = await Attendance.findOne({
      doctorEmail: email,
      date: today,
    });

    if (!attendance) {
      return res.json({
        success: true,
        marked: false,
        status: "Not Marked",
      });
    }

    res.json({
      success: true,
      marked: true,
      status: attendance.status,
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  markAttendance,
  getAllAttendance,
  getTodayAttendance,
};
