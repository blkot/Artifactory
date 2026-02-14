import { useEffect, useMemo, useState } from "react";

import { api, ApiError, loadTokenFromStorage, setAuthToken } from "./api/client";

const GRADES = ["HG", "RG", "MG", "PG", "SD", "CUSTOM"];
const BUILD_STATUS = ["NEW", "OPENED", "IN_PROGRESS", "COMPLETED"];
const LINK_CATEGORIES = ["BUILD_LOG", "REVIEW", "TUTORIAL", "GALLERY"];
const ASSET_TYPES = ["BOX_ART", "MANUAL", "BUILD_PHOTO", "REFERENCE_IMAGE", "VIDEO", "DOCUMENT"];

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
  const [assets, setAssets] = useState([]);
  const [links, setLinks] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState(null);
  const [token, setToken] = useState(() => loadTokenFromStorage());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [kitForm, setKitForm] = useState(emptyKit);
  const [tagForm, setTagForm] = useState({ name: "", color: "#6495ed" });
  const [linkForm, setLinkForm] = useState({
    kit_id: "",
    url: "",
    category: "REVIEW",
    title: "",
    notes: "",
    tag_ids: [],
  });
  const [timelineKitId, setTimelineKitId] = useState("");
  const [assetKitId, setAssetKitId] = useState("");
  const [timelineForm, setTimelineForm] = useState({
    status: "IN_PROGRESS",
    notes: "",
  });
  const [assetForm, setAssetForm] = useState({
    type: "DOCUMENT",
    description: "",
    is_external_reference: false,
    file: null,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [kitRes, tagRes, statsRes, linkRes] = await Promise.all([
        api.getKits(),
        api.getTags(),
        api.getStats(),
        api.getLinks(),
      ]);
      setKits(kitRes.items || []);
      setTags(tagRes || []);
      setStats(statsRes);
      setLinks(linkRes || []);
      if (!linkForm.kit_id && (kitRes.items || []).length > 0) {
        setLinkForm((prev) => ({ ...prev, kit_id: String(kitRes.items[0].id) }));
      }
      if (!timelineKitId && (kitRes.items || []).length > 0) {
        setTimelineKitId(String(kitRes.items[0].id));
      }
      if (!assetKitId && (kitRes.items || []).length > 0) {
        setAssetKitId(String(kitRes.items[0].id));
      }
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

  useEffect(() => {
    if (!timelineKitId) {
      setTimeline([]);
      return;
    }
    async function loadTimeline() {
      try {
        const items = await api.getTimeline(Number(timelineKitId));
        setTimeline(items || []);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthMessage("You must log in to view timeline data.");
        }
        setError(err.message);
      }
    }
    loadTimeline();
  }, [timelineKitId]);

  useEffect(() => {
    if (!assetKitId) {
      setAssets([]);
      return;
    }
    async function loadAssets() {
      try {
        const payload = await api.getAssets({ kitId: Number(assetKitId) });
        setAssets(payload.items || []);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthMessage("You must log in to view assets.");
        }
        setError(err.message);
      }
    }
    loadAssets();
  }, [assetKitId]);

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

  function toggleLinkTag(id) {
    setLinkForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(id)
        ? prev.tag_ids.filter((item) => item !== id)
        : [...prev.tag_ids, id],
    }));
  }

  async function submitLink(event) {
    event.preventDefault();
    setError("");
    try {
      await api.createLink({
        ...linkForm,
        kit_id: Number(linkForm.kit_id),
      });
      setLinkForm((prev) => ({
        ...prev,
        url: "",
        title: "",
        notes: "",
        tag_ids: [],
      }));
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("You must log in to manage links.");
      }
      setError(err.message);
    }
  }

  async function removeLink(id) {
    setError("");
    try {
      await api.deleteLink(id);
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("You must log in to manage links.");
      }
      setError(err.message);
    }
  }

  async function submitTimeline(event) {
    event.preventDefault();
    if (!timelineKitId) return;
    setError("");
    try {
      await api.createTimeline(Number(timelineKitId), timelineForm);
      setTimelineForm((prev) => ({ ...prev, notes: "" }));
      const items = await api.getTimeline(Number(timelineKitId));
      setTimeline(items || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("You must log in to create timeline entries.");
      }
      setError(err.message);
    }
  }

  async function submitAsset(event) {
    event.preventDefault();
    if (!assetKitId || !assetForm.file) {
      setError("Please select a kit and file before uploading.");
      return;
    }
    setError("");
    try {
      const formData = new FormData();
      formData.set("kit_id", String(Number(assetKitId)));
      formData.set("type", assetForm.type);
      formData.set("description", assetForm.description);
      formData.set("is_external_reference", String(assetForm.is_external_reference));
      formData.set("file", assetForm.file);
      await api.uploadAsset(formData);
      setAssetForm((prev) => ({
        ...prev,
        description: "",
        is_external_reference: false,
        file: null,
      }));
      const payload = await api.getAssets({ kitId: Number(assetKitId) });
      setAssets(payload.items || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("You must log in to manage assets.");
      }
      setError(err.message);
    }
  }

  async function removeAsset(id) {
    setError("");
    try {
      await api.deleteAsset(id);
      const payload = await api.getAssets({ kitId: Number(assetKitId) });
      setAssets(payload.items || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthMessage("You must log in to manage assets.");
      }
      setError(err.message);
    }
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

        <article className="card">
          <h2>Create Link</h2>
          <form onSubmit={submitLink} className="form">
            <select
              required
              value={linkForm.kit_id}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, kit_id: e.target.value }))}
            >
              <option value="" disabled>Select kit</option>
              {kits.map((kit) => <option key={kit.id} value={kit.id}>{kit.name}</option>)}
            </select>
            <input
              required
              type="url"
              placeholder="https://..."
              value={linkForm.url}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, url: e.target.value }))}
            />
            <select
              value={linkForm.category}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {LINK_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <input
              required
              placeholder="Title"
              value={linkForm.title}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              placeholder="Notes"
              value={linkForm.notes}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
            <div className="tag-list">
              {tags.map((tag) => (
                <button
                  type="button"
                  key={`link-tag-${tag.id}`}
                  onClick={() => toggleLinkTag(tag.id)}
                  className={linkForm.tag_ids.includes(tag.id) ? "tag active" : "tag"}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <button type="submit">Create Link</button>
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

      <section className="card">
        <h2>Links</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>URL</th>
                <th>Kit ID</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>{link.title}</td>
                  <td>{link.category}</td>
                  <td><a href={link.url} target="_blank" rel="noreferrer">Open</a></td>
                  <td>{link.kit_id}</td>
                  <td>
                    <button type="button" className="btn-danger" onClick={() => removeLink(link.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Assets</h2>
        <form onSubmit={submitAsset} className="form">
          <select
            required
            value={assetKitId}
            onChange={(e) => setAssetKitId(e.target.value)}
          >
            <option value="" disabled>Select kit</option>
            {kits.map((kit) => <option key={`asset-kit-${kit.id}`} value={kit.id}>{kit.name}</option>)}
          </select>
          <select
            value={assetForm.type}
            onChange={(e) => setAssetForm((prev) => ({ ...prev, type: e.target.value }))}
          >
            {ASSET_TYPES.map((type) => <option key={`asset-type-${type}`} value={type}>{type}</option>)}
          </select>
          <input
            placeholder="Asset description"
            value={assetForm.description}
            onChange={(e) => setAssetForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={assetForm.is_external_reference}
              onChange={(e) => setAssetForm((prev) => ({ ...prev, is_external_reference: e.target.checked }))}
            />
            External reference
          </label>
          <input
            required
            type="file"
            onChange={(e) => setAssetForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
          />
          <button type="submit">Upload Asset</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Preview</th>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    {asset.mime_type.startsWith("image/") ? (
                      <img
                        src={api.assetFileUrl(asset.id)}
                        alt={asset.original_filename}
                        className="asset-preview"
                      />
                    ) : (
                      <span className="muted">No preview</span>
                    )}
                  </td>
                  <td>{asset.original_filename}</td>
                  <td>{asset.type}</td>
                  <td>{(asset.file_size / 1024).toFixed(1)} KB</td>
                  <td className="actions-row">
                    <a href={api.assetFileUrl(asset.id)} target="_blank" rel="noreferrer">Open</a>
                    <button type="button" className="btn-danger" onClick={() => removeAsset(asset.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">No assets for selected kit.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Build Timeline</h2>
        <form onSubmit={submitTimeline} className="form">
          <select
            required
            value={timelineKitId}
            onChange={(e) => setTimelineKitId(e.target.value)}
          >
            <option value="" disabled>Select kit</option>
            {kits.map((kit) => <option key={`timeline-kit-${kit.id}`} value={kit.id}>{kit.name}</option>)}
          </select>
          <select
            value={timelineForm.status}
            onChange={(e) => setTimelineForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            {BUILD_STATUS.map((state) => <option key={`timeline-status-${state}`} value={state}>{state}</option>)}
          </select>
          <input
            placeholder="Timeline notes"
            value={timelineForm.notes}
            onChange={(e) => setTimelineForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
          <button type="submit">Add Timeline Entry</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.status}</td>
                  <td>{item.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
