import { useEffect, useMemo, useState } from "react";

import { api, ApiError, loadTokenFromStorage, setAuthToken } from "./api/client";

const GRADES = ["HG", "RG", "MG", "PG", "SD", "CUSTOM"];
const BUILD_STATUS = ["NEW", "OPENED", "IN_PROGRESS", "COMPLETED"];

const emptyKit = {
  name: "",
  grade: "HG",
  series: "",
  brand: "Bandai",
  scale: "1/144",
  kit_number: "",
  purchase_date: "",
  purchase_price: "",
  purchase_shop: "",
  build_status: "NEW",
  tag_ids: [],
};

export default function App() {
  const [kits, setKits] = useState([]);
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState(null);
  const [token, setToken] = useState(() => loadTokenFromStorage());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [kitForm, setKitForm] = useState(emptyKit);
  const [tagForm, setTagForm] = useState({ name: "", color: "#6495ed" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [kitRes, tagRes, statsRes] = await Promise.all([api.getKits(), api.getTags(), api.getStats()]);
      setKits(kitRes.items || []);
      setTags(tagRes || []);
      setStats(statsRes);
      setAuthMessage(token ? "Authenticated session active." : "");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("Authentication required for this environment. Please log in.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError(
          err.retryAfter
            ? `Rate limit exceeded. Retry after ${err.retryAfter}s.`
            : "Rate limit exceeded."
        );
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const statusMap = useMemo(() => {
    const map = {};
    for (const item of stats?.by_status || []) {
      map[item.status.replace("BuildStatus.", "")] = item.count;
    }
    return map;
  }, [stats]);

  async function submitKit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.createKit({
        ...kitForm,
        purchase_price: kitForm.purchase_price ? Number(kitForm.purchase_price) : null,
        purchase_date: kitForm.purchase_date || null,
      });
      setKitForm(emptyKit);
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("You must log in to create kits.");
      }
      setError(err.message);
    }
  }

  async function submitTag(event) {
    event.preventDefault();
    setError("");
    try {
      await api.createTag(tagForm);
      setTagForm({ name: "", color: "#6495ed" });
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("You must log in to create tags.");
      }
      setError(err.message);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    setAuthMessage("");
    setError("");
    try {
      const result = await api.login(username, password);
      setAuthToken(result.access_token);
      setToken(result.access_token);
      setPassword("");
      setAuthMessage("Login successful.");
      await loadData();
    } catch (err) {
      setAuthMessage("");
      setError(err.message || "Login failed");
    }
  }

  function logout() {
    setAuthToken(null);
    setToken(null);
    setAuthMessage("Logged out.");
  }

  function updateKitField(field, value) {
    setKitForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(id) {
    setKitForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(id) ? prev.tag_ids.filter((item) => item !== id) : [...prev.tag_ids, id],
    }));
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Model Kit Collection</p>
          <h1>Artifactory</h1>
          <p>Track purchases, progress, references, and build history in one place.</p>
        </div>
        <button type="button" onClick={loadData} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
      </header>

      <section className="card auth-card">
        <h2>Authentication</h2>
        {token ? (
          <div className="auth-row">
            <p className="auth-ok">Token loaded</p>
            <button type="button" onClick={logout}>Log Out</button>
          </div>
        ) : (
          <form onSubmit={submitLogin} className="form auth-form">
            <input
              required
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit">Log In</button>
          </form>
        )}
        {authMessage ? <p className="notice">{authMessage}</p> : null}
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="grid">
        <article className="card stats">
          <h2>Collection Stats</h2>
          <div className="stats-grid">
            <div>
              <strong>{stats?.total_kits ?? 0}</strong>
              <span>Total Kits</span>
            </div>
            <div>
              <strong>${(stats?.total_spent ?? 0).toFixed(2)}</strong>
              <span>Total Spent</span>
            </div>
            <div>
              <strong>{(stats?.completion_rate ?? 0).toFixed(1)}%</strong>
              <span>Completion</span>
            </div>
            <div>
              <strong>{statusMap.NEW || 0}</strong>
              <span>New</span>
            </div>
          </div>
        </article>

        <article className="card">
          <h2>Add Kit</h2>
          <form onSubmit={submitKit} className="form">
            <input required placeholder="Name" value={kitForm.name} onChange={(e) => updateKitField("name", e.target.value)} />
            <select value={kitForm.grade} onChange={(e) => updateKitField("grade", e.target.value)}>
              {GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
            <input required placeholder="Series" value={kitForm.series} onChange={(e) => updateKitField("series", e.target.value)} />
            <input required placeholder="Brand" value={kitForm.brand} onChange={(e) => updateKitField("brand", e.target.value)} />
            <input required placeholder="Scale" value={kitForm.scale} onChange={(e) => updateKitField("scale", e.target.value)} />
            <input placeholder="Kit Number" value={kitForm.kit_number} onChange={(e) => updateKitField("kit_number", e.target.value)} />
            <input type="date" value={kitForm.purchase_date} onChange={(e) => updateKitField("purchase_date", e.target.value)} />
            <input type="number" step="0.01" min="0" placeholder="Purchase Price" value={kitForm.purchase_price} onChange={(e) => updateKitField("purchase_price", e.target.value)} />
            <input placeholder="Purchase Shop" value={kitForm.purchase_shop} onChange={(e) => updateKitField("purchase_shop", e.target.value)} />
            <select value={kitForm.build_status} onChange={(e) => updateKitField("build_status", e.target.value)}>
              {BUILD_STATUS.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
            <div className="tag-list">
              {tags.map((tag) => (
                <button type="button" key={tag.id} onClick={() => toggleTag(tag.id)} className={kitForm.tag_ids.includes(tag.id) ? "tag active" : "tag"}>
                  {tag.name}
                </button>
              ))}
            </div>
            <button type="submit">Create Kit</button>
          </form>
        </article>

        <article className="card">
          <h2>Create Tag</h2>
          <form onSubmit={submitTag} className="form">
            <input required placeholder="Tag name" value={tagForm.name} onChange={(e) => setTagForm((prev) => ({ ...prev, name: e.target.value }))} />
            <input type="color" value={tagForm.color} onChange={(e) => setTagForm((prev) => ({ ...prev, color: e.target.value }))} />
            <button type="submit">Add Tag</button>
          </form>
        </article>
      </section>

      <section className="card">
        <h2>Kit Inventory</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Grade</th>
                <th>Series</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {kits.map((kit) => (
                <tr key={kit.id}>
                  <td>{kit.name}</td>
                  <td>{kit.grade}</td>
                  <td>{kit.series}</td>
                  <td>{String(kit.build_status).replace("BuildStatus.", "")}</td>
                  <td>{kit.purchase_price ? `$${Number(kit.purchase_price).toFixed(2)}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
