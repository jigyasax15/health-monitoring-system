const express = require("express");
const {
  getCentreAlerts,
  getDdhsAlerts,
  resolveAlertController,
} = require("../controllers/alertController");

const router = express.Router();

router.get("/centre", getCentreAlerts);
router.get("/ddhs", getDdhsAlerts);
router.post("/:id/resolve", resolveAlertController);

module.exports = router;
