const express = require("express");
const router = express.Router();
const {
  markAttendance,
  getAllAttendance,
  getTodayAttendance,
} = require("../controllers/attendanceController");

router.post("/", markAttendance);
router.get("/", getAllAttendance);
router.get("/today/:email", getTodayAttendance);

module.exports = router;
