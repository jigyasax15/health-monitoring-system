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

  // Upcoming Holidays
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);

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

  // Load Upcoming Holidays (next 60 days)
  const fetchHolidays = async () => {
    try {
      setHolidaysLoading(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      const futureStr = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const res = await fetch(
        `http://localhost:5000/api/holidays?startDate=${todayStr}&endDate=${futureStr}`,
        { credentials: "include" }
      );

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
    fetchHolidays();
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
                  : attendanceStatus === "Non-Working Day"
                  ? "stat-non-working"
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
            {attendanceStatus === "Non-Working Day"
              ? "Today is a scheduled Non-Working Day (Weekly Off or Holiday). Attendance marking is optional."
              : "Mark your attendance when you arrive at your assigned health centre."}
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
                Period: {startDate} to {endDate} • Denominator excludes weekly offs & holidays
              </p>
            </div>
          </div>

          {summaryLoading ? (
            <p style={{ marginTop: "15px", color: "#6b7280" }}>Loading summary...</p>
          ) : summary ? (
            <div className="stats-grid" style={{ marginTop: "15px" }}>
              <div className="stat-card">
                <p>Present (Working Days)</p>
                <h2 className="stat-present">{summary.presentWorkingDays !== undefined ? summary.presentWorkingDays : summary.presentDays}</h2>
              </div>
              <div className="stat-card">
                <p>Absent Days</p>
                <h2 className="stat-absent">{summary.absentDays}</h2>
              </div>
              <div className="stat-card">
                <p>Non-Working Days</p>
                <h2 style={{ color: "#0284c7" }}>{summary.nonWorkingDays || 0}</h2>
              </div>
              <div className="stat-card">
                <p>Working-Day Attendance %</p>
                <h2 className="stat-present">{summary.attendancePercentage}%</h2>
              </div>
            </div>
          ) : (
            <p style={{ marginTop: "15px", color: "#6b7280" }}>No summary available</p>
          )}
        </div>

        {/* Upcoming Holidays / Non-Working Days Widget */}
        <div className="table-card" style={{ marginTop: "30px" }}>
          <div className="section-header-flex">
            <div>
              <h2>Upcoming Holidays & Non-Working Days</h2>
              <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                District public holidays and centre-specific off-days
              </p>
            </div>
          </div>

          {holidaysLoading ? (
            <p style={{ marginTop: "15px", color: "#6b7280" }}>Loading holidays...</p>
          ) : holidays.length === 0 ? (
            <p style={{ marginTop: "15px", color: "#6b7280" }}>No upcoming holidays scheduled in the next 60 days.</p>
          ) : (
            <div className="table-wrapper" style={{ marginTop: "15px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Holiday Name</th>
                    <th>Type</th>
                    <th>Scope</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h._id || `${h.date}_${h.name}`}>
                      <td><strong>{h.date}</strong></td>
                      <td>{h.name}</td>
                      <td>
                        <span className="holiday-badge">{h.type || "PUBLIC"}</span>
                      </td>
                      <td>
                        <span className="scope-badge">
                          {h.scope === "CENTRE" ? `Centre (${h.healthCentre})` : "District-wide"}
                        </span>
                      </td>
                      <td>{h.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <option value="Non-Working Day">Non-Working Day</option>
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