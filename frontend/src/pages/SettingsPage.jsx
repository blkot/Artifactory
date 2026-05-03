import { NavLink } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { API_BASE_URL } from "../api/client";

export default function SettingsPage({ token }) {
  return (
    <section className="page">
      <AppHeader title="Settings" subtitle="Environment and session information." />
      <article className="panel">
        <p><strong>API Base URL:</strong> {API_BASE_URL}</p>
        <p><strong>Session:</strong> {token ? "Authenticated" : "Guest"}</p>
        {token ? (
          <p>
            <NavLink className="ghost-link" to="/settings/filters">
              Open Filter Management
            </NavLink>
          </p>
        ) : null}
      </article>
    </section>
  );
}
