const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { authorizeRoles } = require("../middleware/authMiddleware");
const LeaveRequest = require("../models/LeaveRequest");
const {
  getCentreLeaves,
  approveLeave,
  rejectLeave,
  getLeaveById,
  cancelLeave,
} = require("../controllers/leaveController");

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

  describe("Leave Endpoint RBAC & Isolation Tests", () => {
    it("Leave route middleware RBAC: restricts endpoint access strictly by authorized roles", () => {
      // 1. Submit leave & getMyLeaves: Doctor only
      const doctorOnlyMiddleware = authorizeRoles("doctor");
      const executeRole = (middleware, userObj) => {
        let called = false;
        const res = createMockRes();
        middleware({ user: userObj }, res, () => { called = true; });
        return { called, status: res.getStatus(), json: res.getJson() };
      };

      // Doctor is allowed
      assert.equal(executeRole(doctorOnlyMiddleware, { role: "doctor" }).called, true);
      // Centre-admin is rejected
      const centreAdminOnDoctorRoute = executeRole(doctorOnlyMiddleware, { role: "centre-admin" });
      assert.equal(centreAdminOnDoctorRoute.called, false);
      assert.equal(centreAdminOnDoctorRoute.status, 403);
      // DDHS is rejected
      const ddhsOnDoctorRoute = executeRole(doctorOnlyMiddleware, { role: "ddhs" });
      assert.equal(ddhsOnDoctorRoute.called, false);
      assert.equal(ddhsOnDoctorRoute.status, 403);
      // Unauthenticated (no user role) is rejected with 401
      const noUserResult = executeRole(doctorOnlyMiddleware, null);
      assert.equal(noUserResult.called, false);
      assert.equal(noUserResult.status, 401);

      // 2. Centre-level operations (listing, approve, reject): Centre-admin only
      const centreAdminOnlyMiddleware = authorizeRoles("centre-admin");
      assert.equal(executeRole(centreAdminOnlyMiddleware, { role: "centre-admin" }).called, true);
      assert.equal(executeRole(centreAdminOnlyMiddleware, { role: "doctor" }).status, 403);
      assert.equal(executeRole(centreAdminOnlyMiddleware, { role: "ddhs" }).status, 403);

      // 3. DDHS-level operations: DDHS only
      const ddhsOnlyMiddleware = authorizeRoles("ddhs");
      assert.equal(executeRole(ddhsOnlyMiddleware, { role: "ddhs" }).called, true);
      assert.equal(executeRole(ddhsOnlyMiddleware, { role: "doctor" }).status, 403);
      assert.equal(executeRole(ddhsOnlyMiddleware, { role: "centre-admin" }).status, 403);

      // 4. Cancel leave: Doctor or Centre-Admin only (DDHS cannot cancel)
      const cancelMiddleware = authorizeRoles("doctor", "centre-admin");
      assert.equal(executeRole(cancelMiddleware, { role: "doctor" }).called, true);
      assert.equal(executeRole(cancelMiddleware, { role: "centre-admin" }).called, true);
      assert.equal(executeRole(cancelMiddleware, { role: "ddhs" }).status, 403);
    });

    it("getCentreLeaves rejects centre-admin without an assigned health centre", async () => {
      const req = {
        user: { role: "centre-admin", email: "unassigned@health.gov.in", healthCentre: null },
        query: {},
      };
      const res = createMockRes();
      await getCentreLeaves(req, res);

      assert.equal(res.getStatus(), 403);
      assert.equal(res.getJson().success, false);
      assert.equal(res.getJson().message, "No health centre assigned to this administrator account");
    });

    it("approveLeave enforces centre isolation (rejects approval for another health centre)", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      mock.method(LeaveRequest, "findById", async () => ({
        _id: dummyId,
        healthCentre: "PHC Agra",
        status: "PENDING",
      }));

      const req = {
        params: { id: dummyId },
        user: { role: "centre-admin", healthCentre: "PHC Mathura", email: "admin@health.gov.in" },
        body: { reviewNote: "Attempting cross-centre approval" },
      };
      const res = createMockRes();

      await approveLeave(req, res);
      assert.equal(res.getStatus(), 403);
      assert.equal(res.getJson().success, false);
      assert.equal(res.getJson().message, "Access denied: cannot approve leave for another health centre");

      mock.reset();
    });

    it("rejectLeave enforces centre isolation (rejects rejection for another health centre)", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      mock.method(LeaveRequest, "findById", async () => ({
        _id: dummyId,
        healthCentre: "PHC Agra",
        status: "PENDING",
      }));

      const req = {
        params: { id: dummyId },
        user: { role: "centre-admin", healthCentre: "PHC Mathura", email: "admin@health.gov.in" },
        body: { reviewNote: "Legitimate review note" },
      };
      const res = createMockRes();

      await rejectLeave(req, res);
      assert.equal(res.getStatus(), 403);
      assert.equal(res.getJson().success, false);
      assert.equal(res.getJson().message, "Access denied: cannot reject leave for another health centre");

      mock.reset();
    });

    it("getLeaveById enforces role and centre isolation", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      const mockLeaveDoc = {
        _id: dummyId,
        doctorEmail: "doc.sharma@health.gov.in",
        healthCentre: "PHC Mathura",
        status: "PENDING",
      };

      mock.method(LeaveRequest, "findById", () => {
        const promise = Promise.resolve(mockLeaveDoc);
        promise.lean = async () => mockLeaveDoc;
        return promise;
      });

      // 1. Doctor attempting to view another doctor's leave -> 403
      const docReq = {
        params: { id: dummyId },
        user: { role: "doctor", email: "doc.verma@health.gov.in" },
      };
      const docRes = createMockRes();
      await getLeaveById(docReq, docRes);
      assert.equal(docRes.getStatus(), 403);
      assert.equal(docRes.getJson().message, "Access denied: cannot view another doctor's leave request");

      // 2. Centre Admin attempting to view another centre's leave -> 403
      const adminReq = {
        params: { id: dummyId },
        user: { role: "centre-admin", healthCentre: "PHC Agra", email: "admin@agra.gov.in" },
      };
      const adminRes = createMockRes();
      await getLeaveById(adminReq, adminRes);
      assert.equal(adminRes.getStatus(), 403);
      assert.equal(adminRes.getJson().message, "Access denied: leave request belongs to another health centre");

      mock.reset();
    });

    it("cancelLeave enforces role and centre isolation", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      const mockLeaveDoc = {
        _id: dummyId,
        doctorEmail: "doc.sharma@health.gov.in",
        healthCentre: "PHC Mathura",
        status: "PENDING",
      };

      mock.method(LeaveRequest, "findById", async () => mockLeaveDoc);

      // 1. Doctor attempting to cancel another doctor's leave -> 403
      const docReq = {
        params: { id: dummyId },
        user: { role: "doctor", email: "doc.verma@health.gov.in" },
        body: {},
      };
      const docRes = createMockRes();
      await cancelLeave(docReq, docRes);
      assert.equal(docRes.getStatus(), 403);
      assert.equal(docRes.getJson().message, "Access denied: cannot cancel another doctor's leave request");

      // 2. Centre Admin attempting to cancel another centre's leave -> 403
      const adminReq = {
        params: { id: dummyId },
        user: { role: "centre-admin", healthCentre: "PHC Agra", email: "admin@agra.gov.in" },
        body: {},
      };
      const adminRes = createMockRes();
      await cancelLeave(adminReq, adminRes);
      assert.equal(adminRes.getStatus(), 403);
      assert.equal(adminRes.getJson().message, "Access denied: cannot cancel leave for another health centre");

      mock.reset();
    });
  });
});
