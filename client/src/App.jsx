import { useEffect, useState } from "react";
import "./App.css";
import DoctorDashboard from "./components/DoctorDashboard";
import CentreAdminDashboard from "./components/CentreAdminDashboard";
import DDHSDashboard from "./components/DDHSDashboard";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("doctor");
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  // Stores the message received from our Express backend
  const [backendMessage, setBackendMessage] = useState("");

  // Test connection between React frontend and Express backend
  useEffect(() => {
    fetch("http://localhost:5000/api/test")
      .then((response) => response.json())
      .then((data) => {
        setBackendMessage(data.message);
      })
      .catch((error) => {
        console.error("Backend connection error:", error);
        setBackendMessage("Backend connection failed");
      });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password || !role) {
      alert("Please enter email, password and role");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Login failed");
        return;
      }

      // Preserve authenticated user profile from backend
      setUser(data.user);
      setEmail(data.user.email);
      setRole(data.user.role);
      setLoggedIn(true);
    } catch (error) {
      console.error("Login error:", error);
      alert("Could not connect to backend");
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUser(null);
    setEmail("");
    setPassword("");
  };

  // Doctor Dashboard
  if (loggedIn && role === "doctor") {
    return (
      <DoctorDashboard
        email={email}
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  // Health Centre Admin Dashboard
  if (loggedIn && role === "centre-admin") {
    return (
      <CentreAdminDashboard
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  // DDHS Dashboard
  if (loggedIn && role === "ddhs") {
    return (
      <DDHSDashboard
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  // Login Page
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Health Monitoring System</h1>

        <p className="subtitle">
          Centralized PHC Monitoring Platform
        </p>

        <p className="backend-status">
          {backendMessage || "Connecting to backend..."}
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <label>Email</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label>Role</label>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="doctor">Doctor / Staff</option>
            <option value="centre-admin">Health Centre Admin</option>
            <option value="ddhs">DDHS Admin</option>
          </select>

          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}

export default App;