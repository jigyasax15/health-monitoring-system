const Doctor = require("../models/Doctor");

// Create a new doctor
const createDoctor = async (req, res) => {
  try {
    const { name, email, department, healthCentre } = req.body;

    if (!name || !email || !department) {
      return res.status(400).json({
        success: false,
        message: "Doctor name, email, and department are required",
      });
    }

    // Centre admin can only create doctor for their assigned health centre
    let targetCentre = healthCentre;
    if (req.user.role === "centre-admin") {
      targetCentre = req.user.healthCentre;
    }

    if (!targetCentre) {
      return res.status(400).json({
        success: false,
        message: "Health centre is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingDoctor = await Doctor.findOne({
      email: normalizedEmail,
    });

    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: "Doctor with this email already exists",
      });
    }

    const doctor = new Doctor({
      name: name.trim(),
      email: normalizedEmail,
      department: department.trim(),
      healthCentre: targetCentre.trim(),
    });

    const savedDoctor = await doctor.save();
    const doctorObj = savedDoctor.toObject();
    delete doctorObj.password;

    res.status(201).json({
      success: true,
      message: "Doctor added successfully",
      doctor: doctorObj,
    });
  } catch (error) {
    console.error("createDoctor error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all doctors (filtered by health centre for centre admins)
const getAllDoctors = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "centre-admin") {
      filter.healthCentre = req.user.healthCentre;
    }

    const doctors = await Doctor.find(filter)
      .select("-password")
      .sort({
        name: 1,
      })
      .lean();

    res.json({
      success: true,
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error("getAllDoctors error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get one doctor by email
const getDoctorByEmail = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();

    // Enforce role authorization
    if (req.user.role === "doctor" && req.user.email !== email) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot access another doctor's profile",
      });
    }

    const doctor = await Doctor.findOne({
      email,
    })
      .select("-password")
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    if (
      req.user.role === "centre-admin" &&
      req.user.healthCentre !== doctor.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: doctor belongs to a different health centre",
      });
    }

    res.json({
      success: true,
      doctor,
    });
  } catch (error) {
    console.error("getDoctorByEmail error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorByEmail,
};
