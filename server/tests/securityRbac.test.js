const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { authorizeRoles } = require("../middleware/authMiddleware");

describe("Security & RBAC Authorization Tests", () => {
  it("authorizeRoles should allow authorized roles and reject unauthorized ones", () => {
    const middleware = authorizeRoles("centre-admin", "ddhs");

    // Case 1: Authorized centre-admin
    let nextCalled = false;
    let resStatus = null;
    let resJson = null;

    const mockReqAdmin = { user: { role: "centre-admin", email: "phcadmin@test.com" } };
    const mockRes = {
      status: (code) => {
        resStatus = code;
        return {
          json: (data) => {
            resJson = data;
          },
        };
      },
    };

    middleware(mockReqAdmin, mockRes, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(resStatus, null);

    // Case 2: Unauthorized doctor
    nextCalled = false;
    resStatus = null;
    resJson = null;

    const mockReqDoctor = { user: { role: "doctor", email: "doctor@test.com" } };
    middleware(mockReqDoctor, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(resStatus, 403);
    assert.equal(resJson.success, false);
    assert.equal(resJson.message, "Access denied: insufficient permissions.");
  });

  it("Holiday controller RBAC logic validation", async () => {
    const { createHoliday, updateHoliday, deleteHoliday } = require("../controllers/holidayController");

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

    // 1. Doctor attempting to create a holiday -> 403
    const docReq = {
      user: { role: "doctor", email: "doctor@test.com" },
      body: { name: "Test Holiday", date: "2026-10-15" },
    };
    const docRes = createMockRes();
    await createHoliday(docReq, docRes);
    assert.equal(docRes.getStatus(), 403);
    assert.equal(docRes.getJson().message, "Access denied: doctors cannot create holidays");

    // 2. Centre admin attempting to create DISTRICT holiday -> 403
    const adminReq = {
      user: { role: "centre-admin", email: "admin@test.com", healthCentre: "PHC Mathura" },
      body: { name: "District Holiday", date: "2026-10-15", scope: "DISTRICT" },
    };
    const adminRes = createMockRes();
    await createHoliday(adminReq, adminRes);
    assert.equal(adminRes.getStatus(), 403);
    assert.equal(adminRes.getJson().message, "Access denied: centre admins can only create CENTRE scope holidays");
  });
});
