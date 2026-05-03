import { NavLink } from "react-router-dom";

export default function TopNav({ token, onLogout }) {
  return (
    <header className="topnav">
      <NavLink to="/dashboard" className="topnav-brand">
        Artifactory
        <span className="topnav-brand-sub">Model Collection OS</span>
      </NavLink>

      <nav className="topnav-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? "topnav-link active" : "topnav-link"}>
          Dashboard
        </NavLink>
        <NavLink to="/kits" className={({ isActive }) => isActive ? "topnav-link active" : "topnav-link"}>
          Kits
        </NavLink>
        {token ? (
          <NavLink to="/settings/filters" className={({ isActive }) => isActive ? "topnav-link active" : "topnav-link"}>
            Filters
          </NavLink>
        ) : null}
        <NavLink to="/settings" className={({ isActive }) => isActive ? "topnav-link active" : "topnav-link"}>
          Settings
        </NavLink>
      </nav>

      <div className="topnav-session">
        <span className={token ? "status-dot online" : "status-dot"} />
        <span className="topnav-session-text">{token ? "Signed in" : "Guest"}</span>
        {token ? (
          <button className="topnav-action" type="button" onClick={onLogout}>
            Log Out
          </button>
        ) : (
          <NavLink className="topnav-action" to="/login">
            Log In
          </NavLink>
        )}
      </div>
    </header>
  );
}
