const {
  getCentreAttendanceReport,
  getDdhsDistrictReport,
} = require("../services/reportService");

// GET /api/reports/centre-attendance?startDate=...&endDate=...&centre=...
const getCentreAttendanceReportController = async (req, res) => {
  try {
    let targetCentre = req.query.centre;

    // Enforce health centre isolation for centre-admin
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
          message: "Access denied: you can only access reports for your assigned health centre",
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

    const { startDate, endDate } = req.query;

    const report = await getCentreAttendanceReport(
      targetCentre,
      startDate,
      endDate
    );

    if (report.error) {
      return res.status(report.statusCode || 400).json({
        success: false,
        message: report.error,
      });
    }

    return res.json(report);
  } catch (error) {
    console.error("getCentreAttendanceReportController error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/reports/ddhs-attendance?startDate=...&endDate=...&centre=...
const getDdhsAttendanceReportController = async (req, res) => {
  try {
    const { startDate, endDate, centre } = req.query;

    const report = await getDdhsDistrictReport(startDate, endDate, {
      centreName: centre,
    });

    if (report.error) {
      return res.status(report.statusCode || 400).json({
        success: false,
        message: report.error,
      });
    }

    return res.json(report);
  } catch (error) {
    console.error("getDdhsAttendanceReportController error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getCentreAttendanceReportController,
  getDdhsAttendanceReportController,
};
