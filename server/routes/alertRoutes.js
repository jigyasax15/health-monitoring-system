const express = require("express");
const {
  getAlertSummary,
  getAlerts,
  getCentreAlerts,
  getDdhsAlerts,
  getAlertById,
  acknowledgeAlertController,
  addAlertNoteController,
  resolveAlertController,
} = require("../controllers/alertController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// All alert endpoints require authentication and admin privileges
router.use(authenticate);
router.use(authorizeRoles("centre-admin", "ddhs"));

// Summary & Aggregation
router.get("/summary", getAlertSummary);

// Alerts lists & filters
router.get("/centre", getCentreAlerts);
router.get("/ddhs", authorizeRoles("ddhs"), getDdhsAlerts);
router.get("/", getAlerts);

// Single alert detail
router.get("/:id", getAlertById);

// Alert lifecycle actions
router.patch("/:id/acknowledge", acknowledgeAlertController);
router.post("/:id/notes", addAlertNoteController);
router.post("/:id/resolve", resolveAlertController);
router.patch("/:id/resolve", resolveAlertController);

module.exports = router;
