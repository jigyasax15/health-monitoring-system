const Doctor = require("../models/Doctor");
const Attendance = require("../models/Attendance");

// Get daily attendance summary for PHC
const getPhcSummary = async (req, res) => {
  try {
    const healthCentre = "PHC Mathura";

    const today = new Date().toISOString().split("T")[0];

    const doctors = await Doctor.find({
      healthCentre,
    });

    const attendanceRecords = await Attendance.find({
      healthCentre,
      date: today,
    });

    const doctorData = doctors.map((doctor) => {
      const attendance = attendanceRecords.find(
        (record) => record.doctorEmail === doctor.email
      );

      return {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        department: doctor.department,
        healthCentre: doctor.healthCentre,
        status: attendance ? attendance.status : "Not Marked",
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
      healthCentre,
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
