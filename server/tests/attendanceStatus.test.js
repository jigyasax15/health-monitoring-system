const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");

describe("Attendance Status Determination Tests", () => {
  const holidays = [
    {
      date: "2026-09-23",
      scope: "CENTRE",
      healthCentre: "PHC Mathura",
      active: true,
    },
  ];

  it("should return 'Present' if attendance record is marked 'Present' even on a non-working day", () => {
    // Sunday 2026-09-27
    const status = determineAttendanceStatus(
      { status: "Present", date: "2026-09-27" },
      {
        targetDate: "2026-09-27",
        referenceDate: new Date("2026-09-28T09:00:00Z"),
        healthCentre: "PHC Mathura",
        holidayList: holidays,
      }
    );
    assert.equal(status, "Present");
  });

  it("should return 'Non-Working Day' if no record exists on weekend or holiday", () => {
    // Saturday 2026-09-26 (Weekend)
    const weekendStatus = determineAttendanceStatus(null, {
      targetDate: "2026-09-26",
      referenceDate: new Date("2026-09-28T09:00:00Z"),
      healthCentre: "PHC Mathura",
      holidayList: holidays,
    });
    assert.equal(weekendStatus, "Non-Working Day");

    // Wednesday 2026-09-23 (Holiday for PHC Mathura)
    const holidayStatus = determineAttendanceStatus(null, {
      targetDate: "2026-09-23",
      referenceDate: new Date("2026-09-28T09:00:00Z"),
      healthCentre: "PHC Mathura",
      holidayList: holidays,
    });
    assert.equal(holidayStatus, "Non-Working Day");
  });

  it("should return 'Absent' for an unmarked past working day", () => {
    // Monday 2026-09-21 (past working day relative to 2026-09-28)
    const status = determineAttendanceStatus(null, {
      targetDate: "2026-09-21",
      referenceDate: new Date("2026-09-28T09:00:00Z"),
      healthCentre: "PHC Mathura",
      holidayList: holidays,
    });
    assert.equal(status, "Absent");
  });

  it("should return 'Not Marked' for a future working day", () => {
    // Friday 2026-10-09 (future working day relative to 2026-09-28)
    const status = determineAttendanceStatus(null, {
      targetDate: "2026-10-09",
      referenceDate: new Date("2026-09-28T09:00:00Z"),
      healthCentre: "PHC Mathura",
      holidayList: holidays,
    });
    assert.equal(status, "Not Marked");
  });

  it("should return 'Not Marked' for today before cutoff (10:00 IST)", () => {
    // 09:30 IST on Monday 2026-09-28 is 04:00 UTC
    const morningDate = new Date("2026-09-28T04:00:00Z");
    const status = determineAttendanceStatus(null, {
      targetDate: "2026-09-28",
      referenceDate: morningDate,
      healthCentre: "PHC Mathura",
      holidayList: holidays,
    });
    assert.equal(status, "Not Marked");
  });

  it("should return 'Absent' for today after cutoff (10:00 IST)", () => {
    // 10:30 IST on Monday 2026-09-28 is 05:00 UTC
    const lateDate = new Date("2026-09-28T05:00:00Z");
    const status = determineAttendanceStatus(null, {
      targetDate: "2026-09-28",
      referenceDate: lateDate,
      healthCentre: "PHC Mathura",
      holidayList: holidays,
    });
    assert.equal(status, "Absent");
  });
});
