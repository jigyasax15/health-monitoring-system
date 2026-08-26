const express = require("express");
const { getDdhsOverview } = require("../controllers/ddhsController");
const { getDdhsAlerts } = require("../controllers/alertController");

const router = express.Router();

router.get("/overview", getDdhsOverview);
router.get("/alerts", getDdhsAlerts);

module.exports = router;
