const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const centreRoutes = require("./routes/centreRoutes");
const ddhsRoutes = require("./routes/ddhsRoutes");
const alertRoutes = require("./routes/alertRoutes");
const devRoutes = require("./routes/devRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");

// --------------------
// Middleware
// --------------------
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// --------------------
// Basic / Health Routes
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
// API Route Mounting
// --------------------
app.use("/api", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api", centreRoutes);
app.use("/api/ddhs", ddhsRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api", devRoutes);

// --------------------
// 404 Route Handler
// --------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// --------------------
// Database & Server Start
// --------------------
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();