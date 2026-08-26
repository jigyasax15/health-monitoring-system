import { useEffect, useState } from "react";

function CentreAdminDashboard({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const assignedCentre = user?.healthCentre;

  useEffect(() => {
    if (!assignedCentre) {
      setError("No health centre assigned to this administrator account.");
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
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
    };

    fetchSummary();
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
                Daily Staff Monitoring Dashboard • {user?.name || "Admin"} ({user?.email || ""})
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <p>Total Doctors</p>
                <h2>{summary.totalDoctors}</h2>
              </div>

              <div className="stat-card">
                <p>Present</p>
                <h2 className="stat-present">
                  {summary.present}
                </h2>
              </div>

              <div className="stat-card">
                <p>Absent</p>
                <h2 className="stat-absent">
                  {summary.absent}
                </h2>
              </div>

              <div className="stat-card">
                <p>Not Marked</p>
                <h2 className="stat-pending">
                  {summary.notMarked}
                </h2>
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
          </>
        )}
      </main>
    </div>
  );
}

export default CentreAdminDashboard;