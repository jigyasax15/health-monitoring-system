const express = require("express");
const {
  getCentreAlerts,
  getDdhsAlerts,
  resolveAlertController,
} = require("../controllers/alertController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/centre", authorizeRoles("centre-admin", "ddhs"), getCentreAlerts);
router.get("/ddhs", authorizeRoles("ddhs"), getDdhsAlerts);
router.post(
  "/:id/resolve",
  authorizeRoles("centre-admin", "ddhs"),
  resolveAlertController
);

module.exports = router;
