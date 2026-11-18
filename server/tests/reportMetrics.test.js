const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateDoctorMetricsForDates } = require("../services/reportService");

describe("Report Metrics & Attendance Percentage Tests", () => {
  const doctor = {
    _id: "doc123",
    name: "Dr. A Sharma",
    email: "doctor@test.com",
    department: "General Medicine",
    healthCentre: "PHC Mathura",
  };

  it("calculates attendance percentage using only eligible working days in denominator", () => {
    // 7 day range: Mon 2026-09-21 to Sun 2026-09-27
    const dateList = [
      "2026-09-21", // Mon (Work)
      "2026-09-22", // Tue (Work)
      "2026-09-23", // Wed (Work)
      "2026-09-24", // Thu (Work)
      "2026-09-25", // Fri (Work)
      "2026-09-26", // Sat (Weekend Off)
      "2026-09-27", // Sun (Weekend Off)
    ];

    const attendanceMap = new Map();
    // Present on 4 working days: Mon, Tue, Wed, Thu
    attendanceMap.set("doctor@test.com_2026-09-21", { status: "Present", date: "2026-09-21" });
    attendanceMap.set("doctor@test.com_2026-09-22", { status: "Present", date: "2026-09-22" });
    attendanceMap.set("doctor@test.com_2026-09-23", { status: "Present", date: "2026-09-23" });
    attendanceMap.set("doctor@test.com_2026-09-24", { status: "Present", date: "2026-09-24" });
    // Fri (2026-09-25) is unmarked -> Absent

    const metrics = calculateDoctorMetricsForDates(
      doctor,
      dateList,
      attendanceMap,
      "2026-09-28", // evaluated from a future date so past unmarked days are Absent
      [],
      { referenceDate: new Date("2026-09-28T12:00:00Z") }
    );

    assert.equal(metrics.totalDays, 7);
    assert.equal(metrics.eligibleWorkingDays, 5); // 5 working days
    assert.equal(metrics.presentWorkingDays, 4);
    assert.equal(metrics.absentDays, 1);
    assert.equal(metrics.nonWorkingDays, 2);
    // Attendance % = 4 / 5 * 100 = 80.0%
    assert.equal(metrics.attendancePercentage, 80);
  });

  it("preserves attendance records marked on non-working days but excludes them from denominator", () => {
    // 7 day range: Mon 2026-09-21 to Sun 2026-09-27
    const dateList = [
      "2026-09-21", // Mon (Work)
      "2026-09-22", // Tue (Work)
      "2026-09-23", // Wed (Work)
      "2026-09-24", // Thu (Work)
      "2026-09-25", // Fri (Work)
      "2026-09-26", // Sat (Weekend Off)
      "2026-09-27", // Sun (Weekend Off) -> Doctor attended on Sunday!
    ];

    const attendanceMap = new Map();
    attendanceMap.set("doctor@test.com_2026-09-21", { status: "Present", date: "2026-09-21" });
    attendanceMap.set("doctor@test.com_2026-09-22", { status: "Present", date: "2026-09-22" });
    attendanceMap.set("doctor@test.com_2026-09-23", { status: "Present", date: "2026-09-23" });
    attendanceMap.set("doctor@test.com_2026-09-24", { status: "Present", date: "2026-09-24" });
    // Sunday Present record
    attendanceMap.set("doctor@test.com_2026-09-27", { status: "Present", date: "2026-09-27" });

    const metrics = calculateDoctorMetricsForDates(
      doctor,
      dateList,
      attendanceMap,
      "2026-09-28",
      [],
      { referenceDate: new Date("2026-09-28T12:00:00Z") }
    );

    assert.equal(metrics.totalDays, 7);
    assert.equal(metrics.eligibleWorkingDays, 5); // denominator remains 5
    assert.equal(metrics.presentDays, 5); // total present is 5
    assert.equal(metrics.presentWorkingDays, 4); // working present is 4
    assert.equal(metrics.presentNonWorkingDays, 1); // 1 non-working present
    assert.equal(metrics.absentDays, 1);
    assert.equal(metrics.nonWorkingDays, 1); // Saturday
    // Attendance % remains 4 / 5 * 100 = 80.0%
    assert.equal(metrics.attendancePercentage, 80);

    // Verify record list retains the Sunday record with status: "Present" and isWorkingDay: false
    const sundayRecord = metrics.records.find((r) => r.date === "2026-09-27");
    assert.ok(sundayRecord);
    assert.equal(sundayRecord.status, "Present");
    assert.equal(sundayRecord.isWorkingDay, false);
    assert.equal(sundayRecord.isRecorded, true);
  });

  it("handles edge case where approved leave covers all scheduled working days (0 required working days -> 0% attendance without NaN)", () => {
    // 5-day working week: Mon 2026-10-05 to Fri 2026-10-09
    const dateList = [
      "2026-10-05", // Mon
      "2026-10-06", // Tue
      "2026-10-07", // Wed
      "2026-10-08", // Thu
      "2026-10-09", // Fri
    ];

    const approvedLeaves = [
      {
        doctorEmail: "doctor@test.com",
        startDate: "2026-10-05",
        endDate: "2026-10-09",
        status: "APPROVED",
      },
    ];

    const attendanceMap = new Map(); // Doctor did not mark attendance because on approved leave

    const metrics = calculateDoctorMetricsForDates(
      doctor,
      dateList,
      attendanceMap,
      "2026-10-15",
      [],
      {
        referenceDate: new Date("2026-10-15T12:00:00Z"),
        approvedLeaves,
      }
    );

    assert.equal(metrics.totalDays, 5);
    assert.equal(metrics.eligibleWorkingDays, 5);
    assert.equal(metrics.onLeaveDays, 5);
    assert.equal(metrics.attendanceRequiredWorkingDays, 0); // 5 eligible - 5 on leave = 0
    assert.equal(metrics.presentWorkingDays, 0);
    assert.equal(metrics.absentDays, 0); // Doctor is on approved leave, NOT absent
    assert.equal(metrics.attendancePercentage, 0);
    assert.equal(Number.isNaN(metrics.attendancePercentage), false, "attendancePercentage must not be NaN");
    assert.equal(Number.isFinite(metrics.attendancePercentage), true, "attendancePercentage must be a finite number");
  });

  it("handles edge case where reporting range consists strictly of non-working days without NaN", () => {
    // Weekend only: Sat 2026-10-10 to Sun 2026-10-11
    const dateList = ["2026-10-10", "2026-10-11"];
    const attendanceMap = new Map();

    const metrics = calculateDoctorMetricsForDates(
      doctor,
      dateList,
      attendanceMap,
      "2026-10-15",
      [],
      { referenceDate: new Date("2026-10-15T12:00:00Z") }
    );

    assert.equal(metrics.totalDays, 2);
    assert.equal(metrics.eligibleWorkingDays, 0);
    assert.equal(metrics.attendanceRequiredWorkingDays, 0);
    assert.equal(metrics.presentWorkingDays, 0);
    assert.equal(metrics.absentDays, 0);
    assert.equal(metrics.nonWorkingDays, 2);
    assert.equal(metrics.attendancePercentage, 0);
    assert.equal(Number.isNaN(metrics.attendancePercentage), false, "attendancePercentage must not be NaN");
    assert.equal(Number.isFinite(metrics.attendancePercentage), true, "attendancePercentage must be a finite number");
  });
});
