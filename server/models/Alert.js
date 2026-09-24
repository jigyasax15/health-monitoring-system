const mongoose = require("mongoose");

const actionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "CREATED",
        "ACKNOWLEDGED",
        "NOTE_ADDED",
        "RESOLVED",
        "ESCALATED",
        "STREAK_UPDATED",
      ],
      required: true,
    },
    performedBy: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["system", "centre-admin", "ddhs", "doctor"],
      default: "system",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

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
      enum: ["low", "medium", "high", "critical", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
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
    status: {
      type: String,
      enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
      default: "ACTIVE",
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: String,
      default: null,
      trim: true,
    },
    resolutionNote: {
      type: String,
      default: null,
      trim: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: String,
      default: null,
      trim: true,
    },
    latestActionNote: {
      type: String,
      default: null,
      trim: true,
    },
    isEscalated: {
      type: Boolean,
      default: false,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    actions: {
      type: [actionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high-performance role-scoped querying & filtering
alertSchema.index({ healthCentre: 1, status: 1 });
alertSchema.index({ doctorEmail: 1, status: 1 });
alertSchema.index({ status: 1, severity: 1 });
alertSchema.index({ createdAt: -1 });

const Alert = mongoose.model("Alert", alertSchema);

module.exports = Alert;
