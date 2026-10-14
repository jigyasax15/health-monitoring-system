const mongoose = require("mongoose");
const LeaveRequest = require("../models/LeaveRequest");
const Doctor = require("../models/Doctor");
const HealthCentre = require("../models/HealthCentre");
const { getTodayDateString } = require("../utils/dateTime");
const { getApplicableHolidays } = require("../utils/workingDays");
const {
  validateLeaveDates,
  calculateWorkingDaysForLeave,
  findOverlappingLeave,
} = require("../services/leaveService");
const { reconcileAlertsForDoctor } = require("../services/alertService");

/**
 * Submit a new leave request (Doctor role only).
 */
const submitLeave = async (req, res) => {
  try {
    const doctorEmail = req.user.email.toLowerCase().trim();

    const doctor = await Doctor.findOne({ email: doctorEmail }).lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const { startDate, endDate, leaveType = "CASUAL", reason } = req.body;

    // 1. Validate reason
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason for leave is required",
      });
    }

    // 2. Validate leaveType
    const validLeaveTypes = ["CASUAL", "SICK", "EARNED", "OTHER"];
    const normalizedLeaveType = (leaveType || "CASUAL").toUpperCase().trim();
    if (!validLeaveTypes.includes(normalizedLeaveType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid leaveType. Allowed values: ${validLeaveTypes.join(", ")}`,
      });
    }

    // 3. Validate dates
    const dateValidation = validateLeaveDates(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json({
        success: false,
        message: dateValidation.error,
      });
    }

    // 4. Calculate working days
    const holidayList = await getApplicableHolidays(
      startDate,
      endDate,
      doctor.healthCentre
    );

    const { workingDaysCount } = calculateWorkingDaysForLeave(
      startDate,
      endDate,
      doctor.healthCentre,
      holidayList
    );

    if (workingDaysCount === 0) {
      return res.status(400).json({
        success: false,
        message:
          "The selected date range contains no scheduled working days (only weekends or holidays).",
      });
    }

    // 5. Overlap check against PENDING / APPROVED leaves
    const overlapping = await findOverlappingLeave(
      doctor.email,
      startDate,
      endDate
    );

    if (overlapping) {
      return res.status(409).json({
        success: false,
        message: `A ${overlapping.status} leave request already exists overlapping this period (${overlapping.startDate} to ${overlapping.endDate}).`,
      });
    }

    // 6. Create leave request
    const newLeave = new LeaveRequest({
      doctorId: doctor._id,
      doctorEmail: doctor.email,
      doctorName: doctor.name,
      healthCentre: doctor.healthCentre,
      department: doctor.department,
      leaveType: normalizedLeaveType,
      startDate,
      endDate,
      reason: reason.trim(),
      status: "PENDING",
      numberOfWorkingDays: workingDaysCount,
      submittedAt: new Date(),
      actions: [
        {
          action: "SUBMITTED",
          performedBy: doctor.email,
          role: "doctor",
          note: reason.trim(),
          timestamp: new Date(),
        },
      ],
    });

    const savedLeave = await newLeave.save();

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      leave: savedLeave,
    });
  } catch (error) {
    console.error("submitLeave error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get own leave requests (Doctor role).
 */
const getMyLeaves = async (req, res) => {
  try {
    const doctorEmail = req.user.email.toLowerCase().trim();
    const { status, leaveType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = { doctorEmail };

    if (status && status.trim()) {
      query.status = status.toUpperCase().trim();
    }
    if (leaveType && leaveType.trim()) {
      query.leaveType = leaveType.toUpperCase().trim();
    }
    if (startDate && startDate.trim()) {
      query.endDate = { $gte: startDate.trim() };
    }
    if (endDate && endDate.trim()) {
      query.startDate = { $lte: endDate.trim() };
    }

    const totalItems = await LeaveRequest.countDocuments(query);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const leaves = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean();

    res.json({
      success: true,
      leaves,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error("getMyLeaves error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get leave requests for Centre Admin's health centre.
 */
const getCentreLeaves = async (req, res) => {
  try {
    const healthCentre = req.user.healthCentre;
    if (!healthCentre) {
      return res.status(403).json({
        success: false,
        message: "No health centre assigned to this administrator account",
      });
    }

    const {
      status,
      leaveType,
      doctorEmail,
      department,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = { healthCentre };

    if (status && status.trim()) {
      query.status = status.toUpperCase().trim();
    }
    if (leaveType && leaveType.trim()) {
      query.leaveType = leaveType.toUpperCase().trim();
    }
    if (doctorEmail && doctorEmail.trim()) {
      query.doctorEmail = doctorEmail.toLowerCase().trim();
    }
    if (department && department.trim()) {
      query.department = department.trim();
    }
    if (startDate && startDate.trim()) {
      query.endDate = { $gte: startDate.trim() };
    }
    if (endDate && endDate.trim()) {
      query.startDate = { $lte: endDate.trim() };
    }

    const totalItems = await LeaveRequest.countDocuments(query);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const leaves = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean();

    res.json({
      success: true,
      leaves,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error("getCentreLeaves error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get division-wide leave requests for DDHS (Supervisory Read-Only).
 */
const getDdhsLeaves = async (req, res) => {
  try {
    const {
      healthCentre,
      status,
      leaveType,
      doctorEmail,
      department,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};

    if (healthCentre && healthCentre.trim()) {
      query.healthCentre = healthCentre.trim();
    }
    if (status && status.trim()) {
      query.status = status.toUpperCase().trim();
    }
    if (leaveType && leaveType.trim()) {
      query.leaveType = leaveType.toUpperCase().trim();
    }
    if (doctorEmail && doctorEmail.trim()) {
      query.doctorEmail = doctorEmail.toLowerCase().trim();
    }
    if (department && department.trim()) {
      query.department = department.trim();
    }
    if (startDate && startDate.trim()) {
      query.endDate = { $gte: startDate.trim() };
    }
    if (endDate && endDate.trim()) {
      query.startDate = { $lte: endDate.trim() };
    }

    const totalItems = await LeaveRequest.countDocuments(query);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const leaves = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean();

    res.json({
      success: true,
      leaves,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error("getDdhsLeaves error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get leave summary counts (Pending, Approved, Rejected, Doctors on leave today).
 */
const getLeaveSummary = async (req, res) => {
  try {
    const query = {};

    if (req.user.role === "centre-admin") {
      if (!req.user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "No health centre assigned to this administrator account",
        });
      }
      query.healthCentre = req.user.healthCentre;
    } else if (req.user.role === "ddhs") {
      if (req.query.healthCentre && req.query.healthCentre.trim()) {
        query.healthCentre = req.query.healthCentre.trim();
      }
    } else if (req.user.role === "doctor") {
      query.doctorEmail = req.user.email.toLowerCase().trim();
    }

    const todayStr = getTodayDateString();

    const [pending, approved, rejected, cancelled, total, onLeaveToday] =
      await Promise.all([
        LeaveRequest.countDocuments({ ...query, status: "PENDING" }),
        LeaveRequest.countDocuments({ ...query, status: "APPROVED" }),
        LeaveRequest.countDocuments({ ...query, status: "REJECTED" }),
        LeaveRequest.countDocuments({ ...query, status: "CANCELLED" }),
        LeaveRequest.countDocuments(query),
        LeaveRequest.countDocuments({
          ...query,
          status: "APPROVED",
          startDate: { $lte: todayStr },
          endDate: { $gte: todayStr },
        }),
      ]);

    res.json({
      success: true,
      summary: {
        pending,
        approved,
        rejected,
        cancelled,
        total,
        onLeaveToday,
      },
    });
  } catch (error) {
    console.error("getLeaveSummary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get single leave request by ID.
 */
const getLeaveById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID",
      });
    }

    const leave = await LeaveRequest.findById(id).lean();
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    // Role-based access enforcement
    if (
      req.user.role === "doctor" &&
      leave.doctorEmail !== req.user.email.toLowerCase().trim()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot view another doctor's leave request",
      });
    }

    if (
      req.user.role === "centre-admin" &&
      leave.healthCentre !== req.user.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: leave request belongs to another health centre",
      });
    }

    res.json({
      success: true,
      leave,
    });
  } catch (error) {
    console.error("getLeaveById error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Approve a PENDING leave request (Centre Admin only).
 */
const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID",
      });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    // Centre isolation
    if (leave.healthCentre !== req.user.healthCentre) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot approve leave for another health centre",
      });
    }

    // State machine: Only PENDING -> APPROVED allowed
    if (leave.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: `Cannot approve leave request with status '${leave.status}'. Only PENDING requests can be approved.`,
      });
    }

    const noteText = reviewNote && reviewNote.trim() ? reviewNote.trim() : "Approved by Centre Admin";

    leave.status = "APPROVED";
    leave.reviewedBy = req.user.email;
    leave.reviewedAt = new Date();
    leave.reviewNote = noteText;
    leave.actions.push({
      action: "APPROVED",
      performedBy: req.user.email,
      role: "centre-admin",
      note: noteText,
      timestamp: new Date(),
    });

    await leave.save();

    // Reconcile active alerts non-destructively if leave touches past/current days
    await reconcileAlertsForDoctor(leave.doctorEmail, leave.healthCentre);

    res.json({
      success: true,
      message: "Leave request approved successfully",
      leave,
    });
  } catch (error) {
    console.error("approveLeave error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Reject a PENDING leave request (Centre Admin only).
 */
const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID",
      });
    }

    // Review note is strictly REQUIRED for rejection (User Correction 4)
    if (!reviewNote || typeof reviewNote !== "string" || !reviewNote.trim()) {
      return res.status(400).json({
        success: false,
        message: "Review note is required when rejecting a leave request",
      });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    // Centre isolation
    if (leave.healthCentre !== req.user.healthCentre) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot reject leave for another health centre",
      });
    }

    // State machine: Only PENDING -> REJECTED allowed
    if (leave.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: `Cannot reject leave request with status '${leave.status}'. Only PENDING requests can be rejected.`,
      });
    }

    leave.status = "REJECTED";
    leave.reviewedBy = req.user.email;
    leave.reviewedAt = new Date();
    leave.reviewNote = reviewNote.trim();
    leave.actions.push({
      action: "REJECTED",
      performedBy: req.user.email,
      role: "centre-admin",
      note: reviewNote.trim(),
      timestamp: new Date(),
    });

    await leave.save();

    res.json({
      success: true,
      message: "Leave request rejected successfully",
      leave,
    });
  } catch (error) {
    console.error("rejectLeave error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Cancel a PENDING leave request (Doctor or Centre Admin).
 */
const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID",
      });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    // Role check
    if (
      req.user.role === "doctor" &&
      leave.doctorEmail !== req.user.email.toLowerCase().trim()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot cancel another doctor's leave request",
      });
    }

    if (
      req.user.role === "centre-admin" &&
      leave.healthCentre !== req.user.healthCentre
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: cannot cancel leave for another health centre",
      });
    }

    // State machine (User Correction 2): Only PENDING -> CANCELLED allowed
    if (leave.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: `Cannot cancel leave request with status '${leave.status}'. Only PENDING leave requests can be cancelled.`,
      });
    }

    const cancelNote = reason && reason.trim() ? reason.trim() : "Leave request cancelled";

    leave.status = "CANCELLED";
    leave.cancelledAt = new Date();
    leave.actions.push({
      action: "CANCELLED",
      performedBy: req.user.email,
      role: req.user.role,
      note: cancelNote,
      timestamp: new Date(),
    });

    await leave.save();

    res.json({
      success: true,
      message: "Leave request cancelled successfully",
      leave,
    });
  } catch (error) {
    console.error("cancelLeave error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  submitLeave,
  getMyLeaves,
  getCentreLeaves,
  getDdhsLeaves,
  getLeaveSummary,
  getLeaveById,
  approveLeave,
  rejectLeave,
  cancelLeave,
};
