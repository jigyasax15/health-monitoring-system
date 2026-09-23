const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  getDayOfWeek,
  isWeeklyOff,
  isHoliday,
  isWorkingDay,
  getEligibleWorkingDates,
} = require("../utils/workingDays");

describe("Working Days & Holiday Utility Tests", () => {
  it("getDayOfWeek should correctly identify days of the week in IST", () => {
    // 2026-09-21 is Monday (1)
    assert.equal(getDayOfWeek("2026-09-21"), 1);
    // 2026-09-25 is Friday (5)
    assert.equal(getDayOfWeek("2026-09-25"), 5);
    // 2026-09-26 is Saturday (6)
    assert.equal(getDayOfWeek("2026-09-26"), 6);
    // 2026-09-27 is Sunday (0)
    assert.equal(getDayOfWeek("2026-09-27"), 0);
  });

  it("isWeeklyOff should return true for Saturday and Sunday", () => {
    assert.equal(isWeeklyOff("2026-09-26"), true); // Saturday
    assert.equal(isWeeklyOff("2026-09-27"), true); // Sunday
    assert.equal(isWeeklyOff("2026-09-21"), false); // Monday
    assert.equal(isWeeklyOff("2026-09-25"), false); // Friday
  });

  it("isHoliday should distinguish DISTRICT and CENTRE scopes", () => {
    const holidays = [
      {
        name: "Gandhi Jayanti",
        date: "2026-10-02",
        type: "PUBLIC",
        scope: "DISTRICT",
        active: true,
      },
      {
        name: "Mathura Local Festival",
        date: "2026-09-22",
        type: "LOCAL",
        scope: "CENTRE",
        healthCentre: "PHC Mathura",
        active: true,
      },
      {
        name: "Inactive Holiday",
        date: "2026-09-23",
        scope: "DISTRICT",
        active: false,
      },
    ];

    // District holiday applies to any centre or null centre
    const distMatch1 = isHoliday("2026-10-02", "PHC Mathura", holidays);
    assert.ok(distMatch1);
    assert.equal(distMatch1.name, "Gandhi Jayanti");

    const distMatch2 = isHoliday("2026-10-02", "PHC Vrindavan", holidays);
    assert.ok(distMatch2);

    // Centre holiday applies only to that centre
    const centreMatch = isHoliday("2026-09-22", "PHC Mathura", holidays);
    assert.ok(centreMatch);
    assert.equal(centreMatch.name, "Mathura Local Festival");

    const otherCentre = isHoliday("2026-09-22", "PHC Vrindavan", holidays);
    assert.equal(otherCentre, null);

    const nullCentre = isHoliday("2026-09-22", null, holidays);
    assert.equal(nullCentre, null);

    // Inactive holiday is ignored
    const inactive = isHoliday("2026-09-23", "PHC Mathura", holidays);
    assert.equal(inactive, null);
  });

  it("isWorkingDay should combine weekly offs and holidays correctly", () => {
    const holidays = [
      {
        date: "2026-09-22", // Tuesday
        scope: "CENTRE",
        healthCentre: "PHC Mathura",
        active: true,
      },
    ];

    // Monday (2026-09-21) is a working day
    assert.equal(isWorkingDay("2026-09-21", { healthCentre: "PHC Mathura", holidayList: holidays }), true);

    // Tuesday (2026-09-22) is a centre holiday for PHC Mathura
    assert.equal(isWorkingDay("2026-09-22", { healthCentre: "PHC Mathura", holidayList: holidays }), false);

    // Tuesday (2026-09-22) is a working day for PHC Vrindavan
    assert.equal(isWorkingDay("2026-09-22", { healthCentre: "PHC Vrindavan", holidayList: holidays }), true);

    // Saturday (2026-09-26) is a weekly off
    assert.equal(isWorkingDay("2026-09-26", { healthCentre: "PHC Mathura", holidayList: holidays }), false);

    // Sunday (2026-09-27) is a weekly off
    assert.equal(isWorkingDay("2026-09-27", { healthCentre: "PHC Mathura", holidayList: holidays }), false);
  });

  it("getEligibleWorkingDates should generate list of only working dates", () => {
    const holidays = [
      {
        date: "2026-09-22", // Tuesday
        scope: "DISTRICT",
        active: true,
      },
    ];

    // From Monday 2026-09-21 to Sunday 2026-09-27 (7 total days)
    // Mon (21): Work
    // Tue (22): Holiday -> Non-working
    // Wed (23): Work
    // Thu (24): Work
    // Fri (25): Work
    // Sat (26): Weekend -> Non-working
    // Sun (27): Weekend -> Non-working
    // Expected working dates: 21, 23, 24, 25 (4 days)
    const workingDates = getEligibleWorkingDates("2026-09-21", "2026-09-27", "PHC Mathura", holidays);
    assert.deepEqual(workingDates, ["2026-09-21", "2026-09-23", "2026-09-24", "2026-09-25"]);
  });
});
