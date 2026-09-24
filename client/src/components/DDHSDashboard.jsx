import { useEffect, useState } from "react";

function DDHSDashboard({ user, onLogout }) {
  // Today's data
  const [data, setData] = useState(null);
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
  const [alertCentreFilter, setAlertCentreFilter] = useState("");
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

  // District Period Report
  const defaultStartDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultEndDate = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [centreFilter, setCentreFilter] = useState("");
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");

  // History Log with Filters & Pagination
  const [historyItems, setHistoryItems] = useState([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState("");
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
    type: "PUBLIC",
    scope: "DISTRICT",
    healthCentre: "",
    description: "",
  });
  const [holidaySubmitting, setHolidaySubmitting] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState("");
  const [holidayErr, setHolidayErr] = useState("");

  // 1. Fetch Today's Overview
  const fetchTodayOverview = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://localhost:5000/api/ddhs/overview", {
        credentials: "include",
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to load division overview");
      }

      setData(result);
    } catch (err) {
      console.error("Fetch DDHS overview error:", err);
      setError(err.message || "Could not load division overview data");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Division Alerts & Summary with Lifecycle Support
  const fetchAlerts = async (page = 1) => {
    try {
      setAlertsLoading(true);
      setAlertsError("");

      // Fetch summary stats
      const summaryUrl = alertCentreFilter
        ? `http://localhost:5000/api/alerts/summary?centre=${encodeURIComponent(alertCentreFilter)}`
        : "http://localhost:5000/api/alerts/summary";

      const summaryRes = await fetch(summaryUrl, { credentials: "include" });
      if (summaryRes.status === 401) {
        onLogout();
        return;
      }
      const summaryData = await summaryRes.json();
      if (summaryRes.ok && summaryData.summary) {
        setAlertsSummary(summaryData.summary);
      }

      // Fetch filtered alerts
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (alertCentreFilter) params.set("healthCentre", alertCentreFilter);
      if (alertStatusFilter) params.set("status", alertStatusFilter);
      if (alertSeverityFilter) params.set("severity", alertSeverityFilter);
      if (alertDoctorFilter) params.set("doctorEmail", alertDoctorFilter);
      if (alertEscalatedFilter) params.set("escalated", alertEscalatedFilter);

      const alertRes = await fetch(`http://localhost:5000/api/alerts?${params.toString()}`, {
        credentials: "include",
      });

      if (alertRes.status === 401) {
        onLogout();
        return;
      }

      const alertData = await alertRes.json();
      if (!alertRes.ok) {
        throw new Error(alertData.message || "Failed to load division alerts");
      }

      setAlerts(alertData.alerts || []);
      setAlertsPagination(alertData.pagination || { page: 1, limit: 10, totalPages: 1, totalItems: 0 });
      setAlertCurrentPage(alertData.pagination?.page || 1);
    } catch (err) {
      console.error("Fetch DDHS alerts error:", err);
      setAlertsError(err.message || "Could not load alerts");
    } finally {
      setAlertsLoading(false);
    }
  };

  // 3. Fetch District Period Report
  const fetchDistrictReport = async () => {
    try {
      setReportLoading(true);
      setReportError("");

      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (centreFilter) params.set("centre", centreFilter);

      const res = await fetch(
        `http://localhost:5000/api/reports/ddhs-attendance?${params.toString()}`,
        { credentials: "include" }
      );

      if (res.status === 401) {
        onLogout();
        return;
      }

      const reportResult = await res.json();
      if (!res.ok) {
        throw new Error(reportResult.message || "Failed to load district report");
      }

      setReportData(reportResult);
    } catch (err) {
      console.error("Fetch district report error:", err);
      setReportError(err.message || "Could not load district report");
    } finally {
      setReportLoading(false);
    }
  };

  // 4. Fetch Division Attendance History
  const fetchDivisionHistory = async (page = 1) => {
    try {
      setHistoryLoading(true);
      setHistoryError("");

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (centreFilter) params.set("healthCentre", centreFilter);
      if (historyStatusFilter) params.set("status", historyStatusFilter);

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
        throw new Error(data.message || "Failed to load division history");
      }

      setHistoryItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 15, totalPages: 1, totalItems: 0 });
      setCurrentPage(data.pagination?.page || 1);
    } catch (err) {
      console.error("Fetch division history error:", err);
      setHistoryError(err.message || "Could not load division history");
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

      const holidayData = await res.json();
      if (res.ok) {
        setHolidays(holidayData.holidays || []);
      }
    } catch (err) {
      console.error("Fetch holidays error:", err);
    } finally {
      setHolidaysLoading(false);
    }
  };

  // 6. Create Holiday
  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    setHolidayMsg("");
    setHolidayErr("");

    if (!holidayForm.name || !holidayForm.date) {
      setHolidayErr("Please provide holiday name and date.");
      return;
    }

    if (holidayForm.scope === "CENTRE" && !holidayForm.healthCentre) {
      setHolidayErr("Please specify target health centre for centre-specific holiday.");
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
          scope: holidayForm.scope,
          healthCentre: holidayForm.scope === "CENTRE" ? holidayForm.healthCentre : undefined,
          description: holidayForm.description,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Failed to create holiday");
      }

      setHolidayMsg("Holiday created successfully!");
      setHolidayForm({
        name: "",
        date: "",
        type: "PUBLIC",
        scope: "DISTRICT",
        healthCentre: "",
        description: "",
      });
      fetchHolidays();
      fetchDistrictReport();
      fetchTodayOverview();
      fetchDivisionHistory(currentPage);
    } catch (err) {
      console.error("Create holiday error:", err);
      setHolidayErr(err.message || "Could not create holiday");
    } finally {
      setHolidaySubmitting(false);
    }
  };

  // 7. Delete Holiday
  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm("Are you sure you want to remove this holiday?")) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/holidays/${holidayId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Failed to delete holiday");
      }

      fetchHolidays();
      fetchDistrictReport();
      fetchTodayOverview();
      fetchDivisionHistory(currentPage);
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
      setModalError("Please provide a short resolution note (e.g. 'DDHS office approved leave' or 'Issue resolved').");
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
    fetchTodayOverview();
    fetchHolidays();
  }, []);

  useEffect(() => {
    fetchAlerts(1);
  }, [alertCentreFilter, alertStatusFilter, alertSeverityFilter, alertDoctorFilter, alertEscalatedFilter]);

  useEffect(() => {
    fetchDistrictReport();
    fetchDivisionHistory(1);
  }, [startDate, endDate, centreFilter, historyStatusFilter]);

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Health Monitoring System</h2>
          <p>DDHS Division Portal</p>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        {loading && (
          <div className="table-card">
            <p>Loading division dashboard...</p>
          </div>
        )}

        {!loading && error && (
          <div className="table-card">
            <h2>Unable to Load Division Overview</h2>
            <p className="stat-absent">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="welcome-section">
              <h1>Division Attendance Overview</h1>
              <p>
                Directorate of Health Services • Monitoring {data.totals.activeHealthCentres} Health Centres ({data.date})
              </p>
            </div>

            {/* Division Total Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <p>Total Doctors</p>
                <h2>{data.totals.totalDoctors}</h2>
              </div>
              <div className="stat-card">
                <p>Present Today</p>
                <h2 className="stat-present">{data.totals.present}</h2>
              </div>
              <div className="stat-card">
                <p>Absent Today</p>
                <h2 className="stat-absent">{data.totals.absent}</h2>
              </div>
              <div className="stat-card">
                <p>Not Marked / Off</p>
                <h2 className="stat-pending">
                  {data.totals.nonWorking
                    ? `${data.totals.nonWorking} (Off)`
                    : data.totals.notMarked}
                </h2>
              </div>
            </div>

            {/* Division-wide Absenteeism Alerts & Escalation Management */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <div className="section-header-flex">
                <div>
                  <h2>Division Absenteeism Alerts & Escalation Management</h2>
                  <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                    Division-wide supervision of doctor absenteeism, administrative notes, and urgent escalated cases (&gt;24 hours).
                  </p>
                </div>
              </div>

              {/* Alert Summary KPI Cards */}
              <div className="stats-grid" style={{ marginTop: "18px" }}>
                <div className="stat-card" style={{ borderLeft: "4px solid #ef4444" }}>
                  <p>Total Active Alerts</p>
                  <h2 style={{ color: "#b91c1c" }}>{alertsSummary.active}</h2>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #ea580c" }}>
                  <p>High Priority (Critical/High)</p>
                  <h2 style={{ color: "#c2410c" }}>{alertsSummary.highPriority}</h2>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #7f1d1d" }}>
                  <p>Escalated to DDHS (&gt;24h)</p>
                  <h2 style={{ color: "#7f1d1d" }}>{alertsSummary.escalated}</h2>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                  <p>Acknowledged</p>
                  <h2 style={{ color: "#d97706" }}>{alertsSummary.acknowledged}</h2>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #16a34a" }}>
                  <p>Resolved</p>
                  <h2 style={{ color: "#15803d" }}>{alertsSummary.resolved}</h2>
                </div>
              </div>

              {/* Division Alert Filters */}
              <div className="filter-bar" style={{ marginTop: "20px" }}>
                <div className="filter-group">
                  <label>Health Centre</label>
                  <select
                    value={alertCentreFilter}
                    onChange={(e) => setAlertCentreFilter(e.target.value)}
                  >
                    <option value="">All Health Centres</option>
                    {(data?.centres || []).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

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
                  <label>Escalation State</label>
                  <select
                    value={alertEscalatedFilter}
                    onChange={(e) => setAlertEscalatedFilter(e.target.value)}
                  >
                    <option value="">All Alerts</option>
                    <option value="true">⚠️ Escalated to DDHS Only</option>
                    <option value="false">Non-Escalated</option>
                  </select>
                </div>
              </div>

              {/* Alerts List Table */}
              {alertsLoading && <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading division alerts...</p>}
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
                          <th>Health Centre</th>
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
                                <strong>{alert.healthCentre}</strong>
                              </td>
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

            {/* Centre Breakdown Table */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>Health Centre Status Breakdown</h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Health Centre</th>
                      <th>Type</th>
                      <th>District</th>
                      <th>Total Staff</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Not Marked / Off</th>
                      <th>Rate %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.centres || []).map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.type}</td>
                        <td>{c.district}</td>
                        <td>{c.totalDoctors}</td>
                        <td className="table-present">{c.present}</td>
                        <td className="table-absent">{c.absent}</td>
                        <td>{c.nonWorking ? `${c.nonWorking} (Off)` : c.notMarked}</td>
                        <td>
                          <strong>{c.attendancePercentage}%</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* District Attendance Report Section */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>District Attendance Reports & Analytics</h2>
              <p style={{ margin: "4px 0 15px", color: "#6b7280" }}>
                Multi-centre analytics aggregated across eligible working days (excludes weekends and holidays)
              </p>

              {/* Filters */}
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

                <div className="filter-group">
                  <label>Filter by Health Centre</label>
                  <select
                    value={centreFilter}
                    onChange={(e) => setCentreFilter(e.target.value)}
                  >
                    <option value="">All Health Centres</option>
                    {(data?.centres || []).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {reportLoading && <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading report...</p>}
              {reportError && <p style={{ color: "#dc2626", marginTop: "15px" }}>{reportError}</p>}

              {!reportLoading && !reportError && reportData && (
                <>
                  <div className="stats-grid" style={{ marginTop: "15px" }}>
                    <div className="stat-card">
                      <p>Total Working Days</p>
                      <h2>
                        {reportData.overallStats?.eligibleWorkingDays ??
                          reportData.eligibleWorkingDays ??
                          reportData.eligibleDays ??
                          0}
                      </h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Present (Working)</p>
                      <h2 className="stat-present">
                        {reportData.overallStats?.presentWorking !== undefined
                          ? reportData.overallStats.presentWorking
                          : (reportData.presentWorking !== undefined
                              ? reportData.presentWorking
                              : reportData.present ?? 0)}
                      </h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Absent</p>
                      <h2 className="stat-absent">
                        {reportData.overallStats?.absent !== undefined
                          ? reportData.overallStats.absent
                          : (reportData.absent ?? 0)}
                      </h2>
                    </div>
                    <div className="stat-card">
                      <p>Division Attendance %</p>
                      <h2 className="stat-present">
                        {reportData.overallStats?.attendancePercentage !== undefined
                          ? reportData.overallStats.attendancePercentage
                          : (reportData.attendancePercentage ?? 0)}%
                      </h2>
                    </div>
                  </div>

                  {/* Centre-wise Performance Table */}
                  <h3 style={{ marginTop: "25px", color: "#183153" }}>Centre Performance Summary</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Health Centre</th>
                          <th>Total Staff</th>
                          <th>Present (Work)</th>
                          <th>Absent</th>
                          <th>Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.centreComparison || reportData.centreSummary || []).map((cs) => (
                          <tr key={cs.id || cs.name || cs.centreName}>
                            <td><strong>{cs.name || cs.centreName}</strong></td>
                            <td>{cs.totalDoctors ?? 0}</td>
                            <td className="table-present">
                              {cs.presentWorking !== undefined
                                ? cs.presentWorking
                                : (cs.presentWorkingDays !== undefined
                                    ? cs.presentWorkingDays
                                    : cs.presentDays ?? cs.present ?? 0)}
                            </td>
                            <td className="table-absent">
                              {cs.absent !== undefined ? cs.absent : (cs.absentDays ?? 0)}
                            </td>
                            <td>
                              <strong>{cs.attendancePercentage ?? 0}%</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Division-Wide Holiday Management Section */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <div className="section-header-flex">
                <div>
                  <h2>Division & Centre Holiday Policies</h2>
                  <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                    Configure district-wide public holidays and centre-specific off-days
                  </p>
                </div>
              </div>

              {/* Add Holiday Form */}
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
                <h4 style={{ margin: "0 0 12px", color: "#183153" }}>Register New Holiday</h4>
                <div className="filter-bar" style={{ margin: 0, padding: 0, background: "none", border: "none" }}>
                  <div className="filter-group">
                    <label>Holiday Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Republic Day"
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
                    <label>Scope</label>
                    <select
                      value={holidayForm.scope}
                      onChange={(e) => setHolidayForm({ ...holidayForm, scope: e.target.value })}
                    >
                      <option value="DISTRICT">DISTRICT (All Centres)</option>
                      <option value="CENTRE">CENTRE Specific</option>
                    </select>
                  </div>

                  {holidayForm.scope === "CENTRE" && (
                    <div className="filter-group">
                      <label>Target Centre *</label>
                      <select
                        value={holidayForm.healthCentre}
                        onChange={(e) => setHolidayForm({ ...holidayForm, healthCentre: e.target.value })}
                        required
                      >
                        <option value="">Select Centre</option>
                        {(data?.centres || []).map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="filter-group">
                    <label>Type</label>
                    <select
                      value={holidayForm.type}
                      onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                    >
                      <option value="PUBLIC">PUBLIC</option>
                      <option value="STATE">STATE</option>
                      <option value="LOCAL">LOCAL</option>
                      <option value="SPECIAL">SPECIAL</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Description (Optional)</label>
                    <input
                      type="text"
                      placeholder="Description"
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
                <h4 style={{ margin: "0 0 10px", color: "#183153" }}>Registered Holidays</h4>
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
                        {holidays.map((h) => (
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Division Detailed Attendance History Log */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>Division Attendance Logs</h2>

              {/* Filter controls */}
              <div className="filter-bar">
                <div className="filter-group">
                  <label>Health Centre</label>
                  <select
                    value={centreFilter}
                    onChange={(e) => setCentreFilter(e.target.value)}
                  >
                    <option value="">All Health Centres</option>
                    {(data?.centres || []).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Status</label>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
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
                <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading division logs...</p>
              )}
              {historyError && (
                <p style={{ color: "#dc2626", marginTop: "15px" }}>{historyError}</p>
              )}

              {!historyLoading && !historyError && historyItems.length === 0 && (
                <p style={{ color: "#6b7280", marginTop: "15px" }}>
                  No attendance records found for the selected criteria.
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
                          <th>Health Centre</th>
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
                            <td>{item.healthCentre}</td>
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
                        onClick={() => fetchDivisionHistory(currentPage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        disabled={currentPage >= pagination.totalPages}
                        onClick={() => fetchDivisionHistory(currentPage + 1)}
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
                  <h3>Acknowledge Alert (DDHS)</h3>
                  <button type="button" className="modal-close-btn" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <p>
                    Acknowledge absenteeism alert for <strong>{selectedAlert.doctorName}</strong> at <strong>{selectedAlert.healthCentre}</strong> ({selectedAlert.consecutiveDays} missed working days).
                  </p>
                  <div className="filter-group" style={{ marginTop: "12px" }}>
                    <label>Action Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Noted by DDHS office; contacted centre admin"
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
                  <h3>Add Administrative Note (DDHS)</h3>
                  <button type="button" className="modal-close-btn" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <p>
                    Record a note or directive for <strong>{selectedAlert.doctorName}</strong> ({selectedAlert.healthCentre}) without closing the alert.
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
                      placeholder="e.g. Requested status update from PHC Medical Officer Incharge."
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
                  <h3>Resolve Alert (DDHS)</h3>
                  <button type="button" className="modal-close-btn" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <p>
                    Resolve absence alert for <strong>{selectedAlert.doctorName}</strong> ({selectedAlert.healthCentre}). Please specify the resolution reason.
                  </p>
                  <div className="filter-group" style={{ marginTop: "12px" }}>
                    <label>Resolution Note *</label>
                    <input
                      type="text"
                      placeholder="e.g. Duty resumed / Deputation approved / Administrative issue settled"
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

export default DDHSDashboard;