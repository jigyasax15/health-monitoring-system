function DDHSDashboard({ onLogout }) {
  const centres = [
    {
      id: 1,
      name: "PHC Mathura",
      type: "PHC",
      doctors: 4,
      present: 2,
      absent: 1,
      pending: 1,
    },
    {
      id: 2,
      name: "PHC Vrindavan",
      type: "PHC",
      doctors: 6,
      present: 5,
      absent: 1,
      pending: 0,
    },
    {
      id: 3,
      name: "Upgraded PHC Govardhan",
      type: "Upgraded PHC",
      doctors: 5,
      present: 5,
      absent: 0,
      pending: 0,
    },
    {
      id: 4,
      name: "Sub-Centre Raya",
      type: "Sub-Centre",
      doctors: 3,
      present: 1,
      absent: 2,
      pending: 0,
    },
  ];

  const totalDoctors = centres.reduce(
    (total, centre) => total + centre.doctors,
    0
  );

  const totalPresent = centres.reduce(
    (total, centre) => total + centre.present,
    0
  );

  const totalAbsent = centres.reduce(
    (total, centre) => total + centre.absent,
    0
  );

  const alerts = [
    {
      id: 1,
      doctor: "Dr. R Verma",
      centre: "PHC Mathura",
      message: "Absent today",
    },
    {
      id: 2,
      doctor: "Dr. K Gupta",
      centre: "Sub-Centre Raya",
      message: "Absent for 3 consecutive days",
    },
  ];

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
        <div className="welcome-section">
          <h1>DDHS Monitoring Dashboard</h1>
          <p>Division-wide healthcare monitoring</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <p>Health Centres</p>
            <h2>{centres.length}</h2>
          </div>

          <div className="stat-card">
            <p>Total Doctors</p>
            <h2>{totalDoctors}</h2>
          </div>

          <div className="stat-card">
            <p>Present Today</p>
            <h2 className="stat-present">{totalPresent}</h2>
          </div>

          <div className="stat-card">
            <p>Absent Today</p>
            <h2 className="stat-absent">{totalAbsent}</h2>
          </div>
        </div>

        <div className="table-card">
          <h2>Health Centre Overview</h2>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Health Centre</th>
                  <th>Type</th>
                  <th>Doctors</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Pending</th>
                </tr>
              </thead>

              <tbody>
                {centres.map((centre) => (
                  <tr key={centre.id}>
                    <td>
                      <strong>{centre.name}</strong>
                    </td>

                    <td>{centre.type}</td>
                    <td>{centre.doctors}</td>

                    <td className="table-present">
                      {centre.present}
                    </td>

                    <td className="table-absent">
                      {centre.absent}
                    </td>

                    <td>{centre.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="alerts-card">
          <div className="alerts-heading">
            <h2>Absenteeism Alerts</h2>
            <span>{alerts.length} Active</span>
          </div>

          {alerts.map((alert) => (
            <div className="alert-item" key={alert.id}>
              <div>
                <h3>{alert.doctor}</h3>
                <p>{alert.centre}</p>
              </div>

              <strong>{alert.message}</strong>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default DDHSDashboard;