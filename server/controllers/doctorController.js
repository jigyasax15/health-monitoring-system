const Doctor = require("../models/Doctor");

// Create a new doctor
const createDoctor = async (req, res) => {
  try {
    const { name, email, department, healthCentre } = req.body;

    if (!name || !email || !department || !healthCentre) {
      return res.status(400).json({
        success: false,
        message: "All doctor fields are required",
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
      name,
      email: normalizedEmail,
      department,
      healthCentre,
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all doctors
const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find()
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get one doctor by email
const getDoctorByEmail = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();

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

    res.json({
      success: true,
      doctor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorByEmail,
};
