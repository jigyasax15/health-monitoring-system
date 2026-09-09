const Alert = require("../models/Alert");
const {
  generateAndGetActiveAlerts,
  resolveAlert,
} = require("../services/alertService");

// GET /api/alerts/centre?centre=<health-centre-name>
const getCentreAlerts = async (req, res) => {
  try {
    let targetCentre = req.query.centre;

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
          message: "Access denied: you can only access alerts for your assigned health centre",
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
    const alerts = await generateAndGetActiveAlerts({ centreName });

    res.json({
      success: true,
      healthCentre: centreName,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error("getCentreAlerts error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/ddhs/alerts (or /api/alerts/ddhs)
const getDdhsAlerts = async (req, res) => {
  try {
    const alerts = await generateAndGetActiveAlerts();

    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error("getDdhsAlerts error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/alerts/:id/resolve
const resolveAlertController = async (req, res) => {
  try {
    const { id } = req.params;

    const existingAlert = await Alert.findById(id);

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    // Centre admin can only resolve alerts belonging to their assigned health centre
    if (
      req.user.role === "centre-admin" &&
      existingAlert.healthCentre !== req.user.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you can only resolve alerts for your assigned health centre",
      });
    }

    const updatedAlert = await resolveAlert(id);

    res.json({
      success: true,
      message: "Alert resolved successfully",
      alert: updatedAlert,
    });
  } catch (error) {
    console.error("resolveAlertController error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getCentreAlerts,
  getDdhsAlerts,
  resolveAlertController,
};
