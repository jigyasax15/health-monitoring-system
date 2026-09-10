import { useEffect, useState } from "react";

function DDHSDashboard({ user, onLogout }) {
  // Today's data
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Division alerts
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");

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

  // 1. Fetch Today's Overview & Alerts
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

    try {
      setAlertsLoading(true);
      setAlertsError("");

      const alertRes = await fetch("http://localhost:5000/api/ddhs/alerts", {
        credentials: "include",
      });

      if (alertRes.status === 401) {
        onLogout();
        return;
      }

      const alertResult = await alertRes.json();
      if (!alertRes.ok) {
        throw new Error(alertResult.message || "Failed to load alerts");
      }

      setAlerts(alertResult.alerts || []);
    } catch (err) {
      console.error("Fetch DDHS alerts error:", err);
      setAlertsError(err.message || "Could not load alerts");
    } finally {
      setAlertsLoading(false);
    }
  };

  // 2. Fetch District Period Report
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

  // 3. Fetch Division Attendance History
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

      const dataResult = await res.json();
      if (!res.ok) {
        throw new Error(dataResult.message || "Failed to load history");
      }

      setHistoryItems(dataResult.items || []);
      setPagination(dataResult.pagination || { page: 1, limit: 15, totalPages: 1, totalItems: 0 });
      setCurrentPage(dataResult.pagination?.page || 1);
    } catch (err) {
      console.error("Fetch division history error:", err);
      setHistoryError(err.message || "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayOverview();
  }, []);

  useEffect(() => {
    fetchDistrictReport();
    fetchDivisionHistory(1);
  }, [startDate, endDate, centreFilter, historyStatusFilter]);

  const totals = data?.totals || {
    activeHealthCentres: 0,
    totalDoctors: 0,
    present: 0,
    absent: 0,
    notMarked: 0,
    attendancePercentage: 0,
  };

  const centres = data?.centres || [];

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Health Monitoring System</h2>
          <p>Deputy Director of Health Services Portal</p>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        <div
          className="welcome-section"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <div>
            <h1>DDHS Monitoring Dashboard</h1>
            <p>
              Division-wide healthcare monitoring • {user?.name || "DDHS Officer"}
            </p>
          </div>

          <button
            className="attendance-btn"
            onClick={() => {
              fetchTodayOverview();
              fetchDistrictReport();
              fetchDivisionHistory(currentPage);
            }}
            disabled={loading || alertsLoading}
            style={{ marginTop: 0 }}
          >
            {loading || alertsLoading ? "Refreshing..." : "Refresh All Data"}
          </button>
        </div>

        {loading && !data && (
          <div className="table-card">
            <p>Loading division overview...</p>
          </div>
        )}

        {!loading && error && (
          <div className="table-card">
            <h2>Unable to Load Division Data</h2>
            <p className="stat-absent">{error}</p>
            <button
              className="attendance-btn"
              onClick={fetchTodayOverview}
              style={{ marginTop: "15px" }}
            >
              Try Again
            </button>
          </div>
        )}

        {data && !error && (
          <>
            {/* Today's Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <p>Health Centres</p>
                <h2>{totals.activeHealthCentres}</h2>
              </div>
              <div className="stat-card">
                <p>Total Doctors</p>
                <h2>{totals.totalDoctors}</h2>
              </div>
              <div className="stat-card">
                <p>Present Today</p>
                <h2 className="stat-present">{totals.present}</h2>
              </div>
              <div className="stat-card">
                <p>Absent Today</p>
                <h2 className="stat-absent">{totals.absent}</h2>
              </div>
              <div className="stat-card">
                <p>Not Marked</p>
                <h2 className="stat-pending">{totals.notMarked}</h2>
              </div>
              <div className="stat-card">
                <p>Today's Attendance %</p>
                <h2 className="stat-present">{totals.attendancePercentage}%</h2>
              </div>
            </div>

            {/* Today's Health Centre Overview Table */}
            <div className="table-card">
              <h2>Today's Health Centre Status ({data.date})</h2>

              {centres.length === 0 ? (
                <p style={{ marginTop: "15px", color: "#6b7280" }}>
                  No active health centres found in the division.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Health Centre</th>
                        <th>Type</th>
                        <th>District</th>
                        <th>Total Doctors</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Not Marked</th>
                        <th>Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {centres.map((centre) => (
                        <tr key={centre.id}>
                          <td><strong>{centre.name}</strong></td>
                          <td>{centre.type}</td>
                          <td>{centre.district}</td>
                          <td>{centre.totalDoctors}</td>
                          <td className="table-present">{centre.present}</td>
                          <td className="table-absent">{centre.absent}</td>
                          <td>{centre.notMarked}</td>
                          <td>{centre.attendancePercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* District Attendance Reporting & Analytics Section */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>District Attendance Reports & Comparisons</h2>
              <p style={{ margin: "4px 0 15px", color: "#6b7280" }}>
                Multi-centre aggregation, historical performance comparisons, and absenteeism insights
              </p>

              {/* Filter controls */}
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
                  <label>Health Centre Filter</label>
                  <select
                    value={centreFilter}
                    onChange={(e) => setCentreFilter(e.target.value)}
                  >
                    <option value="">All Health Centres</option>
                    {centres.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {reportLoading && (
                <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading district report...</p>
              )}
              {reportError && (
                <p style={{ color: "#dc2626", marginTop: "15px" }}>{reportError}</p>
              )}

              {!reportLoading && !reportError && reportData && (
                <>
                  <div className="stats-grid" style={{ marginTop: "15px" }}>
                    <div className="stat-card">
                      <p>Centres in Scope</p>
                      <h2>{reportData.overallStats?.activeHealthCentres}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Doctors</p>
                      <h2>{reportData.overallStats?.totalDoctors}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Present</p>
                      <h2 className="stat-present">{reportData.overallStats?.present}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Total Absent</p>
                      <h2 className="stat-absent">{reportData.overallStats?.absent}</h2>
                    </div>
                    <div className="stat-card">
                      <p>Overall Attendance %</p>
                      <h2 className="stat-present">
                        {reportData.overallStats?.attendancePercentage}%
                      </h2>
                    </div>
                  </div>

                  {/* Centre-wise Comparison Table */}
                  <h3 style={{ marginTop: "25px", color: "#183153" }}>
                    Centre-wise Period Performance ({startDate} to {endDate})
                  </h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Health Centre</th>
                          <th>Type</th>
                          <th>District</th>
                          <th>Doctors</th>
                          <th>Present</th>
                          <th>Absent</th>
                          <th>Not Marked</th>
                          <th>Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.centreComparison?.map((centre) => (
                          <tr key={centre.id || centre.name}>
                            <td><strong>{centre.name}</strong></td>
                            <td>{centre.type}</td>
                            <td>{centre.district}</td>
                            <td>{centre.totalDoctors}</td>
                            <td className="table-present">{centre.present}</td>
                            <td className="table-absent">{centre.absent}</td>
                            <td>{centre.notMarked}</td>
                            <td>
                              <strong>{centre.attendancePercentage}%</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* High Absenteeism Doctors Section */}
                  <h3 style={{ marginTop: "30px", color: "#183153" }}>
                    High-Absenteeism Doctors (Watchlist)
                  </h3>
                  {!reportData.highAbsenteeismDoctors ||
                  reportData.highAbsenteeismDoctors.length === 0 ? (
                    <p style={{ color: "#6b7280", marginTop: "10px" }}>
                      No doctor absences recorded in the selected period.
                    </p>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Doctor</th>
                            <th>Department</th>
                            <th>Health Centre</th>
                            <th>Absent Days</th>
                            <th>Present Days</th>
                            <th>Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.highAbsenteeismDoctors.map((doc) => (
                            <tr key={doc.id || doc.email}>
                              <td><strong>{doc.name}</strong></td>
                              <td>{doc.department}</td>
                              <td>{doc.healthCentre}</td>
                              <td className="table-absent">
                                <strong>{doc.absentDays}</strong>
                              </td>
                              <td className="table-present">{doc.presentDays}</td>
                              <td>{doc.attendancePercentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Division-wide Attendance History Log */}
            <div className="table-card" style={{ marginTop: "30px" }}>
              <h2>Division Attendance Logs</h2>

              <div className="filter-bar">
                <div className="filter-group">
                  <label>Status Filter</label>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
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

            {/* Division Absenteeism Alerts Card */}
            <div className="alerts-card" style={{ marginTop: "30px" }}>
              <div className="alerts-heading">
                <h2>Active Division Absenteeism Alerts</h2>
                <span>{alerts.length} Active</span>
              </div>

              {alertsLoading && (
                <p style={{ marginTop: "15px", color: "#6b7280" }}>
                  Loading division alerts...
                </p>
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
                          <strong>{alert.healthCentre}</strong> • {alert.message} (
                          {alert.consecutiveDays}{" "}
                          {alert.consecutiveDays === 1 ? "day" : "days"} absence)
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

export default DDHSDashboard;