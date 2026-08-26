const express = require("express");
const { getDdhsOverview } = require("../controllers/ddhsController");

const router = express.Router();

router.get("/overview", getDdhsOverview);

module.exports = router;
