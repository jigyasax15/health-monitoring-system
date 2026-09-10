const express = require("express");
const router = express.Router();
const {
  markAttendance,
  getAllAttendance,
  getTodayAttendance,
  getAttendanceHistory,
  getMyAttendanceSummary,
} = require("../controllers/attendanceController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// All attendance routes require authentication
router.use(authenticate);

router.post("/", authorizeRoles("doctor"), markAttendance);
router.get("/", authorizeRoles("centre-admin", "ddhs"), getAllAttendance);
router.get(
  "/history",
  authorizeRoles("doctor", "centre-admin", "ddhs"),
  getAttendanceHistory
);
router.get("/my-summary", authorizeRoles("doctor"), getMyAttendanceSummary);
router.get(
  "/today/:email",
  authorizeRoles("doctor", "centre-admin", "ddhs"),
  getTodayAttendance
);

module.exports = router;
