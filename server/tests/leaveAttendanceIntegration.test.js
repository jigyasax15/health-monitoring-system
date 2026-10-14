const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { determineAttendanceStatus } = require("../utils/attendanceStatus");
const { calculateDoctorMetricsForDates } = require("../services/reportService");
const { calculateConsecutiveAbsences } = require("../services/alertService");

describe("Leave Attendance & Absenteeism Integration Tests", () => {
  const doctor = {
    _id: "doc_test_1",
    name: "Dr. Ramesh Gupta",
    email: "ramesh@health.gov.in",
    department: "Pediatrics",
    healthCentre: "PHC Mathura",
  };

  const sampleApprovedLeaves = [
    {
      _id: "leave_1",
      doctorEmail: "ramesh@health.gov.in",
      startDate: "2026-10-05", // Monday
      endDate: "2026-10-06",   // Tuesday
      status: "APPROVED",
    },
  ];

  describe("Attendance Status Precedence", () => {
    it("returns 'On Leave' on scheduled working day covered by APPROVED leave", () => {
      // 2026-10-05 (Monday)
      const status = determineAttendanceStatus(null, {
        targetDate: "2026-10-05",
        doctorEmail: "ramesh@health.gov.in",
        healthCentre: "PHC Mathura",
        referenceDate: new Date("2026-10-10T12:00:00Z"),
        approvedLeaves: sampleApprovedLeaves,
      });

      assert.equal(status, "On Leave");
    });

    it("returns 'Present' if actual attendance record exists even when doctor is on approved leave", () => {
      // Doctor physically marked attendance on leave day
      const status = determineAttendanceStatus(
        { status: "Present", date: "2026-10-05" },
        {
          targetDate: "2026-10-05",
          doctorEmail: "ramesh@health.gov.in",
          healthCentre: "PHC Mathura",
          referenceDate: new Date("2026-10-10T12:00:00Z"),
          approvedLeaves: sampleApprovedLeaves,
        }
      );

      assert.equal(status, "Present");
    });

    it("returns 'Non-Working Day' if leave request covers a weekend", () => {
      // Sunday 2026-10-04 with a leave covering it
      const weekendLeave = [
        {
          doctorEmail: "ramesh@health.gov.in",
          startDate: "2026-10-03",
          endDate: "2026-10-05",
          status: "APPROVED",
        },
      ];

      const status = determineAttendanceStatus(null, {
        targetDate: "2026-10-04", // Sunday
        doctorEmail: "ramesh@health.gov.in",
        healthCentre: "PHC Mathura",
        referenceDate: new Date("2026-10-10T12:00:00Z"),
        approvedLeaves: weekendLeave,
      });

      assert.equal(status, "Non-Working Day");
    });

    it("returns 'Absent' on past working day if leave is PENDING or REJECTED", () => {
      const nonApprovedLeaves = [
        {
          doctorEmail: "ramesh@health.gov.in",
          startDate: "2026-10-05",
          endDate: "2026-10-06",
          status: "PENDING",
        },
      ];

      const status = determineAttendanceStatus(null, {
        targetDate: "2026-10-05",
        doctorEmail: "ramesh@health.gov.in",
        healthCentre: "PHC Mathura",
        referenceDate: new Date("2026-10-10T12:00:00Z"),
        approvedLeaves: nonApprovedLeaves,
      });

      assert.equal(status, "Absent");
    });
  });

  describe("Attendance Percentage Calculations", () => {
    it("correctly deducts approved leave days from denominator without penalizing percentage", () => {
      // 20 scheduled working days: 17 Present, 1 Absent, 2 Approved Leave
      // Total eligible = 20, On Leave = 2 -> Required = 18.
      // Present working = 17 -> Percentage = 17 / 18 * 100 = 94.4%
      const dateList = [];
      const attendanceMap = new Map();

      // Create 20 consecutive weekdays (Mon-Fri)
      let count = 0;
      let day = 1;
      const leaveDays = ["2026-10-19", "2026-10-20"]; // 2 approved leave days
      const absentDay = "2026-10-21";                 // 1 absent day

      while (count < 20) {
        const d = String(day).padStart(2, "0");
        const dateStr = `2026-10-${d}`;
        const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Mon-Fri
          dateList.push(dateStr);
          count++;
          if (!leaveDays.includes(dateStr) && dateStr !== absentDay) {
            attendanceMap.set(`${doctor.email}_${dateStr}`, { status: "Present", date: dateStr });
          }
        }
        day++;
      }

      const approvedLeaves = [
        {
          doctorEmail: doctor.email,
          startDate: "2026-10-19",
          endDate: "2026-10-20",
          status: "APPROVED",
        },
      ];

      const metrics = calculateDoctorMetricsForDates(
        doctor,
        dateList,
        attendanceMap,
        "2026-10-31",
        [],
        {
          referenceDate: new Date("2026-10-31T12:00:00Z"),
          approvedLeaves,
        }
      );

      assert.equal(metrics.eligibleWorkingDays, 20);
      assert.equal(metrics.onLeaveDays, 2);
      assert.equal(metrics.attendanceRequiredWorkingDays, 18);
      assert.equal(metrics.presentWorkingDays, 17);
      assert.equal(metrics.absentDays, 1);
      assert.equal(metrics.attendancePercentage, 94.4);
    });

    it("returns 0% when attendanceRequiredWorkingDays === 0 even if weekend attendance exists", () => {
      // 2 working days in range, both on approved leave
      const dateList = ["2026-10-05", "2026-10-06", "2026-10-11"]; // 11 is Sunday
      const attendanceMap = new Map();
      // Sunday Present mark
      attendanceMap.set(`${doctor.email}_2026-10-11`, { status: "Present", date: "2026-10-11" });

      const approvedLeaves = [
        {
          doctorEmail: doctor.email,
          startDate: "2026-10-05",
          endDate: "2026-10-06",
          status: "APPROVED",
        },
      ];

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

      assert.equal(metrics.eligibleWorkingDays, 2);
      assert.equal(metrics.onLeaveDays, 2);
      assert.equal(metrics.attendanceRequiredWorkingDays, 0);
      assert.equal(metrics.presentWorkingDays, 0);
      assert.equal(metrics.presentNonWorkingDays, 1);
      assert.equal(metrics.attendancePercentage, 0);
    });
  });

  describe("Absenteeism Alert Streak Integration", () => {
    it("approved leave breaks consecutive unexcused absence streak (Fri Absent + Mon Leave + Tue Absent = 1 streak)", () => {
      // 2026-09-29 is Tuesday 11:00 IST (05:30 UTC)
      const tuesdayRefDate = new Date("2026-09-29T05:30:00Z");

      // Friday was 2026-09-25 (absent)
      // Sat/Sun 26/27 (weekend)
      // Mon 28 (Approved Leave)
      // Tue 29 (Absent)
      const approvedLeaves = [
        {
          doctorEmail: doctor.email,
          startDate: "2026-09-28",
          endDate: "2026-09-28",
          status: "APPROVED",
        },
      ];

      const attendanceRecords = [
        {
          doctorEmail: doctor.email,
          date: "2026-09-24",
          status: "Present",
        },
        // 2026-09-25: unmarked -> Absent
        // 2026-09-28: on approved leave -> On Leave
        // 2026-09-29: unmarked -> Absent
      ];

      const streak = calculateConsecutiveAbsences(doctor, attendanceRecords, {
        referenceDate: tuesdayRefDate,
        holidayList: [],
        approvedLeaves,
      });

      // Tuesday streak must be 1 because Monday was On Leave and broke the streak
      assert.equal(streak, 1);
    });

    it("doctor on approved leave today returns 0 streak (no alert generated)", () => {
      // 2026-09-28 is Monday
      const mondayRefDate = new Date("2026-09-28T05:30:00Z");

      const approvedLeaves = [
        {
          doctorEmail: doctor.email,
          startDate: "2026-09-28",
          endDate: "2026-09-28",
          status: "APPROVED",
        },
      ];

      const attendanceRecords = [
        // Friday was absent
        {
          doctorEmail: doctor.email,
          date: "2026-09-24",
          status: "Present",
        },
      ];

      const streak = calculateConsecutiveAbsences(doctor, attendanceRecords, {
        referenceDate: mondayRefDate,
        holidayList: [],
        approvedLeaves,
      });

      assert.equal(streak, 0);
    });
  });
});
