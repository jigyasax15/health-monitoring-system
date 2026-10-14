const mongoose = require("mongoose");

const actionAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"],
      required: true,
    },
    performedBy: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["doctor", "centre-admin", "ddhs", "system"],
      required: true,
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

const leaveRequestSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
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
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    leaveType: {
      type: String,
      enum: ["CASUAL", "SICK", "EARNED", "OTHER"],
      required: true,
      default: "CASUAL",
    },
    startDate: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true,
    },
    endDate: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
    numberOfWorkingDays: {
      type: Number,
      required: true,
      min: 1,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: String,
      default: null,
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      default: null,
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    actions: {
      type: [actionAuditSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// High-performance query indexes
leaveRequestSchema.index({ doctorEmail: 1, status: 1 });
leaveRequestSchema.index({ healthCentre: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });
leaveRequestSchema.index({ doctorEmail: 1, startDate: 1, endDate: 1 });

const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);

module.exports = LeaveRequest;
