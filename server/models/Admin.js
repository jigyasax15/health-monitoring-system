const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
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

    role: {
      type: String,
      enum: ["centre-admin", "ddhs"],
      required: true,
    },

    healthCentre: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;