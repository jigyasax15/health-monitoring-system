const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    doctorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    doctorName: {
      type: String,
      required: true,
      trim: true,
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

// Compound unique index to prevent duplicate attendance on the same date
attendanceSchema.index({ doctorEmail: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model(
  "Attendance",
  attendanceSchema
);

module.exports = Attendance;