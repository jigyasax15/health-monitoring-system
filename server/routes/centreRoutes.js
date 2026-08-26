const express = require("express");
const router = express.Router();
const { getPhcSummary } = require("../controllers/centreController");

router.get("/phc-summary", getPhcSummary);

module.exports = router;
