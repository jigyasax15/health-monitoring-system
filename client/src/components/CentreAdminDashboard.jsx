import { useEffect, useState } from "react";

function CentreAdminDashboard({ user, onLogout }) {
  // Today's summary
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Alert Lifecycle Management State
  const [alerts, setAlerts] = useState([]);
  const [alertsSummary, setAlertsSummary] = useState({
    active: 0,
    acknowledged: 0,
    resolved: 0,
    highPriority: 0,
    escalated: 0,
  });
  const [alertsPagination, setAlertsPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [alertCurrentPage, setAlertCurrentPage] = useState(1);
  const [alertStatusFilter, setAlertStatusFilter] = useState("");
  const [alertSeverityFilter, setAlertSeverityFilter] = useState("");
  const [alertDoctorFilter, setAlertDoctorFilter] = useState("");
  const [alertEscalatedFilter, setAlertEscalatedFilter] = useState("");
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");

  // Alert Action Modals State
  const [activeModal, setActiveModal] = useState(null); // 'ACKNOWLEDGE' | 'ADD_NOTE' | 'RESOLVE' | 'AUDIT_TRAIL' | null
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [modalInput, setModalInput] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Period Report State
  const defaultStartDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultEndDate = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");

  // History Log with Filters & Pagination
  const [historyItems, setHistoryItems] = useState([]);
  const [doctorFilter, setDoctorFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalPages: 1, totalItems: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  // Holiday Management State
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    type: "LOCAL",
    description: "",
  });
  const [holidaySubmitting, setHolidaySubmitting] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState("");
  const [holidayErr, setHolidayErr] = useState("");

  const assignedCentre = user?.healthCentre;

  // 1. Fetch Today's PHC Summary
  const fetchTodayData = async () => {
    if (!assignedCentre) {
      setError("No health centre assigned to this administrator account.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `http://localhost:5000/api/phc-summary?centre=${encodeURIComponent(assignedCentre)}`,
        { credentials: "include" }
      );

      if (response.status === 401) {
        onLogout();
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load summary");
      }

      setSummary(data);
    } catch (err) {
      console.error("Fetch summary error:", err);
      setError(err.message || "Could not load health centre data");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Alerts Summary & List with Lifecycle Support
  const fetchAlerts = async (page = 1) => {
    if (!assignedCentre) return;

    try {
      setAlertsLoading(true);
      setAlertsError("");

      // Fetch summary stats
      const summaryRes = await fetch("http://localhost:5000/api/alerts/summary", {
        credentials: "include",
      });
      if (summaryRes.status === 401) {
        onLogout();
        return;
      }
      const summaryData = await summaryRes.json();
      if (summaryRes.ok && summaryData.summary) {
        setAlertsSummary(summaryData.summary);
      }

      // Fetch filtered alerts list
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (alertStatusFilter) params.set("status", alertStatusFilter);
      if (alertSeverityFilter) params.set("severity", alertSeverityFilter);
      if (alertDoctorFilter) params.set("doctorEmail", alertDoctorFilter);
      if (alertEscalatedFilter) params.set("escalated", alertEscalatedFilter);

      const alertRes = await fetch(
        `http://localhost:5000/api/alerts?${params.toString()}`,
        { credentials: "include" }
      );

      if (alertRes.status === 401) {
        onLogout();
        return;
      }

      const alertData = await alertRes.json();
      if (!alertRes.ok) {
        throw new Error(alertData.message || "Failed to load alerts");
      }

      setAlerts(alertData.alerts || []);
      setAlertsPagination(alertData.pagination || { page: 1, limit: 10, totalPages: 1, totalItems: 0 });
      setAlertCurrentPage(alertData.pagination?.page || 1);
    } catch (err) {
      console.error("Fetch alerts error:", err);
      setAlertsError(err.message || "Could not load alerts");
    } finally {
      setAlertsLoading(false);
    }
  };

  // 3. Fetch Centre Period Report
  const fetchPeriodReport = async () => {
    if (!assignedCentre) return;

    try {
      setReportLoading(true);
      setReportError("");

      const params = new URLSearchParams();
      params.set("centre", assignedCentre);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(
        `http://localhost:5000/api/reports/centre-attendance?${params.toString()}`,
        { credentials: "include" }
      );

      if (res.status === 401) {
        onLogout();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load centre report");
      }

      setReportData(data);
    } catch (err) {
      console.error("Fetch report error:", err);
      setReportError(err.message || "Could not load report");
    } finally {
      setReportLoading(false);
    }
  };

  // 4. Fetch Centre Attendance History
  const fetchHistory = async (page = 1) => {
    if (!assignedCentre) return;

    try {
      setHistoryLoading(true);
      setHistoryError("");

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (doctorFilter) params.set("doctorEmail", doctorFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(
        `http://localhost:5000/api/attendance/history?${params.toString()}`,
        { credentials: "include" }
      );

      if (res.status === 401) {
        onLogout();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load history records");
      }

      setHistoryItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 15, totalPages: 1, totalItems: 0 });
      setCurrentPage(data.pagination?.page || 1);
    } catch (err) {
      console.error("Fetch history error:", err);
      setHistoryError(err.message || "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // 5. Fetch Holidays
  const fetchHolidays = async () => {
    try {
      setHolidaysLoading(true);
      const res = await fetch("http://localhost:5000/api/holidays", {
        credentials: "include",
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setHolidays(data.holidays || []);
      }
    } catch (err) {
      console.error("Fetch holidays error:", err);
    } finally {
      setHolidaysLoading(false);
    }
  };

  // 6. Create Centre Holiday
  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    setHolidayMsg("");
    setHolidayErr("");

    if (!holidayForm.name || !holidayForm.date) {
      setHolidayErr("Please provide both holiday name and date.");
      return;
    }

    try {
      setHolidaySubmitting(true);
      const res = await fetch("http://localhost:5000/api/holidays", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: holidayForm.name,
          date: holidayForm.date,
          type: holidayForm.type,
          scope: "CENTRE",
          healthCentre: assignedCentre,
          description: holidayForm.description,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create holiday");
      }

      setHolidayMsg("Centre holiday added successfully!");
      setHolidayForm({ name: "", date: "", type: "LOCAL", description: "" });
      fetchHolidays();
      fetchPeriodReport();
      fetchTodayData();
      fetchHistory(currentPage);
    } catch (err) {
      console.error("Create holiday error:", err);
      setHolidayErr(err.message || "Could not create holiday");
    } finally {
      setHolidaySubmitting(false);
    }
  };

  // 7. Delete Centre Holiday
  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm("Are you sure you want to remove this centre holiday?")) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/holidays/${holidayId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete holiday");
      }

      fetchHolidays();
      fetchPeriodReport();
      fetchTodayData();
      fetchHistory(currentPage);
    } catch (err) {
      console.error("Delete holiday error:", err);
      alert(err.message || "Could not delete holiday");
    }
  };

  // Modal Handlers for Alert Actions
  const openModal = (type, alert) => {
    setSelectedAlert(alert);
    setActiveModal(type);
    setModalInput("");
    setModalError("");
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedAlert(null);
    setModalInput("");
    setModalError("");
  };

  const handleAcknowledgeAlert = async (e) => {
    e.preventDefault();
    if (!selectedAlert) return;

    try {
      setModalSubmitting(true);
      setModalError("");

      const res = await fetch(`http://localhost:5000/api/alerts/${selectedAlert._id || selectedAlert.id}/acknowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionNote: modalInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to acknowledge alert");
      }

      closeModal();
      fetchAlerts(alertCurrentPage);
    } catch (err) {
      setModalError(err.message || "Could not acknowledge alert");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!selectedAlert) return;
    if (!modalInput.trim()) {
      setModalError("Please enter note content.");
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError("");

      const res = await fetch(`http://localhost:5000/api/alerts/${selectedAlert._id || selectedAlert.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: modalInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to add note");
      }

      closeModal();
      fetchAlerts(alertCurrentPage);
    } catch (err) {
      setModalError(err.message || "Could not add note");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleResolveAlert = async (e) => {
    e.preventDefault();
    if (!selectedAlert) return;
    if (!modalInput.trim()) {
      setModalError("Please provide a short resolution note (e.g. 'Doctor resumed duty' or 'Approved leave verified').");
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError("");

      const res = await fetch(`http://localhost:5000/api/alerts/${selectedAlert._id || selectedAlert.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resolutionNote: modalInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to resolve alert");
      }

      closeModal();
      fetchAlerts(alertCurrentPage);
    } catch (err) {
      setModalError(err.message || "Could not resolve alert");
    } finally {
      setModalSubmitting(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
    fetchHolidays();
  }, [assignedCentre]);

  useEffect(() => {
    fetchAlerts(1);
  }, [assignedCentre, alertStatusFilter, alertSeverityFilter, alertDoctorFilter, alertEscalatedFilter]);

  useEffect(() => {
    fetchPeriodReport();
    fetchHistory(1);
  }, [assignedCentre, startDate, endDate, doctorFilter, departmentFilter, statusFilter]);

  // Extract unique departments for dropdown
  const departmentOptions = summary?.doctors
    ? Array.from(new Set(summary.doctors.map((d) => d.department).filter(Boolean)))
    : [];

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Health Monitoring System</h2>
          <p>Health Centre Admin Portal</p>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        {loading && (
          <div className="table-card">
            <p>Loading health centre dashboard...</p>
          </div>
        )}

        {!loading && error && (
          <div className="table-card">
            <h2>Unable to Load Centre Data</h2>
            <p className="stat-absent">{error}</p>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <div className="welcome-section">
              <h1>{summary.healthCentre}</h1>
              <p>
                Daily Staff Monitoring Dashboard • {user?.name || "Admin"} ({user?.email || ""})
              </p>
            </div>

            {/* Today's Overview Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <p>Total Doctors</p>
                <h2>{summary.totalDoctors}</h2>
              </div>
              <div className="stat-card">
                <p>Present Today</p>
                <h2 className="stat-present">{summary.present}</h2>
              </div>
              <div className="stat-card">
                <p>Absent Today</p>
                <h2 className="stat-absent">{summary.absent}</h2>
              </div>
              <div className="stat-card">
                <p>Not Marked / Off</p>
                <h2 className="stat-pending">
                  {summary.nonWorking ? `${summary.nonWorking} (Off)` : summary.notMarked}
                </h2>
              </div>
            </div>

            {/* Absenteeism Alert Management & Escalation Section */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <div className="section-header-flex">
                <div>
                  <h2>Absenteeism Alerts & Escalation Management</h2>
                  <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                    Track consecutive missed working days, acknowledge notifications, record administrative notes, and resolve issues.
                  </p>
                </div>
              </div>

              {/* Alert Summary KPI Cards */}
              <div className="stats-grid" style={{ marginTop: "18px" }}>
                <div className="stat-card" style={{ borderLeft: "4px solid #ef4444" }}>
                  <p>Active Alerts</p>
                  <h2 style={{ color: "#b91c1c" }}>{alertsSummary.active}</h2>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #ea580c" }}>
                  <p>High Priority (Critical/High)</p>
                  <h2 style={{ color: "#c2410c" }}>{alertsSummary.highPriority}</h2>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                  <p>Acknowledged</p>
                  <h2 style={{ color: "#d97706" }}>{alertsSummary.acknowledged}</h2>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #7f1d1d" }}>
                  <p>Escalated to DDHS (&gt;24h)</p>
                  <h2 style={{ color: "#7f1d1d" }}>{alertsSummary.escalated}</h2>
                </div>
              </div>

              {/* Alert Filters */}
              <div className="filter-bar" style={{ marginTop: "20px" }}>
                <div className="filter-group">
                  <label>Alert Status</label>
                  <select
                    value={alertStatusFilter}
                    onChange={(e) => setAlertStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Severity</label>
                  <select
                    value={alertSeverityFilter}
                    onChange={(e) => setAlertSeverityFilter(e.target.value)}
                  >
                    <option value="">All Severities</option>
                    <option value="critical">CRITICAL (3+ Days)</option>
                    <option value="high">HIGH (2 Days)</option>
                    <option value="medium">MEDIUM (1 Day)</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Doctor</label>
                  <select
                    value={alertDoctorFilter}
                    onChange={(e) => setAlertDoctorFilter(e.target.value)}
                  >
                    <option value="">All Doctors</option>
                    {summary.doctors.map((d) => (
                      <option key={d.email} value={d.email}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Escalation State</label>
                  <select
                    value={alertEscalatedFilter}
                    onChange={(e) => setAlertEscalatedFilter(e.target.value)}
                  >
                    <option value="">All Alerts</option>
                    <option value="true">Escalated Only</option>
                    <option value="false">Non-Escalated</option>
                  </select>
                </div>
              </div>

              {/* Alerts List Table */}
              {alertsLoading && <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading alerts...</p>}
              {alertsError && <p style={{ color: "#dc2626", marginTop: "15px" }}>{alertsError}</p>}

              {!alertsLoading && !alertsError && alerts.length === 0 && (
                <p style={{ color: "#6b7280", marginTop: "15px" }}>
                  No absenteeism alerts found matching selected criteria.
                </p>
              )}

              {!alertsLoading && !alertsError && alerts.length > 0 && (
                <>
                  <div className="table-wrapper" style={{ marginTop: "15px" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Doctor</th>
                          <th>Consecutive Absence</th>
                          <th>Severity</th>
                          <th>Status</th>
                          <th>Escalation</th>
                          <th>Last Activity / Note</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alerts.map((alert) => {
                          const isResolved = alert.status === "RESOLVED" || alert.resolved;
                          const isAck = alert.status === "ACKNOWLEDGED";
                          return (
                            <tr key={alert._id || alert.id}>
                              <td>
                                <strong>{alert.doctorName}</strong>
                                <br />
                                <span style={{ fontSize: "12px", color: "#64748b" }}>{alert.doctorEmail}</span>
                              </td>
                              <td>
                                <strong>{alert.consecutiveDays}</strong> {alert.consecutiveDays === 1 ? "working day" : "working days"}
                              </td>
                              <td>
                                <span className={`badge-${alert.severity?.toLowerCase() || "medium"}`}>
                                  {alert.severity}
                                </span>
                              </td>
                              <td>
                                <span className={`badge-${(alert.status || "ACTIVE").toLowerCase()}`}>
                                  {alert.status || "ACTIVE"}
                                </span>
                              </td>
                              <td>
                                {alert.isEscalated ? (
                                  <span className="badge-escalated">⚠️ ESCALATED</span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "12px" }}>Normal</span>
                                )}
                              </td>
                              <td>
                                <span style={{ fontSize: "12px", color: "#334155" }}>
                                  {alert.latestActionNote || alert.resolutionNote || alert.message}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                  {!isResolved && !isAck && (
                                    <button
                                      className="alert-action-btn btn-ack"
                                      onClick={() => openModal("ACKNOWLEDGE", alert)}
                                    >
                                      Acknowledge
                                    </button>
                                  )}
                                  {!isResolved && (
                                    <button
                                      className="alert-action-btn btn-note"
                                      onClick={() => openModal("ADD_NOTE", alert)}
                                    >
                                      + Note
                                    </button>
                                  )}
                                  {!isResolved && (
                                    <button
                                      className="alert-action-btn btn-resolve"
                                      onClick={() => openModal("RESOLVE", alert)}
                                    >
                                      Resolve
                                    </button>
                                  )}
                                  <button
                                    className="alert-action-btn btn-detail"
                                    onClick={() => openModal("AUDIT_TRAIL", alert)}
                                  >
                                    History ({alert.actions?.length || 1})
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination-bar">
                    <span>
                      Page {alertsPagination.page} of {alertsPagination.totalPages || 1} ({alertsPagination.totalItems} total alerts)
                    </span>
                    <div className="pagination-buttons">
                      <button
                        disabled={alertCurrentPage <= 1}
                        onClick={() => fetchAlerts(alertCurrentPage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        disabled={alertCurrentPage >= alertsPagination.totalPages}
                        onClick={() => fetchAlerts(alertCurrentPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Today's Doctor Attendance Table */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>Today's Doctor Attendance ({summary.date})</h2>

              {summary.doctors.length === 0 ? (
                <p>No doctors found for this health centre.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.doctors.map((doctor) => (
                        <tr key={doctor.id}>
                          <td><strong>{doctor.name}</strong></td>
                          <td>{doctor.email}</td>
                          <td>{doctor.department}</td>
                          <td>
                            <span
                              className={`status-badge ${doctor.status
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            >
                              {doctor.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Period Attendance Report Section */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>Attendance Reports & Analytics</h2>
              <p style={{ margin: "4px 0 15px", color: "#6b7280" }}>
                Comprehensive attendance aggregation for {summary.healthCentre} (excludes non-working days from percentage denominator)
              </p>

              {/* Date Filters */}
              <div className="filter-bar">
                <div className="filter-group">
                  <label>From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label>To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {reportLoading && <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading report...</p>}
              {reportError && <p style={{ color: "#dc2626", marginTop: "15px" }}>{reportError}</p>}

              {!reportLoading && !reportError && reportData && (
                <>
                  <div className="stats-grid" style={{ marginTop: "15px" }}>
                    <div className="stat-card">
                      <p>Total Working Days</p>
                      <h2>{reportData.eligibleWorkingDays || reportData.eligibleDays}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Present (Working)</p>
                      <h2 className="stat-present">{reportData.presentWorking !== undefined ? reportData.presentWorking : reportData.present}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Absent</p>
                      <h2 className="stat-absent">{reportData.absent}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Working-Day Attendance %</p>
                      <h2 className="stat-present">{reportData.attendancePercentage}%</h2>
                    </div>
                  </div>

                  {/* Doctor-wise Summary */}
                  <h3 style={{ marginTop: "25px", color: "#183153" }}>Doctor-wise Summary</h3>
                  {reportData.doctorSummary.length === 0 ? (
                    <p style={{ color: "#6b7280" }}>No doctor records found.</p>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Doctor</th>
                            <th>Department</th>
                            <th>Present (Work)</th>
                            <th>Absent</th>
                            <th>Non-Working</th>
                            <th>Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.doctorSummary.map((doc) => (
                            <tr key={doc.id || doc.email}>
                              <td><strong>{doc.name}</strong></td>
                              <td>{doc.department}</td>
                              <td className="table-present">{doc.presentWorkingDays !== undefined ? doc.presentWorkingDays : doc.presentDays}</td>
                              <td className="table-absent">{doc.absentDays}</td>
                              <td>{doc.nonWorkingDays || 0}</td>
                              <td>
                                <strong>{doc.attendancePercentage}%</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Department Summary */}
                  {reportData.departmentSummary && reportData.departmentSummary.length > 0 && (
                    <>
                      <h3 style={{ marginTop: "25px", color: "#183153" }}>Department Summary</h3>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Department</th>
                              <th>Doctors</th>
                              <th>Present (Work)</th>
                              <th>Absent</th>
                              <th>Attendance %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.departmentSummary.map((dept) => (
                              <tr key={dept.department}>
                                <td><strong>{dept.department}</strong></td>
                                <td>{dept.totalDoctors}</td>
                                <td className="table-present">{dept.presentWorkingDays !== undefined ? dept.presentWorkingDays : dept.presentDays}</td>
                                <td className="table-absent">{dept.absentDays}</td>
                                <td><strong>{dept.attendancePercentage}%</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Centre Holiday & Working-Day Management Section */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <div className="section-header-flex">
                <div>
                  <h2>Health Centre Holidays & Off-Days</h2>
                  <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                    Manage centre-specific local holidays and view district-wide public holidays
                  </p>
                </div>
              </div>

              {/* Add Centre Holiday Form */}
              <form
                onSubmit={handleCreateHoliday}
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ margin: "0 0 12px", color: "#183153" }}>Add Centre-Specific Holiday</h4>
                <div className="filter-bar" style={{ margin: 0, padding: 0, background: "none", border: "none" }}>
                  <div className="filter-group">
                    <label>Holiday Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Centre Maintenance Day"
                      value={holidayForm.name}
                      onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="filter-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      value={holidayForm.date}
                      onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="filter-group">
                    <label>Type</label>
                    <select
                      value={holidayForm.type}
                      onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                    >
                      <option value="LOCAL">LOCAL</option>
                      <option value="SPECIAL">SPECIAL</option>
                      <option value="PUBLIC">PUBLIC</option>
                      <option value="STATE">STATE</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Description (Optional)</label>
                    <input
                      type="text"
                      placeholder="Optional notes"
                      value={holidayForm.description}
                      onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    className="attendance-btn"
                    style={{ marginTop: 0, height: "42px", alignSelf: "flex-end" }}
                    disabled={holidaySubmitting}
                  >
                    {holidaySubmitting ? "Adding..." : "+ Add Holiday"}
                  </button>
                </div>

                {holidayMsg && <p style={{ color: "#16a34a", margin: "10px 0 0", fontSize: "14px" }}>{holidayMsg}</p>}
                {holidayErr && <p style={{ color: "#dc2626", margin: "10px 0 0", fontSize: "14px" }}>{holidayErr}</p>}
              </form>

              {/* Holiday List Table */}
              <div style={{ marginTop: "20px" }}>
                <h4 style={{ margin: "0 0 10px", color: "#183153" }}>Applicable Holidays</h4>
                {holidaysLoading ? (
                  <p style={{ color: "#6b7280" }}>Loading holidays...</p>
                ) : holidays.length === 0 ? (
                  <p style={{ color: "#6b7280" }}>No holidays currently registered.</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Holiday Name</th>
                          <th>Type</th>
                          <th>Scope</th>
                          <th>Description</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holidays.map((h) => {
                          const isCentreOwned = h.scope === "CENTRE" && h.healthCentre === assignedCentre;
                          return (
                            <tr key={h._id || `${h.date}_${h.name}`}>
                              <td><strong>{h.date}</strong></td>
                              <td>{h.name}</td>
                              <td><span className="holiday-badge">{h.type || "PUBLIC"}</span></td>
                              <td>
                                <span className="scope-badge">
                                  {h.scope === "CENTRE" ? `Centre (${h.healthCentre})` : "District-wide"}
                                </span>
                              </td>
                              <td>{h.description || "-"}</td>
                              <td>
                                {isCentreOwned ? (
                                  <button
                                    onClick={() => handleDeleteHoliday(h._id)}
                                    style={{
                                      background: "#fee2e2",
                                      color: "#991b1b",
                                      border: "1px solid #fca5a5",
                                      padding: "4px 10px",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <span style={{ color: "#9ca3af", fontSize: "12px" }}>District Policy</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Attendance History Log */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>Detailed Attendance Log</h2>

              {/* Filter controls */}
              <div className="filter-bar">
                <div className="filter-group">
                  <label>Doctor</label>
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                  >
                    <option value="">All Doctors</option>
                    {summary.doctors.map((d) => (
                      <option key={d.email} value={d.email}>
                        {d.name} ({d.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Department</label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Non-Working Day">Non-Working Day</option>
                    <option value="Not Marked">Not Marked</option>
                  </select>
                </div>
              </div>

              {historyLoading && (
                <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading logs...</p>
              )}
              {historyError && (
                <p style={{ color: "#dc2626", marginTop: "15px" }}>{historyError}</p>
              )}

              {!historyLoading && !historyError && historyItems.length === 0 && (
                <p style={{ color: "#6b7280", marginTop: "15px" }}>
                  No attendance records found for the selected filters.
                </p>
              )}

              {!historyLoading && !historyError && historyItems.length > 0 && (
                <>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Doctor</th>
                          <th>Department</th>
                          <th>Status</th>
                          <th>Marked Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map((item) => (
                          <tr key={item.id || `${item.doctorEmail}_${item.date}`}>
                            <td><strong>{item.date}</strong></td>
                            <td>{item.doctorName}</td>
                            <td>{item.department}</td>
                            <td>
                              <span
                                className={`status-badge ${item.status
                                  .toLowerCase()
                                  .replace(/\s+/g, "-")}`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td>
                              {item.markedAt
                                ? new Date(item.markedAt).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination-bar">
                    <span>
                      Page {pagination.page} of {pagination.totalPages || 1} ({pagination.totalItems} total logs)
                    </span>
                    <div className="pagination-buttons">
                      <button
                        disabled={currentPage <= 1}
                        onClick={() => fetchHistory(currentPage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        disabled={currentPage >= pagination.totalPages}
                        onClick={() => fetchHistory(currentPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* Action Modals */}
      {activeModal && selectedAlert && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            {activeModal === "ACKNOWLEDGE" && (
              <form onSubmit={handleAcknowledgeAlert}>
                <div className="modal-header">
                  <h3>Acknowledge Alert</h3>
                  <button type="button" className="modal-close-btn" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <p>
                    Acknowledge absenteeism alert for <strong>{selectedAlert.doctorName}</strong> ({selectedAlert.consecutiveDays} missed working days).
                  </p>
                  <div className="filter-group" style={{ marginTop: "12px" }}>
                    <label>Action Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Contacted doctor for clarification"
                      value={modalInput}
                      onChange={(e) => setModalInput(e.target.value)}
                    />
                  </div>
                  {modalError && <p style={{ color: "#dc2626", marginTop: "10px" }}>{modalError}</p>}
                </div>
                <div className="modal-footer">
                  <button type="button" className="alert-action-btn btn-detail" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="alert-action-btn btn-ack" disabled={modalSubmitting}>
                    {modalSubmitting ? "Acknowledging..." : "Confirm Acknowledgment"}
                  </button>
                </div>
              </form>
            )}

            {activeModal === "ADD_NOTE" && (
              <form onSubmit={handleAddNote}>
                <div className="modal-header">
                  <h3>Add Administrative Note</h3>
                  <button type="button" className="modal-close-btn" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <p>
                    Record an action or note for <strong>{selectedAlert.doctorName}</strong> without changing alert status.
                  </p>
                  <div className="filter-group" style={{ marginTop: "12px" }}>
                    <label>Note Content *</label>
                    <textarea
                      rows={3}
                      style={{
                        padding: "10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontFamily: "inherit",
                        fontSize: "14px",
                      }}
                      placeholder="e.g. Called doctor, requested explanation for absence."
                      value={modalInput}
                      onChange={(e) => setModalInput(e.target.value)}
                      required
                    />
                  </div>
                  {modalError && <p style={{ color: "#dc2626", marginTop: "10px" }}>{modalError}</p>}
                </div>
                <div className="modal-footer">
                  <button type="button" className="alert-action-btn btn-detail" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="alert-action-btn btn-note" disabled={modalSubmitting}>
                    {modalSubmitting ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </form>
            )}

            {activeModal === "RESOLVE" && (
              <form onSubmit={handleResolveAlert}>
                <div className="modal-header">
                  <h3>Resolve Alert</h3>
                  <button type="button" className="modal-close-btn" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <p>
                    Resolve absence alert for <strong>{selectedAlert.doctorName}</strong>. Please specify the resolution reason.
                  </p>
                  <div className="filter-group" style={{ marginTop: "12px" }}>
                    <label>Resolution Note *</label>
                    <input
                      type="text"
                      placeholder="e.g. Doctor resumed duty / Approved leave verified"
                      value={modalInput}
                      onChange={(e) => setModalInput(e.target.value)}
                      required
                    />
                  </div>
                  {modalError && <p style={{ color: "#dc2626", marginTop: "10px" }}>{modalError}</p>}
                </div>
                <div className="modal-footer">
                  <button type="button" className="alert-action-btn btn-detail" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="alert-action-btn btn-resolve" disabled={modalSubmitting}>
                    {modalSubmitting ? "Resolving..." : "Confirm Resolution"}
                  </button>
                </div>
              </form>
            )}

            {activeModal === "AUDIT_TRAIL" && (
              <div>
                <div className="modal-header">
                  <h3>Alert History & Audit Trail</h3>
                  <button type="button" className="modal-close-btn" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <div style={{ marginBottom: "16px", padding: "12px", background: "#f1f5f9", borderRadius: "8px" }}>
                    <h4 style={{ margin: "0 0 6px", color: "#183153" }}>{selectedAlert.doctorName}</h4>
                    <p style={{ margin: "0", fontSize: "13px", color: "#475569" }}>
                      Centre: <strong>{selectedAlert.healthCentre}</strong> • Streak: <strong>{selectedAlert.consecutiveDays} days</strong> • Status: <span className={`badge-${(selectedAlert.status || "ACTIVE").toLowerCase()}`}>{selectedAlert.status || "ACTIVE"}</span>
                    </p>
                  </div>

                  <h4 style={{ margin: "0 0 10px", color: "#183153" }}>Action Timeline</h4>
                  <div className="audit-timeline">
                    {(selectedAlert.actions && selectedAlert.actions.length > 0 ? selectedAlert.actions : [
                      {
                        action: "CREATED",
                        performedBy: "system",
                        role: "system",
                        note: selectedAlert.message,
                        timestamp: selectedAlert.createdAt,
                      },
                    ]).map((entry, idx) => (
                      <div className="timeline-item" key={entry._id || idx}>
                        <div className={`timeline-dot ${entry.action.toLowerCase()}`} />
                        <div className="timeline-content">
                          <div className="timeline-meta">
                            <span className="timeline-action-tag">{entry.action}</span>
                            <span>{new Date(entry.timestamp).toLocaleString("en-IN")}</span>
                          </div>
                          <p className="timeline-note">{entry.note || "-"}</p>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            By: {entry.performedBy} ({entry.role})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="alert-action-btn btn-detail" onClick={closeModal}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CentreAdminDashboard;