const express = require("express");
const router = express.Router();
const {
  createDoctor,
  getAllDoctors,
  getDoctorByEmail,
} = require("../controllers/doctorController");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// All doctor endpoints require authentication
router.use(authenticate);

router.post("/", authorizeRoles("centre-admin", "ddhs"), createDoctor);
router.get("/", authorizeRoles("centre-admin", "ddhs"), getAllDoctors);
router.get(
  "/email/:email",
  authorizeRoles("doctor", "centre-admin", "ddhs"),
  getDoctorByEmail
);

module.exports = router;
