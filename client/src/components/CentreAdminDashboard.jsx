import { useEffect, useState } from "react";

function CentreAdminDashboard({ onLogout }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/phc-summary"
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load summary");
        }

        setSummary(data);
      } catch (error) {
        console.error(error);
        setError("Could not load PHC data");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

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
        {loading && <p>Loading dashboard...</p>}

        {error && <p>{error}</p>}

        {!loading && !error && summary && (
          <>
            <div className="welcome-section">
              <h1>{summary.healthCentre}</h1>
              <p>Daily Staff Monitoring Dashboard</p>
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
                                .replace(" ", "-")}`}
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