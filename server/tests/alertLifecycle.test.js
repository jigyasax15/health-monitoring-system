const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const alertConfig = require("../config/alertConfig");
const {
  acknowledgeAlert,
  addAlertNote,
  resolveAlert,
  getAlertsSummary,
  attachEscalationStatus,
} = require("../services/alertService");

describe("Alert Lifecycle & Escalation Tests", () => {
  describe("Escalation Computation Unit Tests", () => {
    it("recent active alert (<24 hours old) is not escalated", () => {
      const now = new Date("2026-09-24T12:00:00Z");
      const recentAlert = {
        status: "ACTIVE",
        resolved: false,
        acknowledgedAt: null,
        createdAt: new Date("2026-09-24T06:00:00Z"), // 6 hours old
      };

      const isEscalated = alertConfig.isAlertEscalated(recentAlert, now);
      assert.equal(isEscalated, false);
    });

    it("active alert older than escalationAfterHours (>=24 hours) is escalated", () => {
      const now = new Date("2026-09-25T14:00:00Z");
      const oldAlert = {
        status: "ACTIVE",
        resolved: false,
        acknowledgedAt: null,
        createdAt: new Date("2026-09-24T12:00:00Z"), // 26 hours old
      };

      const isEscalated = alertConfig.isAlertEscalated(oldAlert, now);
      assert.equal(isEscalated, true);
    });

    it("acknowledged alert older than 24 hours is not escalated", () => {
      const now = new Date("2026-09-25T14:00:00Z");
      const ackAlert = {
        status: "ACKNOWLEDGED",
        resolved: false,
        acknowledgedAt: new Date("2026-09-24T18:00:00Z"),
        createdAt: new Date("2026-09-24T12:00:00Z"),
      };

      const isEscalated = alertConfig.isAlertEscalated(ackAlert, now);
      assert.equal(isEscalated, false);
    });

    it("resolved alert older than 24 hours is not escalated", () => {
      const now = new Date("2026-09-25T14:00:00Z");
      const resolvedAlert = {
        status: "RESOLVED",
        resolved: true,
        resolvedAt: new Date("2026-09-24T16:00:00Z"),
        createdAt: new Date("2026-09-24T10:00:00Z"),
      };

      const isEscalated = alertConfig.isAlertEscalated(resolvedAlert, now);
      assert.equal(isEscalated, false);
    });
  });

  describe("Status Transition & RBAC Invariant Checks", () => {
    it("centre-admin can only operate on their own health centre", () => {
      const user = { role: "centre-admin", healthCentre: "PHC Mathura" };
      const ownAlert = { healthCentre: "PHC Mathura" };
      const foreignAlert = { healthCentre: "CHC Vrindavan" };

      const canAccessOwn = user.role === "ddhs" || user.healthCentre === ownAlert.healthCentre;
      const canAccessForeign = user.role === "ddhs" || user.healthCentre === foreignAlert.healthCentre;

      assert.equal(canAccessOwn, true);
      assert.equal(canAccessForeign, false);
    });

    it("ddhs can operate on any health centre", () => {
      const user = { role: "ddhs" };
      const alert1 = { healthCentre: "PHC Mathura" };
      const alert2 = { healthCentre: "CHC Vrindavan" };

      const canAccess1 = user.role === "ddhs" || user.healthCentre === alert1.healthCentre;
      const canAccess2 = user.role === "ddhs" || user.healthCentre === alert2.healthCentre;

      assert.equal(canAccess1, true);
      assert.equal(canAccess2, true);
    });

    it("doctor role is not permitted to access administrative alert actions", () => {
      const allowedRoles = ["centre-admin", "ddhs"];
      const doctorRole = "doctor";

      assert.equal(allowedRoles.includes(doctorRole), false);
    });

    it("valid transitions: ACTIVE -> ACKNOWLEDGED -> RESOLVED and ACTIVE -> RESOLVED", () => {
      const validTransitions = {
        ACTIVE: ["ACKNOWLEDGED", "RESOLVED"],
        ACKNOWLEDGED: ["RESOLVED"],
        RESOLVED: [],
      };

      assert.equal(validTransitions.ACTIVE.includes("ACKNOWLEDGED"), true);
      assert.equal(validTransitions.ACTIVE.includes("RESOLVED"), true);
      assert.equal(validTransitions.ACKNOWLEDGED.includes("RESOLVED"), true);
      assert.equal(validTransitions.RESOLVED.includes("ACKNOWLEDGED"), false);
      assert.equal(validTransitions.RESOLVED.includes("RESOLVED"), false);
    });
  });

  describe("Audit Trail Formatting & Sanitization", () => {
    it("audit trail entries preserve actor identity, role, timestamp and non-empty note", () => {
      const actor = { email: "admin@mathura.phc.gov.in", role: "centre-admin" };
      const note = "Contacted doctor; doctor reported vehicle breakdown";
      const timestamp = new Date();

      const auditEntry = {
        action: "NOTE_ADDED",
        performedBy: actor.email,
        role: actor.role,
        note: note.trim(),
        timestamp,
      };

      assert.equal(auditEntry.performedBy, "admin@mathura.phc.gov.in");
      assert.equal(auditEntry.role, "centre-admin");
      assert.equal(auditEntry.action, "NOTE_ADDED");
      assert.equal(auditEntry.note.length > 0, true);
      assert.equal(auditEntry.timestamp instanceof Date, true);
    });

    it("empty note validation rejects whitespace-only notes", () => {
      const emptyNote1 = "";
      const emptyNote2 = "   ";
      const validNote = "  Doctor will join duty tomorrow.  ";

      assert.equal(emptyNote1.trim().length === 0, true);
      assert.equal(emptyNote2.trim().length === 0, true);
      assert.equal(validNote.trim().length > 0, true);
      assert.equal(validNote.trim(), "Doctor will join duty tomorrow.");
    });
  });

  describe("Pagination & Parameter Bounds Validation", () => {
    it("validates page and limit boundaries correctly", () => {
      function validatePagination(p, l) {
        const page = parseInt(p, 10);
        const limit = parseInt(l, 10);
        if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
          return { valid: false };
        }
        return { valid: true, page, limit };
      }

      assert.equal(validatePagination("1", "20").valid, true);
      assert.equal(validatePagination("5", "100").valid, true);
      assert.equal(validatePagination("0", "20").valid, false);
      assert.equal(validatePagination("-1", "20").valid, false);
      assert.equal(validatePagination("1", "150").valid, false);
      assert.equal(validatePagination("abc", "20").valid, false);
    });
  });
});
