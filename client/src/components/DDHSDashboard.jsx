import { useEffect, useState } from "react";

function DDHSDashboard({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://localhost:5000/api/ddhs/overview");
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

  useEffect(() => {
    fetchOverview();
  }, []);

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
            onClick={fetchOverview}
            disabled={loading}
            style={{ marginTop: 0 }}
          >
            {loading ? "Refreshing..." : "Refresh Overview"}
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
              onClick={fetchOverview}
              style={{ marginTop: "15px" }}
            >
              Try Again
            </button>
          </div>
        )}

        {data && !error && (
          <>
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
                <p>Attendance %</p>
                <h2 className="stat-present">{totals.attendancePercentage}%</h2>
              </div>
            </div>

            <div className="table-card">
              <h2>Health Centre Overview</h2>

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
                          <td>
                            <strong>{centre.name}</strong>
                          </td>

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

            <div className="alerts-card">
              <div className="alerts-heading">
                <h2>Absenteeism Alerts</h2>
                <span>0 Active</span>
              </div>

              <p style={{ marginTop: "15px", color: "#6b7280" }}>
                No active absenteeism alerts yet
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default DDHSDashboard;