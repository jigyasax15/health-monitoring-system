const express = require("express");
const router = express.Router();
const {
  markAttendance,
  getAllAttendance,
  getTodayAttendance,
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
  "/today/:email",
  authorizeRoles("doctor", "centre-admin", "ddhs"),
  getTodayAttendance
);

module.exports = router;
