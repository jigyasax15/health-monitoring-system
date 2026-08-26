const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    department: {
      type: String,
      required: true,
    },

    healthCentre: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      default: "doctor",
    },
  },
  {
    timestamps: true,
  }
);

const Doctor = mongoose.model("Doctor", doctorSchema);

module.exports = Doctor;