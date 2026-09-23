const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
    },

    date: {
      type: String,
      required: [true, "Holiday date is required (YYYY-MM-DD)"],
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Holiday date must be in YYYY-MM-DD format"],
    },

    type: {
      type: String,
      enum: ["PUBLIC", "STATE", "LOCAL", "SPECIAL"],
      default: "PUBLIC",
      uppercase: true,
    },

    scope: {
      type: String,
      enum: ["DISTRICT", "CENTRE"],
      default: "DISTRICT",
      required: [true, "Holiday scope is required (DISTRICT or CENTRE)"],
      uppercase: true,
    },

    healthCentre: {
      type: String,
      default: null,
      trim: true,
    },

    district: {
      type: String,
      default: null,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: String,
      default: null,
      trim: true,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate holidays for the same date + scope + healthCentre
holidaySchema.index(
  { date: 1, scope: 1, healthCentre: 1 },
  { unique: true }
);

const Holiday = mongoose.model("Holiday", holidaySchema);

module.exports = Holiday;
