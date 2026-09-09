const express = require("express");
const router = express.Router();
const { getPhcSummary } = require("../controllers/centreController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

router.get(
  "/phc-summary",
  authenticate,
  authorizeRoles("centre-admin", "ddhs"),
  getPhcSummary
);

module.exports = router;
