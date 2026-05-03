import { NavLink } from "react-router-dom";

export default function Sidebar({ token, onLogout }) {
  const items = [
    { to: "/dashboard", label: "Dashboard", short: "DB" },
    { to: "/kits", label: "Kits", short: "KT" },
    ...(token ? [{ to: "/settings/filters", label: "Filters", short: "FL" }] : []),
    { to: "/settings", label: "Settings", short: "ST" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="brand-full">Artifactory</p>
        <span className="brand-sub">Model Collection OS</span>
        <p className="brand-mini" aria-hidden="true">
          AF
        </p>
      </div>
      <div className="session-card">
        <div className="session-pill" aria-hidden="true">
          <span className={token ? "status-dot online" : "status-dot"} />
          <span className="session-pill-text">{token ? "IN" : "OUT"}</span>
        </div>
        <p className="session-text">{token ? "Signed in" : "Guest mode"}</p>
        {token ? (
          <button className="session-action" type="button" onClick={onLogout}>
            Log Out
          </button>
        ) : (
          <NavLink className="ghost-link session-action" to="/login">
            Log In
          </NavLink>
        )}
      </div>
      <nav className="nav-list">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
            <span className="nav-short" aria-hidden="true">
              {item.short}
            </span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
