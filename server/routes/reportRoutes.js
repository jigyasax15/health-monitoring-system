const express = require("express");
const {
  getCentreAttendanceReportController,
  getDdhsAttendanceReportController,
} = require("../controllers/reportController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get(
  "/centre-attendance",
  authorizeRoles("centre-admin", "ddhs"),
  getCentreAttendanceReportController
);

router.get(
  "/ddhs-attendance",
  authorizeRoles("ddhs"),
  getDdhsAttendanceReportController
);

module.exports = router;
