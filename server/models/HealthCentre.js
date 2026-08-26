const mongoose = require("mongoose");

const healthCentreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["PHC", "Upgraded PHC", "Sub-Centre"],
      required: true,
    },

    district: {
      type: String,
      required: true,
    },

    division: {
      type: String,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const HealthCentre = mongoose.model(
  "HealthCentre",
  healthCentreSchema
);

module.exports = HealthCentre;