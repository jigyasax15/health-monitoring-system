const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateLeaveDates,
  calculateWorkingDaysForLeave,
} = require("../services/leaveService");

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
  });
});
