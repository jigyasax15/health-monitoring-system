import { useEffect, useState } from "react";

function DoctorDashboard({ email, onLogout }) {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceStatus, setAttendanceStatus] = useState("Not Marked");
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Personal Summary Metrics
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // History & Filters State
  const [historyItems, setHistoryItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  // Default dates: last 30 days
  const defaultStartDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultEndDate = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Load doctor information AND today's attendance
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        // Get doctor information
        const doctorResponse = await fetch(
          `http://localhost:5000/api/doctors/email/${encodeURIComponent(email)}`,
          { credentials: "include" }
        );

        if (doctorResponse.status === 401) {
          onLogout();
          return;
        }

        const doctorData = await doctorResponse.json();

        if (!doctorResponse.ok) {
          throw new Error(doctorData.message || "Doctor not found");
        }

        setDoctor(doctorData.doctor);

        // Get today's attendance
        const attendanceResponse = await fetch(
          `http://localhost:5000/api/attendance/today/${encodeURIComponent(email)}`,
          { credentials: "include" }
        );

        if (attendanceResponse.status === 401) {
          onLogout();
          return;
        }

        const attendanceData = await attendanceResponse.json();

        if (!attendanceResponse.ok) {
          throw new Error(attendanceData.message || "Could not load attendance");
        }

        setAttendanceStatus(attendanceData.status);
      } catch (err) {
        console.error("Doctor info load error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [email, onLogout]);

  // Load Doctor Personal Summary
  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.set("startDate", startDate);
      if (endDate) queryParams.set("endDate", endDate);

      const res = await fetch(
        `http://localhost:5000/api/attendance/my-summary?${queryParams.toString()}`,
        { credentials: "include" }
      );

      if (res.status === 401) {
        onLogout();
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setSummary(data);
      }
    } catch (err) {
      console.error("Fetch summary error:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Load Attendance History
  const fetchHistory = async (page = 1) => {
    try {
      setHistoryLoading(true);
      setHistoryError("");

      const queryParams = new URLSearchParams();
      queryParams.set("page", page.toString());
      queryParams.set("limit", "10");
      if (startDate) queryParams.set("startDate", startDate);
      if (endDate) queryParams.set("endDate", endDate);
      if (statusFilter) queryParams.set("status", statusFilter);

      const res = await fetch(
        `http://localhost:5000/api/attendance/history?${queryParams.toString()}`,
        { credentials: "include" }
      );

      if (res.status === 401) {
        onLogout();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load attendance history");
      }

      setHistoryItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 10, totalPages: 1, totalItems: 0 });
      setCurrentPage(data.pagination?.page || 1);
    } catch (err) {
      console.error("Fetch history error:", err);
      setHistoryError(err.message || "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchHistory(1);
  }, [startDate, endDate, statusFilter]);

  // Mark attendance
  const handleAttendance = async () => {
    if (!doctor) {
      return;
    }

    try {
      setAttendanceLoading(true);
      setMessage("");

      const response = await fetch("http://localhost:5000/api/attendance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not mark attendance");
      }

      setAttendanceStatus("Present");
      setMessage("Attendance marked successfully");
      fetchSummary();
      fetchHistory(currentPage);
    } catch (err) {
      console.error(err);
      setMessage(err.message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="admin-dashboard">
        <main className="dashboard-content">
          <p>Loading doctor dashboard...</p>
        </main>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="admin-dashboard">
        <header className="dashboard-header">
          <div>
            <h2>Health Monitoring System</h2>
            <p>Doctor / Staff Portal</p>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </header>

        <main className="dashboard-content">
          <h2>Unable to load doctor</h2>
          <p>{error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Health Monitoring System</h2>
          <p>Doctor / Staff Portal</p>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome, {doctor.name}</h1>
          <p>{doctor.email}</p>
        </div>

        {/* Current Info & Today's Attendance */}
        <div className="stats-grid">
          <div className="stat-card">
            <p>Health Centre</p>
            <h2>{doctor.healthCentre}</h2>
          </div>

          <div className="stat-card">
            <p>Department</p>
            <h2>{doctor.department}</h2>
          </div>

          <div className="stat-card">
            <p>Today's Attendance</p>
            <h2
              className={
                attendanceStatus === "Present"
                  ? "stat-present"
                  : attendanceStatus === "Absent"
                  ? "stat-absent"
                  : "stat-pending"
              }
            >
              {attendanceStatus}
            </h2>
          </div>
        </div>

        {/* Mark Attendance Card */}
        <div className="table-card">
          <h2>Daily Attendance</h2>
          <p>
            Mark your attendance when you arrive at your assigned health centre.
          </p>

          <button
            className="attendance-btn"
            onClick={handleAttendance}
            disabled={attendanceStatus === "Present" || attendanceLoading}
          >
            {attendanceLoading
              ? "Marking..."
              : attendanceStatus === "Present"
              ? "Attendance Marked ✓"
              : "Mark Attendance"}
          </button>

          {message && <p className="attendance-message">{message}</p>}
        </div>

        {/* Attendance Summary for Selected Period */}
        <div className="table-card" style={{ marginTop: "30px" }}>
          <div className="section-header-flex">
            <div>
              <h2>My Attendance Summary</h2>
              <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                Period: {startDate} to {endDate}
              </p>
            </div>
          </div>

          {summaryLoading ? (
            <p style={{ marginTop: "15px", color: "#6b7280" }}>Loading summary...</p>
          ) : summary ? (
            <div className="stats-grid" style={{ marginTop: "15px" }}>
              <div className="stat-card">
                <p>Present Days</p>
                <h2 className="stat-present">{summary.presentDays}</h2>
              </div>
              <div className="stat-card">
                <p>Absent Days</p>
                <h2 className="stat-absent">{summary.absentDays}</h2>
              </div>
              <div className="stat-card">
                <p>Not Marked</p>
                <h2 className="stat-pending">{summary.notMarkedDays}</h2>
              </div>
              <div className="stat-card">
                <p>Attendance %</p>
                <h2 className="stat-present">{summary.attendancePercentage}%</h2>
              </div>
            </div>
          ) : (
            <p style={{ marginTop: "15px", color: "#6b7280" }}>No summary available</p>
          )}
        </div>

        {/* Attendance History & Filters */}
        <div className="table-card" style={{ marginTop: "30px" }}>
          <h2>Attendance History</h2>

          {/* Filter Bar */}
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

          {/* Error State */}
          {historyError && (
            <p style={{ color: "#dc2626", marginTop: "15px" }}>{historyError}</p>
          )}

          {/* Loading State */}
          {historyLoading && (
            <p style={{ color: "#6b7280", marginTop: "15px" }}>Loading records...</p>
          )}

          {/* Table */}
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
                      <th>Status</th>
                      <th>Marked Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((record) => (
                      <tr key={record.id || record.date}>
                        <td>
                          <strong>{record.date}</strong>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${record.status
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td>
                          {record.markedAt
                            ? new Date(record.markedAt).toLocaleTimeString("en-IN", {
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

              {/* Pagination Controls */}
              <div className="pagination-bar">
                <span>
                  Showing Page {pagination.page} of {pagination.totalPages || 1} (
                  {pagination.totalItems} total records)
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
      </main>
    </div>
  );
}

export default DoctorDashboard;