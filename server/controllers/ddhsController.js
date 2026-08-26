const HealthCentre = require("../models/HealthCentre");
const Doctor = require("../models/Doctor");
const Attendance = require("../models/Attendance");
const { getTodayDateString } = require("../utils/dateTime");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");

// Get division-wide overview statistics for DDHS
const getDdhsOverview = async (req, res) => {
  try {
    const today = getTodayDateString();

    // Find all active health centres
    const activeCentres = await HealthCentre.find({
      isActive: { $ne: false },
    }).sort({ name: 1 });

    // Fetch all doctors and today's attendance records
    const doctors = await Doctor.find();
    const attendanceRecords = await Attendance.find({
      date: today,
    });

    // Map centres and compute stats
    const centresData = activeCentres.map((centre) => {
      // Find doctors belonging to this centre
      const centreDoctors = doctors.filter(
        (doc) => doc.healthCentre === centre.name
      );

      const totalDoctors = centreDoctors.length;

      let present = 0;
      let absent = 0;
      let notMarked = 0;

      centreDoctors.forEach((doc) => {
        const attendance = attendanceRecords.find(
          (rec) => rec.doctorEmail === doc.email
        );

        const status = determineAttendanceStatus(attendance, {
          targetDate: today,
        });

        if (status === "Present") {
          present++;
        } else if (status === "Absent") {
          absent++;
        } else {
          notMarked++;
        }
      });

      const attendancePercentage =
        totalDoctors > 0
          ? Math.round((present / totalDoctors) * 100 * 10) / 10
          : 0;

      return {
        id: centre._id,
        name: centre.name,
        type: centre.type,
        district: centre.district,
        division: centre.division,
        totalDoctors,
        present,
        absent,
        notMarked,
        attendancePercentage,
      };
    });

    // Division totals
    const activeHealthCentres = centresData.length;
    const totalDoctors = centresData.reduce(
      (sum, c) => sum + c.totalDoctors,
      0
    );
    const present = centresData.reduce((sum, c) => sum + c.present, 0);
    const absent = centresData.reduce((sum, c) => sum + c.absent, 0);
    const notMarked = centresData.reduce((sum, c) => sum + c.notMarked, 0);
    const attendancePercentage =
      totalDoctors > 0
        ? Math.round((present / totalDoctors) * 100 * 10) / 10
        : 0;

    res.json({
      success: true,
      date: today,
      totals: {
        activeHealthCentres,
        totalDoctors,
        present,
        absent,
        notMarked,
        attendancePercentage,
      },
      centres: centresData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getDdhsOverview,
};

