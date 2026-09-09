const express = require("express");
const bcrypt = require("bcryptjs");
const Doctor = require("../models/Doctor");
const Admin = require("../models/Admin");
const HealthCentre = require("../models/HealthCentre");

const router = express.Router();

// Guard middleware to disable dev routes in production
router.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "Development setup routes are disabled in production environment",
    });
  }
  next();
});

// Setup Dr. A Sharma
router.get("/add-test-doctor", async (req, res) => {
  try {
    const existingDoctor = await Doctor.findOne({
      email: "doctor@test.com",
    }).select("-password");

    if (existingDoctor) {
      return res.json({
        success: true,
        message: "Test doctor already exists",
        doctor: existingDoctor,
      });
    }

    const doctor = new Doctor({
      name: "Dr. A Sharma",
      email: "doctor@test.com",
      department: "General Medicine",
      healthCentre: "PHC Mathura",
      password: await bcrypt.hash("Doctor123", 10),
    });

    const savedDoctor = await doctor.save();
    const doctorObj = savedDoctor.toObject();
    delete doctorObj.password;

    res.status(201).json({
      success: true,
      message: "Test doctor added successfully",
      doctor: doctorObj,
    });
  } catch (error) {
    console.error("add-test-doctor error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Setup remaining doctors
router.get("/add-test-doctors", async (req, res) => {
  try {
    const testDoctors = [
      {
        name: "Dr. R Verma",
        email: "verma@test.com",
        password: "Verma123",
        department: "Pediatrics",
        healthCentre: "PHC Mathura",
      },
      {
        name: "Dr. S Singh",
        email: "singh@test.com",
        password: "Singh123",
        department: "General Medicine",
        healthCentre: "PHC Mathura",
      },
      {
        name: "Dr. P Mehta",
        email: "mehta@test.com",
        password: "Mehta123",
        department: "Gynecology",
        healthCentre: "PHC Mathura",
      },
    ];

    const addedDoctors = [];

    for (const doctorData of testDoctors) {
      const existingDoctor = await Doctor.findOne({
        email: doctorData.email,
      });

      if (!existingDoctor) {
        const hashedPassword = await bcrypt.hash(doctorData.password, 10);

        const doctor = new Doctor({
          name: doctorData.name,
          email: doctorData.email,
          password: hashedPassword,
          department: doctorData.department,
          healthCentre: doctorData.healthCentre,
        });

        const savedDoctor = await doctor.save();
        addedDoctors.push(savedDoctor.email);
      }
    }

    res.json({
      success: true,
      message: "Test doctors setup completed",
      added: addedDoctors.length,
      doctors: addedDoctors,
    });
  } catch (error) {
    console.error("add-test-doctors error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Setup doctor passwords for existing records
router.get("/setup-test-passwords", async (req, res) => {
  try {
    const testAccounts = [
      {
        email: "doctor@test.com",
        password: "Doctor123",
      },
      {
        email: "verma@test.com",
        password: "Verma123",
      },
      {
        email: "singh@test.com",
        password: "Singh123",
      },
      {
        email: "mehta@test.com",
        password: "Mehta123",
      },
    ];

    const updated = [];

    for (const account of testAccounts) {
      const doctor = await Doctor.findOne({
        email: account.email,
      });

      if (!doctor) {
        continue;
      }

      doctor.password = await bcrypt.hash(account.password, 10);
      await doctor.save();
      updated.push(account.email);
    }

    res.json({
      success: true,
      message: "Test passwords configured",
      updated,
    });
  } catch (error) {
    console.error("setup-test-passwords error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Setup admin accounts
router.get("/setup-test-admins", async (req, res) => {
  try {
    const testAdmins = [
      {
        name: "PHC Mathura Admin",
        email: "phcadmin@test.com",
        password: "Admin123",
        role: "centre-admin",
        healthCentre: "PHC Mathura",
      },
      {
        name: "DDHS Admin",
        email: "ddhs@test.com",
        password: "Ddhs123",
        role: "ddhs",
        healthCentre: null,
      },
    ];

    const created = [];

    for (const adminData of testAdmins) {
      const existingAdmin = await Admin.findOne({
        email: adminData.email,
      });

      if (existingAdmin) {
        continue;
      }

      const hashedPassword = await bcrypt.hash(adminData.password, 10);

      const admin = new Admin({
        name: adminData.name,
        email: adminData.email,
        password: hashedPassword,
        role: adminData.role,
        healthCentre: adminData.healthCentre,
      });

      const savedAdmin = await admin.save();
      created.push(savedAdmin.email);
    }

    res.json({
      success: true,
      message: "Test admin accounts configured",
      created,
    });
  } catch (error) {
    console.error("setup-test-admins error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Setup health centres
router.get("/setup-test-centres", async (req, res) => {
  try {
    const testCentres = [
      {
        name: "PHC Mathura",
        type: "PHC",
        district: "Mathura",
        division: "Agra",
      },
      {
        name: "PHC Vrindavan",
        type: "PHC",
        district: "Mathura",
        division: "Agra",
      },
      {
        name: "Upgraded PHC Govardhan",
        type: "Upgraded PHC",
        district: "Mathura",
        division: "Agra",
      },
      {
        name: "Sub-Centre Raya",
        type: "Sub-Centre",
        district: "Mathura",
        division: "Agra",
      },
    ];

    const created = [];

    for (const centreData of testCentres) {
      const existingCentre = await HealthCentre.findOne({
        name: centreData.name,
      });

      if (!existingCentre) {
        const centre = new HealthCentre(centreData);
        const savedCentre = await centre.save();
        created.push(savedCentre.name);
      }
    }

    res.json({
      success: true,
      message: "Test health centres configured",
      created,
    });
  } catch (error) {
    console.error("setup-test-centres error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
