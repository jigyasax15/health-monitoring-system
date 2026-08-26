const {
  generateAndGetActiveAlerts,
  resolveAlert,
} = require("../services/alertService");

// GET /api/alerts/centre?centre=<health-centre-name>
const getCentreAlerts = async (req, res) => {
  try {
    const { centre } = req.query;

    if (!centre || !centre.trim()) {
      return res.status(400).json({
        success: false,
        message: "Health centre parameter is required",
      });
    }

    const centreName = centre.trim();
    const alerts = await generateAndGetActiveAlerts({ centreName });

    res.json({
      success: true,
      healthCentre: centreName,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// POST /api/alerts/:id/resolve
const resolveAlertController = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedAlert = await resolveAlert(id);

    if (!updatedAlert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    res.json({
      success: true,
      message: "Alert resolved successfully",
      alert: updatedAlert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getCentreAlerts,
  getDdhsAlerts,
  resolveAlertController,
};
