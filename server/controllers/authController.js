const bcrypt = require("bcryptjs");
const Doctor = require("../models/Doctor");
const Admin = require("../models/Admin");

// Handle user login across roles (doctor, centre-admin, ddhs)
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, password and role are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user;

    if (role === "doctor") {
      user = await Doctor.findOne({
        email: normalizedEmail,
      });
    } else if (role === "centre-admin" || role === "ddhs") {
      user = await Admin.findOne({
        email: normalizedEmail,
        role,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email, password or role",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email, password or role",
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || null,
        healthCentre: user.healthCentre || null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  login,
};
