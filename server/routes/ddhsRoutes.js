const express = require("express");
const { getDdhsOverview } = require("../controllers/ddhsController");
const { getDdhsAlerts } = require("../controllers/alertController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("ddhs"));

router.get("/overview", getDdhsOverview);
router.get("/alerts", getDdhsAlerts);

module.exports = router;
