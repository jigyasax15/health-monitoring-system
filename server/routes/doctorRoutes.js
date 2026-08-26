const express = require("express");
const router = express.Router();
const {
  createDoctor,
  getAllDoctors,
  getDoctorByEmail,
} = require("../controllers/doctorController");

router.post("/", createDoctor);
router.get("/", getAllDoctors);
router.get("/email/:email", getDoctorByEmail);

module.exports = router;
