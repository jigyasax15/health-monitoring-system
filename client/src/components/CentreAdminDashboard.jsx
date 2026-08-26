import { useEffect, useState } from "react";

function CentreAdminDashboard({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");

  const assignedCentre = user?.healthCentre;

  const fetchDashboardData = async () => {
    if (!assignedCentre) {
      setError("No health centre assigned to this administrator account.");
      setLoading(false);
      setAlertsLoading(false);
      return;
    }

    // Fetch summary
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `http://localhost:5000/api/phc-summary?centre=${encodeURIComponent(
          assignedCentre
        )}`
      );

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

    // Fetch alerts
    try {
      setAlertsLoading(true);
      setAlertsError("");

      const alertRes = await fetch(
        `http://localhost:5000/api/alerts/centre?centre=${encodeURIComponent(
          assignedCentre
        )}`
      );

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

  useEffect(() => {
    fetchDashboardData();
  }, [assignedCentre]);

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
                Daily Staff Monitoring Dashboard • {user?.name || "Admin"} (
                {user?.email || ""})
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <p>Total Doctors</p>
                <h2>{summary.totalDoctors}</h2>
              </div>

              <div className="stat-card">
                <p>Present</p>
                <h2 className="stat-present">{summary.present}</h2>
              </div>

              <div className="stat-card">
                <p>Absent</p>
                <h2 className="stat-absent">{summary.absent}</h2>
              </div>

              <div className="stat-card">
                <p>Not Marked</p>
                <h2 className="stat-pending">{summary.notMarked}</h2>
              </div>
            </div>

            <div className="table-card">
              <h2>Today's Doctor Attendance</h2>

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
                          <td>{doctor.name}</td>
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

            <div className="alerts-card">
              <div className="alerts-heading">
                <h2>Absenteeism Alerts</h2>
                <span>{alerts.length} Active</span>
              </div>

              {alertsLoading && (
                <p style={{ marginTop: "15px", color: "#6b7280" }}>
                  Loading alerts...
                </p>
              )}

              {!alertsLoading && alertsError && (
                <p style={{ marginTop: "15px", color: "#dc2626" }}>
                  {alertsError}
                </p>
              )}

              {!alertsLoading && !alertsError && alerts.length === 0 && (
                <p style={{ marginTop: "15px", color: "#6b7280" }}>
                  No active absenteeism alerts
                </p>
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

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
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