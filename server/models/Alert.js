const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    doctorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    healthCentre: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "ABSENT_TODAY",
        "CONSECUTIVE_ABSENCE_2_DAYS",
        "CONSECUTIVE_ABSENCE_3_PLUS_DAYS",
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ["medium", "high", "critical"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    consecutiveDays: {
      type: Number,
      default: 1,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate alerts for the same doctor + date + type
alertSchema.index({ doctorEmail: 1, date: 1, type: 1 }, { unique: true });

const Alert = mongoose.model("Alert", alertSchema);

module.exports = Alert;
