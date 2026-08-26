const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const Doctor = require("./models/Doctor");
const Attendance = require("./models/Attendance");
const Admin = require("./models/Admin");
const HealthCentre = require("./models/HealthCentre");

const app = express();
const PORT = process.env.PORT || 5000;

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// Basic Routes
// --------------------
app.get("/", (req, res) => {
  res.send("Health Monitoring Backend is running");
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Frontend successfully connected to backend",
  });
});

// --------------------
// Doctor Routes
// --------------------

// Create a doctor
app.post("/api/doctors", async (req, res) => {
  try {
    const {
      name,
      email,
      department,
      healthCentre,
    } = req.body;

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

    res.status(201).json({
      success: true,
      message: "Doctor added successfully",
      doctor: savedDoctor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get all doctors
app.get("/api/doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({
      name: 1,
    });

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
});

// Get one doctor by email
app.get("/api/doctors/email/:email", async (req, res) => {
  try {
    const email = req.params.email
      .toLowerCase()
      .trim();

    const doctor = await Doctor.findOne({
      email,
    });

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
});

// --------------------
// Authentication
// --------------------

app.post("/api/login", async (req, res) => {
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
    } else if (
      role === "centre-admin" ||
      role === "ddhs"
    ) {
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

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

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
});

// --------------------
// Attendance Routes
// --------------------

// Mark attendance
app.post("/api/attendance", async (req, res) => {
  try {
    const {
      doctorEmail,
      doctorName,
      healthCentre,
    } = req.body;

    if (!doctorEmail || !doctorName || !healthCentre) {
      return res.status(400).json({
        success: false,
        message: "Doctor attendance information is incomplete",
      });
    }

    const normalizedEmail = doctorEmail
      .toLowerCase()
      .trim();

    const doctor = await Doctor.findOne({
      email: normalizedEmail,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const existingAttendance =
      await Attendance.findOne({
        doctorEmail: normalizedEmail,
        date: today,
      });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked today",
      });
    }

    const attendance = new Attendance({
      doctorEmail: normalizedEmail,
      doctorName: doctor.name,
      healthCentre: doctor.healthCentre,
      status: "Present",
      date: today,
    });

    const savedAttendance =
      await attendance.save();

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      attendance: savedAttendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get all attendance records
app.get("/api/attendance", async (req, res) => {
  try {
    const records =
      await Attendance.find().sort({
        createdAt: -1,
      });

    res.json({
      success: true,
      count: records.length,
      attendance: records,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get today's attendance for one doctor
app.get("/api/attendance/today/:email", async (req, res) => {
  try {
    const email = req.params.email
      .toLowerCase()
      .trim();

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const attendance = await Attendance.findOne({
      doctorEmail: email,
      date: today,
    });

    if (!attendance) {
      return res.json({
        success: true,
        marked: false,
        status: "Not Marked",
      });
    }

    res.json({
      success: true,
      marked: true,
      status: attendance.status,
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// --------------------
// PHC Admin Summary
// --------------------

app.get("/api/phc-summary", async (req, res) => {
  try {
    const healthCentre = "PHC Mathura";

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const doctors = await Doctor.find({
      healthCentre,
    });

    const attendanceRecords =
      await Attendance.find({
        healthCentre,
        date: today,
      });

    const doctorData = doctors.map((doctor) => {
      const attendance =
        attendanceRecords.find(
          (record) =>
            record.doctorEmail === doctor.email
        );

      return {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        department: doctor.department,
        healthCentre: doctor.healthCentre,
        status: attendance
          ? attendance.status
          : "Not Marked",
      };
    });

    const present = doctorData.filter(
      (doctor) => doctor.status === "Present"
    ).length;

    const absent = doctorData.filter(
      (doctor) => doctor.status === "Absent"
    ).length;

    const notMarked = doctorData.filter(
      (doctor) => doctor.status === "Not Marked"
    ).length;

    res.json({
      success: true,
      healthCentre,
      date: today,
      totalDoctors: doctorData.length,
      present,
      absent,
      notMarked,
      doctors: doctorData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// --------------------
// Temporary Development Setup Routes
// --------------------

// Setup Dr. A Sharma
app.get("/api/add-test-doctor", async (req, res) => {
  try {
    const existingDoctor = await Doctor.findOne({
      email: "doctor@test.com",
    });

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

    res.status(201).json({
      success: true,
      message: "Test doctor added successfully",
      doctor: savedDoctor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Setup remaining doctors
app.get("/api/add-test-doctors", async (req, res) => {
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
        const hashedPassword = await bcrypt.hash(
          doctorData.password,
          10
        );

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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Setup doctor passwords for existing records
app.get("/api/setup-test-passwords", async (req, res) => {
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

      doctor.password = await bcrypt.hash(
        account.password,
        10
      );

      await doctor.save();

      updated.push(account.email);
    }

    res.json({
      success: true,
      message: "Test passwords configured",
      updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Setup admin accounts
app.get("/api/setup-test-admins", async (req, res) => {
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

      const hashedPassword = await bcrypt.hash(
        adminData.password,
        10
      );

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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// NEW: Setup health centres
app.get("/api/setup-test-centres", async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// --------------------
// 404 Route
// --------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// --------------------
// MongoDB + Server Start
// --------------------
async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI,
      {
        family: 4,
      }
    );

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
}

startServer();