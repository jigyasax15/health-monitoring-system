import { useEffect, useState } from "react";

function DoctorDashboard({ email, onLogout }) {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceStatus, setAttendanceStatus] =
    useState("Not Marked");

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load doctor information AND today's attendance
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        // Get doctor information
        const doctorResponse = await fetch(
          `http://localhost:5000/api/doctors/email/${encodeURIComponent(
            email
          )}`,
          {
            credentials: "include",
          }
        );

        if (doctorResponse.status === 401) {
          onLogout();
          return;
        }

        const doctorData = await doctorResponse.json();

        if (!doctorResponse.ok) {
          throw new Error(
            doctorData.message || "Doctor not found"
          );
        }

        setDoctor(doctorData.doctor);

        // Get today's attendance
        const attendanceResponse = await fetch(
          `http://localhost:5000/api/attendance/today/${encodeURIComponent(
            email
          )}`,
          {
            credentials: "include",
          }
        );

        if (attendanceResponse.status === 401) {
          onLogout();
          return;
        }

        const attendanceData =
          await attendanceResponse.json();

        if (!attendanceResponse.ok) {
          throw new Error(
            attendanceData.message ||
              "Could not load attendance"
          );
        }

        setAttendanceStatus(attendanceData.status);
      } catch (error) {
        console.error(error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [email, onLogout]);

  // Mark attendance
  const handleAttendance = async () => {
    if (!doctor) {
      return;
    }

    try {
      setAttendanceLoading(true);
      setMessage("");

      const response = await fetch(
        "http://localhost:5000/api/attendance",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            doctorEmail: doctor.email,
            doctorName: doctor.name,
            healthCentre: doctor.healthCentre,
          }),
        }
      );

      if (response.status === 401) {
        onLogout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not mark attendance"
        );
      }

      setAttendanceStatus("Present");
      setMessage("Attendance marked successfully");
    } catch (error) {
      console.error(error);
      setMessage(error.message);
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

          <button
            className="logout-btn"
            onClick={onLogout}
          >
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

        <button
          className="logout-btn"
          onClick={onLogout}
        >
          Logout
        </button>
      </header>

      <main className="dashboard-content">

        <div className="welcome-section">
          <h1>Welcome, {doctor.name}</h1>
          <p>{doctor.email}</p>
        </div>

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

        <div className="table-card">
          <h2>Daily Attendance</h2>

          <p>
            Mark your attendance when you arrive at your
            assigned health centre.
          </p>

          <button
            onClick={handleAttendance}
            disabled={
              attendanceStatus === "Present" ||
              attendanceLoading
            }
          >
            {attendanceLoading
              ? "Marking..."
              : attendanceStatus === "Present"
              ? "Attendance Marked ✓"
              : "Mark Attendance"}
          </button>

          {message && (
            <p className="attendance-message">
              {message}
            </p>
          )}
        </div>

      </main>
    </div>
  );
}

export default DoctorDashboard;