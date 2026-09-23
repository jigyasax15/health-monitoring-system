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

  // 4. Fetch Holidays
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

  // 5. Create Centre Holiday
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

  // 6. Delete Centre Holiday
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

  useEffect(() => {
    fetchTodayData();
    fetchHolidays();
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
                <p>Not Marked / Off</p>
                <h2 className="stat-pending">
                  {summary.nonWorking ? `${summary.nonWorking} (Off)` : summary.notMarked}
                </h2>
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
                          {alert.consecutiveDays === 1 ? "working day" : "working days"} absence
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