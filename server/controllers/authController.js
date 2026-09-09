const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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

    // Create signed JWT
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        healthCentre: user.healthCentre || null,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    // Store JWT in an httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
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
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Return the authenticated user's safe profile
const getMe = async (req, res) => {
  try {
    const { id, role } = req.user;

    let user;
    if (role === "doctor") {
      user = await Doctor.findById(id).select("-password").lean();
    } else if (role === "centre-admin" || role === "ddhs") {
      user = await Admin.findById(id).select("-password").lean();
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    return res.json({
      success: true,
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
    console.error("GetMe error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Clear the authentication cookie securely
const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  login,
  getMe,
  logout,
};