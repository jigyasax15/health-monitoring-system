const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    doctorEmail: {
      type: String,
      required: true,
    },

    doctorName: {
      type: String,
      required: true,
    },

    healthCentre: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Present", "Absent"],
      default: "Present",
    },

    date: {
      type: String,
      required: true,
    },

    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;