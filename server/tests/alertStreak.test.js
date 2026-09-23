const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateConsecutiveAbsences } = require("../services/alertService");

describe("Alert Consecutive Absence Streak Tests", () => {
  const doctor = {
    _id: "doc123",
    name: "Dr. A Sharma",
    email: "doctor@test.com",
    healthCentre: "PHC Mathura",
  };

  it("Friday absent + Saturday/Sunday off + Monday absent = 2 consecutive missed working days", () => {
    // 2026-09-28 is Monday, 11:00 IST (05:30 UTC) -> after cutoff
    const mondayRefDate = new Date("2026-09-28T05:30:00Z");

    // Attendance records: Thursday (2026-09-24) Present, Friday (2026-09-25) unmarked -> Absent
    const attendanceRecords = [
      {
        doctorEmail: "doctor@test.com",
        date: "2026-09-24", // Thursday
        status: "Present",
      },
      // 2026-09-25 (Friday): no record -> Absent
      // 2026-09-26 (Saturday): weekly off -> Non-Working Day
      // 2026-09-27 (Sunday): weekly off -> Non-Working Day
      // 2026-09-28 (Monday): no record, past cutoff -> Absent
    ];

    const streak = calculateConsecutiveAbsences(doctor, attendanceRecords, {
      referenceDate: mondayRefDate,
      holidayList: [],
    });

    assert.equal(streak, 2);
  });

  it("Friday absent + Weekend off + Monday holiday + Tuesday absent = 2 consecutive missed working days", () => {
    // 2026-09-29 is Tuesday, 11:00 IST (05:30 UTC)
    const tuesdayRefDate = new Date("2026-09-29T05:30:00Z");

    const holidays = [
      {
        name: "Monday Special Holiday",
        date: "2026-09-28", // Monday
        scope: "DISTRICT",
        active: true,
      },
    ];

    const attendanceRecords = [
      {
        doctorEmail: "doctor@test.com",
        date: "2026-09-24", // Thursday
        status: "Present",
      },
      // 2026-09-25 (Friday): no record -> Absent
      // 2026-09-26 (Sat): Off -> Non-Working Day
      // 2026-09-27 (Sun): Off -> Non-Working Day
      // 2026-09-28 (Mon): Holiday -> Non-Working Day
      // 2026-09-29 (Tue): no record, past cutoff -> Absent
    ];

    const streak = calculateConsecutiveAbsences(doctor, attendanceRecords, {
      referenceDate: tuesdayRefDate,
      holidayList: holidays,
    });

    assert.equal(streak, 2);
  });

  it("Absence streak on a weekend or holiday must return 0 (no alerts on non-working days)", () => {
    // 2026-09-27 is Sunday, 11:00 IST (05:30 UTC)
    const sundayRefDate = new Date("2026-09-27T05:30:00Z");

    const attendanceRecords = [
      // Friday was absent
      {
        doctorEmail: "doctor@test.com",
        date: "2026-09-24",
        status: "Present",
      },
    ];

    const streak = calculateConsecutiveAbsences(doctor, attendanceRecords, {
      referenceDate: sundayRefDate,
      holidayList: [],
    });

    assert.equal(streak, 0);
  });

  it("Streak is broken when doctor was Present on the intermediate working day", () => {
    // 2026-09-28 is Monday, 11:00 IST
    const mondayRefDate = new Date("2026-09-28T05:30:00Z");

    const attendanceRecords = [
      {
        doctorEmail: "doctor@test.com",
        date: "2026-09-25", // Friday: Present!
        status: "Present",
      },
      // 2026-09-28 (Monday): Absent
    ];

    const streak = calculateConsecutiveAbsences(doctor, attendanceRecords, {
      referenceDate: mondayRefDate,
      holidayList: [],
    });

    assert.equal(streak, 1);
  });
});
