import { useEffect, useState } from "react";

function CentreAdminDashboard({ user, onLogout }) {
  // Today's summary
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Absenteeism alerts
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");

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

  const assignedCentre = user?.healthCentre;

  // 1. Fetch Today's PHC Summary and Alerts
  const fetchTodayData = async () => {
    if (!assignedCentre) {
      setError("No health centre assigned to this administrator account.");
      setLoading(false);
      setAlertsLoading(false);
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

    try {
      setAlertsLoading(true);
      setAlertsError("");

      const alertRes = await fetch(
        `http://localhost:5000/api/alerts/centre?centre=${encodeURIComponent(assignedCentre)}`,
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
    } catch (err) {
      console.error("Fetch alerts error:", err);
      setAlertsError(err.message || "Could not load alerts");
    } finally {
      setAlertsLoading(false);
    }
  };

  // 2. Fetch Centre Period Report
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

  // 3. Fetch Centre Attendance History
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

  useEffect(() => {
    fetchTodayData();
  }, [assignedCentre]);

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
                <p>Not Marked Today</p>
                <h2 className="stat-pending">{summary.notMarked}</h2>
              </div>
            </div>

            {/* Today's Doctor Attendance Table */}
            <div className="table-card">
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
                Comprehensive attendance aggregation for {summary.healthCentre}
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
                      <p>Total Days in Period</p>
                      <h2>{reportData.totalDays}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Present</p>
                      <h2 className="stat-present">{reportData.present}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Absent</p>
                      <h2 className="stat-absent">{reportData.absent}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Period Attendance %</p>
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
                            <th>Present Days</th>
                            <th>Absent Days</th>
                            <th>Not Marked</th>
                            <th>Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.doctorSummary.map((doc) => (
                            <tr key={doc.id || doc.email}>
                              <td><strong>{doc.name}</strong></td>
                              <td>{doc.department}</td>
                              <td className="table-present">{doc.presentDays}</td>
                              <td className="table-absent">{doc.absentDays}</td>
                              <td>{doc.notMarkedDays}</td>
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
                              <th>Present Days</th>
                              <th>Absent Days</th>
                              <th>Attendance %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.departmentSummary.map((dept) => (
                              <tr key={dept.department}>
                                <td><strong>{dept.department}</strong></td>
                                <td>{dept.totalDoctors}</td>
                                <td className="table-present">{dept.presentDays}</td>
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

            {/* Absenteeism Alerts Card */}
            <div className="alerts-card" style={{ marginTop: "30px" }}>
              <div className="alerts-heading">
                <h2>Absenteeism Alerts</h2>
                <span>{alerts.length} Active</span>
              </div>

              {alertsLoading && (
                <p style={{ marginTop: "15px", color: "#6b7280" }}>Loading alerts...</p>
              )}
              {!alertsLoading && alertsError && (
                <p style={{ marginTop: "15px", color: "#dc2626" }}>{alertsError}</p>
              )}
              {!alertsLoading && !alertsError && alerts.length === 0 && (
                <p style={{ marginTop: "15px", color: "#6b7280" }}>No active absenteeism alerts</p>
              )}

              {!alertsLoading && !alertsError && alerts.length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  {alerts.map((alert) => (
                    <div className="alert-item" key={alert._id || alert.id}>
                      <div>
                        <h3>{alert.doctorName}</h3>
                        <p>
                          {alert.message} • {alert.consecutiveDays}{" "}
                          {alert.consecutiveDays === 1 ? "day" : "days"} absence
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <strong
                          style={{
                            color:
                              alert.severity === "critical"
                                ? "#dc2626"
                                : alert.severity === "high"
                                ? "#ea580c"
                                : "#d97706",
                            textTransform: "uppercase",
                            fontSize: "13px",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {alert.severity}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default CentreAdminDashboard;