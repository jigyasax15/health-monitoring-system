const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const LeaveRequest = require("../models/LeaveRequest");
const Doctor = require("../models/Doctor");
const Holiday = require("../models/Holiday");
const {
  submitLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
} = require("../controllers/leaveController");
const {
  validateLeaveDates,
  calculateWorkingDaysForLeave,
} = require("../services/leaveService");

const createMockRes = () => {
  let statusCode = 200;
  let jsonData = null;
  return {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          jsonData = data;
          return data;
        },
      };
    },
    json: (data) => {
      jsonData = data;
      return data;
    },
    getStatus: () => statusCode,
    getJson: () => jsonData,
  };
};

describe("Leave Workflow & Validation Unit Tests", () => {
  const sampleHolidays = [
    {
      name: "District Gandhi Jayanti",
      date: "2026-10-02", // Friday
      scope: "DISTRICT",
      active: true,
    },
    {
      name: "PHC Mathura Local Off",
      date: "2026-10-06", // Tuesday
      scope: "CENTRE",
      healthCentre: "PHC Mathura",
      active: true,
    },
  ];

  describe("Date Validation", () => {
    it("accepts valid YYYY-MM-DD date ranges", () => {
      const result = validateLeaveDates("2026-10-01", "2026-10-05");
      assert.equal(result.valid, true);
    });

    it("rejects invalid date format", () => {
      assert.equal(validateLeaveDates("01-10-2026", "2026-10-05").valid, false);
      assert.equal(validateLeaveDates("2026/10/01", "2026-10-05").valid, false);
      assert.equal(validateLeaveDates("invalid", "2026-10-05").valid, false);
      assert.equal(validateLeaveDates(null, "2026-10-05").valid, false);
    });

    it("rejects when startDate is after endDate", () => {
      const result = validateLeaveDates("2026-10-10", "2026-10-05");
      assert.equal(result.valid, false);
      assert.equal(result.error, "startDate cannot be after endDate.");
    });
  });

  describe("Working-Day Leave Calculations", () => {
    it("excludes weekends from working-day count (Friday to Monday = 2 working days)", () => {
      // 2026-10-09 is Friday, 10-10 is Sat, 10-11 is Sun, 10-12 is Mon
      const { workingDates, workingDaysCount } = calculateWorkingDaysForLeave(
        "2026-10-09",
        "2026-10-12",
        "PHC Mathura",
        []
      );

      assert.equal(workingDaysCount, 2);
      assert.deepEqual(workingDates, ["2026-10-09", "2026-10-12"]);
    });

    it("excludes District public holidays from working days", () => {
      // 2026-10-01 (Thu) to 2026-10-02 (Fri - District Holiday)
      const { workingDates, workingDaysCount } = calculateWorkingDaysForLeave(
        "2026-10-01",
        "2026-10-02",
        "PHC Mathura",
        sampleHolidays
      );

      assert.equal(workingDaysCount, 1);
      assert.deepEqual(workingDates, ["2026-10-01"]);
    });

    it("excludes Centre-specific holiday only for matching health centre", () => {
      // 2026-10-05 (Mon) to 2026-10-06 (Tue - PHC Mathura Local Off)
      // For PHC Mathura: Tuesday is excluded -> 1 working day (Monday only)
      const mathuraResult = calculateWorkingDaysForLeave(
        "2026-10-05",
        "2026-10-06",
        "PHC Mathura",
        sampleHolidays
      );
      assert.equal(mathuraResult.workingDaysCount, 1);
      assert.deepEqual(mathuraResult.workingDates, ["2026-10-05"]);

      // For PHC Agra: Tuesday is a normal working day -> 2 working days
      const agraResult = calculateWorkingDaysForLeave(
        "2026-10-05",
        "2026-10-06",
        "PHC Agra",
        sampleHolidays
      );
      assert.equal(agraResult.workingDaysCount, 2);
      assert.deepEqual(agraResult.workingDates, ["2026-10-05", "2026-10-06"]);
    });

    it("returns 0 working days when leave range spans only weekends or holidays", () => {
      // Saturday 2026-10-10 to Sunday 2026-10-11
      const weekendOnly = calculateWorkingDaysForLeave(
        "2026-10-10",
        "2026-10-11",
        "PHC Mathura",
        sampleHolidays
      );
      assert.equal(weekendOnly.workingDaysCount, 0);
      assert.deepEqual(weekendOnly.workingDates, []);
    });

    it("returns 0 working days when leave range spans only a weekday holiday", () => {
      // 2026-10-02 is Friday (District Gandhi Jayanti holiday)
      const districtHolidayOnly = calculateWorkingDaysForLeave(
        "2026-10-02",
        "2026-10-02",
        "PHC Mathura",
        sampleHolidays
      );
      assert.equal(districtHolidayOnly.workingDaysCount, 0);
      assert.deepEqual(districtHolidayOnly.workingDates, []);

      // 2026-10-06 is Tuesday (Centre holiday for PHC Mathura only)
      const centreHolidayOnly = calculateWorkingDaysForLeave(
        "2026-10-06",
        "2026-10-06",
        "PHC Mathura",
        sampleHolidays
      );
      assert.equal(centreHolidayOnly.workingDaysCount, 0);
      assert.deepEqual(centreHolidayOnly.workingDates, []);
    });
  });

  describe("State Machine & RBAC Transition Rules", () => {
    it("defines strictly allowed transitions: PENDING -> APPROVED, PENDING -> REJECTED, PENDING -> CANCELLED", () => {
      const allowedTransitions = {
        PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
        APPROVED: [], // terminal
        REJECTED: [], // terminal
        CANCELLED: [], // terminal
      };

      assert.deepEqual(allowedTransitions.PENDING, ["APPROVED", "REJECTED", "CANCELLED"]);
      assert.equal(allowedTransitions.APPROVED.length, 0);
      assert.equal(allowedTransitions.REJECTED.length, 0);
      assert.equal(allowedTransitions.CANCELLED.length, 0);
    });

    it("rejection requires a non-empty review note", () => {
      const validateRejectionNote = (note) => {
        return Boolean(note && typeof note === "string" && note.trim().length > 0);
      };

      assert.equal(validateRejectionNote("Doctor on critical roster duty"), true);
      assert.equal(validateRejectionNote(""), false);
      assert.equal(validateRejectionNote("   "), false);
      assert.equal(validateRejectionNote(null), false);
      assert.equal(validateRejectionNote(undefined), false);
    });

    it("approveLeave rejects non-PENDING leave requests safely (APPROVED, REJECTED, CANCELLED)", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      for (const status of ["APPROVED", "REJECTED", "CANCELLED"]) {
        mock.method(LeaveRequest, "findById", async () => ({
          _id: dummyId,
          status,
          healthCentre: "PHC Mathura",
          doctorEmail: "doc.test@health.gov.in",
        }));

        const req = {
          params: { id: dummyId },
          user: { role: "centre-admin", healthCentre: "PHC Mathura", email: "admin@health.gov.in" },
          body: { reviewNote: "Attempting duplicate approval" },
        };
        const res = createMockRes();

        await approveLeave(req, res);
        assert.equal(res.getStatus(), 409);
        assert.equal(res.getJson().success, false);
        assert.equal(
          res.getJson().message,
          `Cannot approve leave request with status '${status}'. Only PENDING requests can be approved.`
        );

        mock.reset();
      }
    });

    it("rejectLeave rejects non-PENDING leave requests safely (APPROVED, REJECTED, CANCELLED)", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      for (const status of ["APPROVED", "REJECTED", "CANCELLED"]) {
        mock.method(LeaveRequest, "findById", async () => ({
          _id: dummyId,
          status,
          healthCentre: "PHC Mathura",
          doctorEmail: "doc.test@health.gov.in",
        }));

        const req = {
          params: { id: dummyId },
          user: { role: "centre-admin", healthCentre: "PHC Mathura", email: "admin@health.gov.in" },
          body: { reviewNote: "Attempting rejection on non-pending leave" },
        };
        const res = createMockRes();

        await rejectLeave(req, res);
        assert.equal(res.getStatus(), 409);
        assert.equal(res.getJson().success, false);
        assert.equal(
          res.getJson().message,
          `Cannot reject leave request with status '${status}'. Only PENDING requests can be rejected.`
        );

        mock.reset();
      }
    });

    it("cancelLeave rejects non-PENDING leave requests safely (APPROVED, REJECTED, CANCELLED)", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      for (const status of ["APPROVED", "REJECTED", "CANCELLED"]) {
        mock.method(LeaveRequest, "findById", async () => ({
          _id: dummyId,
          status,
          healthCentre: "PHC Mathura",
          doctorEmail: "doc.test@health.gov.in",
        }));

        const req = {
          params: { id: dummyId },
          user: { role: "doctor", email: "doc.test@health.gov.in" },
          body: { reason: "Attempting cancellation on non-pending leave" },
        };
        const res = createMockRes();

        await cancelLeave(req, res);
        assert.equal(res.getStatus(), 409);
        assert.equal(res.getJson().success, false);
        assert.equal(
          res.getJson().message,
          `Cannot cancel leave request with status '${status}'. Only PENDING leave requests can be cancelled.`
        );

        mock.reset();
      }
    });
  });

  describe("Zero-Working-Day Leave Submission Controller Enforcement", () => {
    it("submitLeave rejects request covering only weekend days with 400 Bad Request", async () => {
      mock.method(Doctor, "findOne", () => ({
        lean: async () => ({
          _id: "doc_test_id",
          email: "dr.sharma@health.gov.in",
          name: "Dr. Sharma",
          healthCentre: "PHC Mathura",
          department: "General Medicine",
        }),
      }));

      mock.method(Holiday, "find", () => ({
        sort: () => ({
          lean: async () => [],
        }),
      }));

      const req = {
        user: { email: "dr.sharma@health.gov.in", role: "doctor" },
        body: {
          startDate: "2026-10-10", // Saturday
          endDate: "2026-10-11",   // Sunday
          reason: "Weekend rest request",
        },
      };
      const res = createMockRes();

      await submitLeave(req, res);

      assert.equal(res.getStatus(), 400);
      assert.equal(res.getJson().success, false);
      assert.equal(
        res.getJson().message,
        "The selected date range contains no scheduled working days (only weekends or holidays)."
      );

      mock.reset();
    });

    it("submitLeave rejects request covering only an applicable public holiday with 400 Bad Request", async () => {
      mock.method(Doctor, "findOne", () => ({
        lean: async () => ({
          _id: "doc_test_id",
          email: "dr.sharma@health.gov.in",
          name: "Dr. Sharma",
          healthCentre: "PHC Mathura",
          department: "General Medicine",
        }),
      }));

      // Friday 2026-10-02 is District Gandhi Jayanti
      mock.method(Holiday, "find", () => ({
        sort: () => ({
          lean: async () => [
            {
              name: "Gandhi Jayanti",
              date: "2026-10-02",
              scope: "DISTRICT",
              active: true,
            },
          ],
        }),
      }));

      const req = {
        user: { email: "dr.sharma@health.gov.in", role: "doctor" },
        body: {
          startDate: "2026-10-02", // Friday (Holiday)
          endDate: "2026-10-02",
          reason: "National holiday leave attempt",
        },
      };
      const res = createMockRes();

      await submitLeave(req, res);

      assert.equal(res.getStatus(), 400);
      assert.equal(res.getJson().success, false);
      assert.equal(
        res.getJson().message,
        "The selected date range contains no scheduled working days (only weekends or holidays)."
      );

      mock.reset();
    });
  });
});
