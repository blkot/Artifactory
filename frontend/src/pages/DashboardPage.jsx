import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import AppHeader from "../components/AppHeader";

export default function DashboardPage({ kits, kitPreviewMap, stats }) {
  const recentKits = kits.slice(0, 10);
  const statusMap = useMemo(() => {
    const map = {};
    for (const item of stats?.by_status || []) {
      map[item.status.replace("BuildStatus.", "")] = item.count;
    }
    return map;
  }, [stats]);

  return (
    <section className="page kits-page">
      <AppHeader
        title="Dashboard"
        subtitle="Monitor your build pipeline and collection growth."
      />
      <div className="stats-grid modern">
        <article className="metric-card">
          <p>Total Kits</p>
          <strong>{stats?.total_kits ?? 0}</strong>
        </article>
        <article className="metric-card">
          <p>Total Spent</p>
          <strong>${(stats?.total_spent ?? 0).toFixed(2)}</strong>
        </article>
        <article className="metric-card">
          <p>Completion</p>
          <strong>{(stats?.completion_rate ?? 0).toFixed(1)}%</strong>
        </article>
        <article className="metric-card">
          <p>In Progress</p>
          <strong>{statusMap.IN_PROGRESS || 0}</strong>
        </article>
      </div>

      <article className="panel">
        <div className="panel-head">
          <h2>Recent Kits</h2>
          <NavLink to="/kits" className="ghost-link">
            View Inventory
          </NavLink>
        </div>
        <div className="recent-kit-grid">
          {recentKits.map((kit) => (
            <NavLink key={kit.id} to={`/kits/${kit.id}`} className="recent-kit-card">
              <div className="recent-kit-thumb">
                {kitPreviewMap[kit.id] ? (
                  <img src={kitPreviewMap[kit.id]} alt={kit.name} />
                ) : (
                  <div className="kit-card-placeholder">
                    <span>{kit.grade}</span>
                  </div>
                )}
              </div>
              <div className="recent-kit-body">
                <p className="recent-kit-title">{kit.name}</p>
                <p className="recent-kit-sub">{kit.series}</p>
              </div>
            </NavLink>
          ))}
          {recentKits.length === 0 ? (
            <div className="kit-card-empty muted">No kits yet. Add your first kit.</div>
          ) : null}
        </div>
      </article>
    </section>
  );
}
