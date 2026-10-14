const express = require("express");
const {
  submitLeave,
  getMyLeaves,
  getCentreLeaves,
  getDdhsLeaves,
  getLeaveSummary,
  getLeaveById,
  approveLeave,
  rejectLeave,
  cancelLeave,
} = require("../controllers/leaveController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// All leave endpoints require authentication
router.use(authenticate);

// Doctor specific routes
router.post("/", authorizeRoles("doctor"), submitLeave);
router.get("/my", authorizeRoles("doctor"), getMyLeaves);

// Centre Admin specific routes
router.get("/centre", authorizeRoles("centre-admin"), getCentreLeaves);
router.patch("/:id/approve", authorizeRoles("centre-admin"), approveLeave);
router.patch("/:id/reject", authorizeRoles("centre-admin"), rejectLeave);

// DDHS specific routes
router.get("/ddhs", authorizeRoles("ddhs"), getDdhsLeaves);

// Shared / Role-scoped routes
router.get("/summary", authorizeRoles("doctor", "centre-admin", "ddhs"), getLeaveSummary);
router.get("/:id", authorizeRoles("doctor", "centre-admin", "ddhs"), getLeaveById);
router.patch("/:id/cancel", authorizeRoles("doctor", "centre-admin"), cancelLeave);

module.exports = router;
