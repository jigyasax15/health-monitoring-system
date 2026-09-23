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
});
