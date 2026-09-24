const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const alertConfig = require("../config/alertConfig");
const {
  generateAndGetActiveAlerts,
  acknowledgeAlert,
  addAlertNote,
  resolveAlert,
  getAlertsSummary,
  attachEscalationStatus,
} = require("../services/alertService");

// Helper to validate MongoDB ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/alerts/summary
const getAlertSummary = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "centre-admin") {
      if (!req.user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "No health centre assigned to this administrator account",
        });
      }
      filter.healthCentre = req.user.healthCentre;
    } else if (req.user.role === "ddhs") {
      if (req.query.centre && req.query.centre.trim()) {
        filter.healthCentre = req.query.centre.trim();
      }
    }

    const summary = await getAlertsSummary(filter);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("getAlertSummary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/alerts (with comprehensive filters, search & pagination)
const getAlerts = async (req, res) => {
  try {
    let {
      status,
      severity,
      healthCentre,
      doctorEmail,
      startDate,
      endDate,
      escalated,
      page = 1,
      limit = 20,
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit. Page must be >= 1, limit must be between 1 and 100",
      });
    }

    const query = {};

    // Strict centre isolation for centre-admin
    if (req.user.role === "centre-admin") {
      if (!req.user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "No health centre assigned to this administrator account",
        });
      }
      query.healthCentre = req.user.healthCentre;
    } else if (req.user.role === "ddhs") {
      if (healthCentre && healthCentre.trim()) {
        query.healthCentre = healthCentre.trim();
      }
    }

    if (status && status.trim()) {
      query.status = status.trim().toUpperCase();
    }

    if (severity && severity.trim()) {
      query.severity = severity.trim().toLowerCase();
    }

    if (doctorEmail && doctorEmail.trim()) {
      query.doctorEmail = doctorEmail.trim().toLowerCase();
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate && startDate.trim()) {
        query.date.$gte = startDate.trim();
      }
      if (endDate && endDate.trim()) {
        query.date.$lte = endDate.trim();
      }
    }

    const totalItems = await Alert.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const skip = (page - 1) * limit;

    const rawAlerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const now = new Date();
    let alerts = rawAlerts.map((alert) => attachEscalationStatus(alert, now));

    if (escalated === "true" || escalated === true) {
      alerts = alerts.filter((a) => a.isEscalated);
    } else if (escalated === "false" || escalated === false) {
      alerts = alerts.filter((a) => !a.isEscalated);
    }

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        totalPages,
        totalItems,
      },
      alerts,
    });
  } catch (error) {
    console.error("getAlerts error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

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

// GET /api/alerts/:id
const getAlertById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert ID format",
      });
    }

    const alert = await Alert.findById(id).lean();

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    // Centre admin can only access alerts belonging to their assigned health centre
    if (
      req.user.role === "centre-admin" &&
      alert.healthCentre !== req.user.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you can only access alerts for your assigned health centre",
      });
    }

    const alertWithEscalation = attachEscalationStatus(alert);

    res.json({
      success: true,
      alert: alertWithEscalation,
    });
  } catch (error) {
    console.error("getAlertById error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PATCH /api/alerts/:id/acknowledge
const acknowledgeAlertController = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionNote } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert ID format",
      });
    }

    const existingAlert = await Alert.findById(id);
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    // Strict centre isolation
    if (
      req.user.role === "centre-admin" &&
      existingAlert.healthCentre !== req.user.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you can only acknowledge alerts for your assigned health centre",
      });
    }

    const updatedAlert = await acknowledgeAlert(
      id,
      { email: req.user.email, role: req.user.role },
      actionNote
    );

    res.json({
      success: true,
      message: "Alert acknowledged successfully",
      alert: updatedAlert,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    console.error("acknowledgeAlertController error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/alerts/:id/notes
const addAlertNoteController = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert ID format",
      });
    }

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: "Note content is required",
      });
    }

    if (note.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Note exceeds maximum permitted length (1000 characters)",
      });
    }

    const existingAlert = await Alert.findById(id);
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    // Strict centre isolation
    if (
      req.user.role === "centre-admin" &&
      existingAlert.healthCentre !== req.user.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you can only add notes to alerts for your assigned health centre",
      });
    }

    const updatedAlert = await addAlertNote(
      id,
      { email: req.user.email, role: req.user.role },
      note
    );

    res.json({
      success: true,
      message: "Note added successfully",
      alert: updatedAlert,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    console.error("addAlertNoteController error:", error);
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
    const { resolutionNote } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert ID format",
      });
    }

    if (!resolutionNote || !resolutionNote.trim()) {
      return res.status(400).json({
        success: false,
        message: "Resolution note is required to resolve an alert",
      });
    }

    if (resolutionNote.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Resolution note exceeds maximum permitted length (1000 characters)",
      });
    }

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

    const updatedAlert = await resolveAlert(
      id,
      { email: req.user.email, role: req.user.role },
      resolutionNote
    );

    res.json({
      success: true,
      message: "Alert resolved successfully",
      alert: updatedAlert,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    console.error("resolveAlertController error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAlertSummary,
  getAlerts,
  getCentreAlerts,
  getDdhsAlerts,
  getAlertById,
  acknowledgeAlertController,
  addAlertNoteController,
  resolveAlertController,
};
