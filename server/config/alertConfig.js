/**
 * Centralized Alert & Escalation Configuration
 */
module.exports = {
  // Number of hours an active unacknowledged alert remains before being marked as escalated
  escalationAfterHours: 24,

  // Severity thresholds mapped to consecutive missed working days
  severityMap: {
    1: { type: "ABSENT_TODAY", severity: "medium", label: "Absent Today" },
    2: { type: "CONSECUTIVE_ABSENCE_2_DAYS", severity: "high", label: "Absent for 2 Days" },
    3: { type: "CONSECUTIVE_ABSENCE_3_PLUS_DAYS", severity: "critical", label: "Absent for 3+ Days" },
  },

  // Numerical severity weights for sorting
  severityWeight: {
    critical: 3,
    high: 2,
    medium: 1,
    low: 1,
  },

  /**
   * Derives whether an alert is escalated based on its status and timestamps.
   * An alert is escalated if it is ACTIVE, unacknowledged, and older than escalationAfterHours.
   *
   * @param {Object} alert
   * @param {Date} [referenceDate=new Date()]
   * @returns {boolean}
   */
  isAlertEscalated(alert, referenceDate = new Date()) {
    if (!alert) return false;
    if (alert.status !== "ACTIVE" && alert.status !== undefined) return false;
    if (alert.resolved) return false;
    if (alert.acknowledgedAt) return false;

    const createdTime = alert.createdAt ? new Date(alert.createdAt).getTime() : 0;
    const now = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
    const ageInHours = (now - createdTime) / (1000 * 60 * 60);

    return ageInHours >= this.escalationAfterHours;
  },
};
