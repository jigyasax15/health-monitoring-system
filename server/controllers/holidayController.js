const Holiday = require("../models/Holiday");
const HealthCentre = require("../models/HealthCentre");
const { isValidDateString } = require("../services/reportService");

const VALID_TYPES = ["PUBLIC", "STATE", "LOCAL", "SPECIAL"];
const VALID_SCOPES = ["DISTRICT", "CENTRE"];

// GET /api/holidays
const getHolidays = async (req, res) => {
  try {
    const { user } = req;
    const { startDate, endDate, centre, type, scope } = req.query;

    const query = { active: true };

    if (startDate && isValidDateString(startDate)) {
      query.date = query.date || {};
      query.date.$gte = startDate;
    }
    if (endDate && isValidDateString(endDate)) {
      query.date = query.date || {};
      query.date.$lte = endDate;
    }

    if (type && VALID_TYPES.includes(type.toUpperCase())) {
      query.type = type.toUpperCase();
    }

    if (scope && VALID_SCOPES.includes(scope.toUpperCase())) {
      query.scope = scope.toUpperCase();
    }

    // Role-based scoping
    if (user.role === "doctor") {
      // Doctor can only view DISTRICT holidays and their assigned health centre's holidays
      const userCentre = user.healthCentre || "";
      query.$or = [
        { scope: "DISTRICT" },
        { scope: "CENTRE", healthCentre: userCentre },
        { healthCentre: null },
      ];
    } else if (user.role === "centre-admin") {
      // Centre admin can only view DISTRICT holidays and their assigned centre's holidays
      if (!user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "No health centre assigned to this administrator account",
        });
      }
      query.$or = [
        { scope: "DISTRICT" },
        { scope: "CENTRE", healthCentre: user.healthCentre },
        { healthCentre: null },
      ];
    } else if (user.role === "ddhs") {
      // DDHS can view all or filter by specific centre
      if (centre && centre.trim()) {
        query.$or = [
          { scope: "DISTRICT" },
          { scope: "CENTRE", healthCentre: centre.trim() },
        ];
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const holidays = await Holiday.find(query).sort({ date: 1 }).lean();

    return res.json({
      success: true,
      count: holidays.length,
      holidays,
    });
  } catch (error) {
    console.error("getHolidays error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/holidays
const createHoliday = async (req, res) => {
  try {
    const { user } = req;
    const { name, date, type = "PUBLIC", scope = "DISTRICT", healthCentre, district, description } = req.body;

    // Doctor cannot create holidays
    if (user.role === "doctor") {
      return res.status(403).json({
        success: false,
        message: "Access denied: doctors cannot create holidays",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Holiday name is required",
      });
    }

    if (!date || !isValidDateString(date.trim())) {
      return res.status(400).json({
        success: false,
        message: "Valid holiday date (YYYY-MM-DD) is required",
      });
    }

    const normalizedType = (type || "PUBLIC").toUpperCase().trim();
    if (!VALID_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid holiday type. Must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    const normalizedScope = (scope || "DISTRICT").toUpperCase().trim();
    if (!VALID_SCOPES.includes(normalizedScope)) {
      return res.status(400).json({
        success: false,
        message: `Invalid holiday scope. Must be one of: ${VALID_SCOPES.join(", ")}`,
      });
    }

    let targetCentre = null;

    if (user.role === "centre-admin") {
      // Centre admin can ONLY create CENTRE scope holidays for their assigned health centre
      if (normalizedScope !== "CENTRE") {
        return res.status(403).json({
          success: false,
          message: "Access denied: centre admins can only create CENTRE scope holidays",
        });
      }

      if (!user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "No health centre assigned to this administrator account",
        });
      }

      targetCentre = user.healthCentre;
    } else if (user.role === "ddhs") {
      if (normalizedScope === "CENTRE") {
        if (!healthCentre || !healthCentre.trim()) {
          return res.status(400).json({
            success: false,
            message: "healthCentre is required when scope is CENTRE",
          });
        }

        const centreDoc = await HealthCentre.findOne({ name: healthCentre.trim() }).lean();
        if (!centreDoc) {
          return res.status(404).json({
            success: false,
            message: "Specified health centre does not exist",
          });
        }
        targetCentre = centreDoc.name;
      } else {
        targetCentre = null;
      }
    }

    const holidayDate = date.trim();

    // Check for duplicate holiday with the same date, scope, and healthCentre
    const duplicateQuery = {
      date: holidayDate,
      scope: normalizedScope,
      healthCentre: targetCentre,
      active: true,
    };

    const existingHoliday = await Holiday.findOne(duplicateQuery).lean();
    if (existingHoliday) {
      return res.status(409).json({
        success: false,
        message: `A holiday on ${holidayDate} already exists for the specified scope`,
      });
    }

    const holiday = new Holiday({
      name: name.trim(),
      date: holidayDate,
      type: normalizedType,
      scope: normalizedScope,
      healthCentre: targetCentre,
      district: district ? district.trim() : null,
      description: description ? description.trim() : "",
      createdBy: user.email,
      active: true,
    });

    const savedHoliday = await holiday.save();

    return res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      holiday: savedHoliday,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A holiday for this date and scope already exists",
      });
    }

    console.error("createHoliday error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PATCH /api/holidays/:id
const updateHoliday = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (user.role === "doctor") {
      return res.status(403).json({
        success: false,
        message: "Access denied: doctors cannot modify holidays",
      });
    }

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    if (user.role === "centre-admin") {
      if (holiday.scope !== "CENTRE" || holiday.healthCentre !== user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "Access denied: you can only update holidays for your assigned centre",
        });
      }
    }

    const { name, date, type, description, active } = req.body;

    if (name !== undefined) holiday.name = name.trim();
    if (date !== undefined) {
      if (!isValidDateString(date.trim())) {
        return res.status(400).json({
          success: false,
          message: "Valid holiday date (YYYY-MM-DD) is required",
        });
      }
      holiday.date = date.trim();
    }
    if (type !== undefined) {
      const normalizedType = type.toUpperCase().trim();
      if (!VALID_TYPES.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid holiday type. Must be one of: ${VALID_TYPES.join(", ")}`,
        });
      }
      holiday.type = normalizedType;
    }
    if (description !== undefined) holiday.description = description.trim();
    if (active !== undefined) holiday.active = Boolean(active);

    const updatedHoliday = await holiday.save();

    return res.json({
      success: true,
      message: "Holiday updated successfully",
      holiday: updatedHoliday,
    });
  } catch (error) {
    console.error("updateHoliday error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE /api/holidays/:id
const deleteHoliday = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (user.role === "doctor") {
      return res.status(403).json({
        success: false,
        message: "Access denied: doctors cannot delete holidays",
      });
    }

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    if (user.role === "centre-admin") {
      if (holiday.scope !== "CENTRE" || holiday.healthCentre !== user.healthCentre) {
        return res.status(403).json({
          success: false,
          message: "Access denied: you can only delete holidays for your assigned health centre",
        });
      }
    }

    await Holiday.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Holiday deleted successfully",
    });
  } catch (error) {
    console.error("deleteHoliday error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
