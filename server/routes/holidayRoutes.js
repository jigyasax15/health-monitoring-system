const express = require("express");
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holidayController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// All holiday routes require authentication
router.use(authenticate);

router.get(
  "/",
  authorizeRoles("doctor", "centre-admin", "ddhs"),
  getHolidays
);

router.post(
  "/",
  authorizeRoles("centre-admin", "ddhs"),
  createHoliday
);

router.patch(
  "/:id",
  authorizeRoles("centre-admin", "ddhs"),
  updateHoliday
);

router.delete(
  "/:id",
  authorizeRoles("centre-admin", "ddhs"),
  deleteHoliday
);

module.exports = router;
