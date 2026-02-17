import { useEffect, useMemo, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { API_BASE_URL, api, ApiError, loadTokenFromStorage, setAuthToken } from "./api/client";

const GRADES = ["HG", "RG", "MG", "PG", "SD", "CUSTOM"];
const BUILD_STATUS = ["NEW", "OPENED", "IN_PROGRESS", "COMPLETED"];
const LINK_CATEGORIES = ["BUILD_LOG", "REVIEW", "TUTORIAL", "GALLERY"];
const ASSET_TYPES = ["BOX_ART", "MANUAL", "BUILD_PHOTO", "REFERENCE_IMAGE", "VIDEO", "DOCUMENT"];
const PAGE_SIZE = 10;
const THUMBNAIL_PREF_STORAGE_KEY = "artifactory_kit_thumbnail_asset_map";

const EMPTY_KIT_FILTERS = {
  q: "",
  grade: "",
  brand: "",
  series: "",
  build_status: "",
  scale: "",
  tag: "",
};

const EMPTY_KIT_FORM = {
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

function toUserMessage(err) {
  if (err instanceof ApiError && err.status === 429) {
    return err.retryAfter
      ? `Rate limit exceeded. Retry after ${err.retryAfter}s.`
      : "Rate limit exceeded.";
  }
  return err?.message || "Request failed";
}

function Sidebar({ token, onLogout }) {
  const items = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/kits", label: "Kits" },
    { to: "/tags", label: "Tags" },
    { to: "/settings", label: "Settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <p>Artifactory</p>
        <span>Model Collection OS</span>
      </div>
      <nav className="nav-list">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="session-card">
        <p>{token ? "Signed in" : "Guest mode"}</p>
        {token ? (
          <button type="button" onClick={onLogout}>
            Log Out
          </button>
        ) : (
          <NavLink className="ghost-link" to="/login">
            Log In
          </NavLink>
        )}
      </div>
    </aside>
  );
}

function AppHeader({ title, subtitle, onRefresh, loading, error }) {
  return (
    <header className="app-header">
      <div>
        <p className="kicker">Collection Workspace</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <p className="error-banner">{error}</p> : null}
    </header>
  );
}

function DashboardPage({ kits, kitPreviewMap, stats, loading, onRefresh }) {
  const recentKits = kits.slice(0, 5);
  const statusMap = useMemo(() => {
    const map = {};
    for (const item of stats?.by_status || []) {
      map[item.status.replace("BuildStatus.", "")] = item.count;
    }
    return map;
  }, [stats]);

  return (
    <section className="page">
      <AppHeader
        title="Dashboard"
        subtitle="Monitor your build pipeline and collection growth."
        onRefresh={onRefresh}
        loading={loading}
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

function KitsPage({
  kits,
  kitPreviewMap,
  total,
  page,
  filters,
  onPageChange,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters = Object.values(filters).some((value) => String(value).trim().length > 0);

  return (
    <section className="page">
      <AppHeader
        title="Kit Inventory"
        subtitle="Search, filter, and route into per-kit workspaces."
        onRefresh={onApplyFilters}
        loading={false}
      />

      <article className="panel">
        <div className="panel-head">
          <h2>Kits</h2>
          <NavLink to="/kits/new" className="inline-cta">
            + Add Kit
          </NavLink>
        </div>
        <form
          className="filter-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onApplyFilters();
          }}
        >
          <input placeholder="Search by name" value={filters.q} onChange={(e) => onFilterChange("q", e.target.value)} />
          <select value={filters.grade} onChange={(e) => onFilterChange("grade", e.target.value)}>
            <option value="">All grades</option>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          <select value={filters.build_status} onChange={(e) => onFilterChange("build_status", e.target.value)}>
            <option value="">All status</option>
            {BUILD_STATUS.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <input placeholder="Brand" value={filters.brand} onChange={(e) => onFilterChange("brand", e.target.value)} />
          <input placeholder="Series" value={filters.series} onChange={(e) => onFilterChange("series", e.target.value)} />
          <input placeholder="Scale" value={filters.scale} onChange={(e) => onFilterChange("scale", e.target.value)} />
          <input placeholder="Tag contains" value={filters.tag} onChange={(e) => onFilterChange("tag", e.target.value)} />
          <div className="actions-row">
            <button type="submit">Apply</button>
            <button type="button" onClick={onClearFilters}>
              Clear
            </button>
          </div>
        </form>
        <p className="muted inventory-meta">
          Showing {kits.length} of {total} kits {hasActiveFilters ? "(filtered)" : ""}
        </p>
      </article>

      <article className="panel">
        <div className="kit-card-grid">
          {kits.map((kit) => (
            <NavLink key={kit.id} to={`/kits/${kit.id}`} className="kit-card">
              <div className="kit-card-media">
                {kitPreviewMap[kit.id] ? (
                  <img src={kitPreviewMap[kit.id]} alt={kit.name} />
                ) : (
                  <div className="kit-card-placeholder">
                    <span>{kit.grade}</span>
                  </div>
                )}
              </div>
              <div className="kit-card-body">
                <p className="kit-card-title">{kit.name}</p>
                <p className="kit-card-sub">{kit.series}</p>
                <div className="kit-meta">
                  <span>{kit.grade}</span>
                  <span>{String(kit.build_status).replace("BuildStatus.", "")}</span>
                  <span>{kit.scale}</span>
                </div>
                <p className="kit-card-price">
                  {kit.purchase_price ? `$${Number(kit.purchase_price).toFixed(2)}` : "No price"}
                </p>
              </div>
            </NavLink>
          ))}
          {kits.length === 0 ? (
            <div className="kit-card-empty muted">No kits match current filters.</div>
          ) : null}
        </div>
        <div className="pager-row">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </button>
        </div>
      </article>
    </section>
  );
}

function NewKitPage({ tags, onCreate }) {
  const [form, setForm] = useState(EMPTY_KIT_FORM);
  const [imageFiles, setImageFiles] = useState([]);
  const [imageAssetType, setImageAssetType] = useState("BOX_ART");

  function toggleTag(id) {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(id) ? prev.tag_ids.filter((item) => item !== id) : [...prev.tag_ids, id],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onCreate({
      ...form,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      purchase_date: form.purchase_date || null,
      imageFiles,
      imageAssetType,
    });
    setForm(EMPTY_KIT_FORM);
    setImageFiles([]);
    setImageAssetType("BOX_ART");
  }

  return (
    <section className="page">
      <AppHeader
        title="Create Kit"
        subtitle="Capture purchase, scale, and build status with tags."
        onRefresh={() => {}}
        loading={false}
      />
      <article className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          <select value={form.grade} onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          <input required placeholder="Series" value={form.series} onChange={(e) => setForm((prev) => ({ ...prev, series: e.target.value }))} />
          <input required placeholder="Brand" value={form.brand} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} />
          <input required placeholder="Scale" value={form.scale} onChange={(e) => setForm((prev) => ({ ...prev, scale: e.target.value }))} />
          <input placeholder="Kit Number" value={form.kit_number} onChange={(e) => setForm((prev) => ({ ...prev, kit_number: e.target.value }))} />
          <input type="date" value={form.purchase_date} onChange={(e) => setForm((prev) => ({ ...prev, purchase_date: e.target.value }))} />
          <input type="number" step="0.01" min="0" placeholder="Purchase Price" value={form.purchase_price} onChange={(e) => setForm((prev) => ({ ...prev, purchase_price: e.target.value }))} />
          <input placeholder="Purchase Shop" value={form.purchase_shop} onChange={(e) => setForm((prev) => ({ ...prev, purchase_shop: e.target.value }))} />
          <select value={form.build_status} onChange={(e) => setForm((prev) => ({ ...prev, build_status: e.target.value }))}>
            {BUILD_STATUS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={imageAssetType} onChange={(e) => setImageAssetType(e.target.value)}>
            <option value="BOX_ART">BOX_ART</option>
            <option value="BUILD_PHOTO">BUILD_PHOTO</option>
            <option value="REFERENCE_IMAGE">REFERENCE_IMAGE</option>
          </select>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
          />
          <p className="muted span-2">Add optional kit images now ({imageFiles.length} selected).</p>
          <div className="tag-list span-2">
            {tags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className={form.tag_ids.includes(tag.id) ? "tag active" : "tag"}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
          <button className="span-2" type="submit">
            Create Kit
          </button>
        </form>
      </article>
    </section>
  );
}

function KitWorkspacePage({ token, allTags, thumbnailAssetMap, onSetThumbnailAsset }) {
  const { kitId } = useParams();
  const [tab, setTab] = useState("overview");
  const [kit, setKit] = useState(null);
  const [assets, setAssets] = useState([]);
  const [links, setLinks] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState("");
  const [linkForm, setLinkForm] = useState({
    url: "",
    category: "REVIEW",
    title: "",
    notes: "",
    tag_ids: [],
  });
  const [timelineForm, setTimelineForm] = useState({ status: "IN_PROGRESS", notes: "" });
  const [assetForm, setAssetForm] = useState({ type: "DOCUMENT", description: "", is_external_reference: false, file: null });
  const thumbnailAssetId = thumbnailAssetMap?.[String(kitId)] || null;
  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.mime_type?.startsWith("image/")),
    [assets]
  );

  useEffect(() => {
    if (!kitId) return;
    let active = true;

    async function loadWorkspace() {
      try {
        const [kitRes, assetRes, linkRes, timelineRes] = await Promise.all([
          api.getKit(Number(kitId)),
          api.getAssets({ kitId: Number(kitId), skip: 0, limit: 50 }),
          api.getLinks(),
          api.getTimeline(Number(kitId)),
        ]);

        if (!active) return;
        setKit(kitRes);
        setAssets(assetRes.items || []);
        setLinks((linkRes || []).filter((link) => link.kit_id === Number(kitId)));
        setTimeline(timelineRes || []);
      } catch (err) {
        if (active) setError(toUserMessage(err));
      }
    }

    loadWorkspace();
    return () => {
      active = false;
    };
  }, [kitId, token]);

  function toggleLinkTag(id) {
    setLinkForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(id) ? prev.tag_ids.filter((item) => item !== id) : [...prev.tag_ids, id],
    }));
  }

  async function submitLink(event) {
    event.preventDefault();
    if (!kitId) return;
    try {
      await api.createLink({ ...linkForm, kit_id: Number(kitId) });
      const allLinks = await api.getLinks();
      setLinks((allLinks || []).filter((link) => link.kit_id === Number(kitId)));
      setLinkForm({ url: "", category: "REVIEW", title: "", notes: "", tag_ids: [] });
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function removeLink(linkId) {
    if (!kitId) return;
    try {
      await api.deleteLink(linkId);
      const allLinks = await api.getLinks();
      setLinks((allLinks || []).filter((link) => link.kit_id === Number(kitId)));
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function submitTimeline(event) {
    event.preventDefault();
    if (!kitId) return;
    try {
      await api.createTimeline(Number(kitId), timelineForm);
      const rows = await api.getTimeline(Number(kitId));
      setTimeline(rows || []);
      setTimelineForm((prev) => ({ ...prev, notes: "" }));
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function submitAsset(event) {
    event.preventDefault();
    if (!kitId || !assetForm.file) return;
    try {
      const formData = new FormData();
      formData.set("kit_id", String(Number(kitId)));
      formData.set("type", assetForm.type);
      formData.set("description", assetForm.description);
      formData.set("is_external_reference", String(assetForm.is_external_reference));
      formData.set("file", assetForm.file);
      await api.uploadAsset(formData);
      const rows = await api.getAssets({ kitId: Number(kitId), skip: 0, limit: 50 });
      setAssets(rows.items || []);
      setAssetForm((prev) => ({ ...prev, description: "", is_external_reference: false, file: null }));
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function removeAsset(assetId) {
    if (!kitId) return;
    try {
      await api.deleteAsset(assetId);
      const rows = await api.getAssets({ kitId: Number(kitId), skip: 0, limit: 50 });
      setAssets(rows.items || []);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  if (!kit) {
    return (
      <section className="page">
        <AppHeader title="Kit Workspace" subtitle="Loading kit details..." onRefresh={() => {}} loading={false} error={error} />
      </section>
    );
  }

  return (
    <section className="page">
      <AppHeader
        title={kit.name}
        subtitle={`${kit.grade} · ${kit.series} · ${String(kit.build_status).replace("BuildStatus.", "")}`}
        onRefresh={() => window.location.reload()}
        loading={false}
        error={error}
      />

      <div className="tab-row">
        {["overview", "assets", "links", "timeline"].map((tabName) => (
          <button
            type="button"
            key={tabName}
            className={tab === tabName ? "tab-pill active" : "tab-pill"}
            onClick={() => setTab(tabName)}
          >
            {tabName}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <article className="panel grid-2">
          <div>
            <h3>Kit Profile</h3>
            <p><strong>Brand:</strong> {kit.brand}</p>
            <p><strong>Scale:</strong> {kit.scale}</p>
            <p><strong>Kit Number:</strong> {kit.kit_number || "-"}</p>
            <p><strong>Shop:</strong> {kit.purchase_shop || "-"}</p>
            <p><strong>Price:</strong> {kit.purchase_price ? `$${Number(kit.purchase_price).toFixed(2)}` : "-"}</p>
          </div>
          <div>
            <h3>Tags</h3>
            <div className="tag-list">
              {(kit.tags || []).map((tag) => (
                <span className="tag active" key={tag.id}>
                  {tag.name}
                </span>
              ))}
              {(kit.tags || []).length === 0 ? <span className="muted">No tags linked.</span> : null}
            </div>
          </div>
          <div className="span-2">
            <div className="panel-head">
              <h3>Image Gallery</h3>
              <button type="button" onClick={() => onSetThumbnailAsset(Number(kitId), null)}>
                Use Placeholder
              </button>
            </div>
            <div className="kit-gallery-grid">
              {imageAssets.map((asset) => (
                <article key={asset.id} className={thumbnailAssetId === asset.id ? "kit-gallery-card active" : "kit-gallery-card"}>
                  <img src={api.assetFileUrl(asset.id)} alt={asset.original_filename} />
                  <div className="kit-gallery-meta">
                    <p>{asset.original_filename}</p>
                    <button type="button" onClick={() => onSetThumbnailAsset(Number(kitId), asset.id)}>
                      {thumbnailAssetId === asset.id ? "Thumbnail Source" : "Set as Thumbnail"}
                    </button>
                  </div>
                </article>
              ))}
              {imageAssets.length === 0 ? (
                <div className="kit-card-empty muted">No image assets yet. Upload in the Assets tab.</div>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}

      {tab === "assets" ? (
        <article className="panel">
          <form className="form-grid" onSubmit={submitAsset}>
            <select value={assetForm.type} onChange={(e) => setAssetForm((prev) => ({ ...prev, type: e.target.value }))}>
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input placeholder="Description" value={assetForm.description} onChange={(e) => setAssetForm((prev) => ({ ...prev, description: e.target.value }))} />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={assetForm.is_external_reference}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, is_external_reference: e.target.checked }))}
              />
              External reference
            </label>
            <input type="file" required onChange={(e) => setAssetForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} />
            <button type="submit" className="span-2">Upload Asset</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      {asset.mime_type.startsWith("image/") ? <img className="asset-preview" src={api.assetFileUrl(asset.id)} alt={asset.original_filename} /> : <span className="muted">No preview</span>}
                    </td>
                    <td>{asset.original_filename}</td>
                    <td>{asset.type}</td>
                    <td className="actions-row">
                      <a href={api.assetFileUrl(asset.id)} target="_blank" rel="noreferrer">Open</a>
                      <button type="button" className="btn-danger" onClick={() => removeAsset(asset.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {tab === "links" ? (
        <article className="panel">
          <form className="form-grid" onSubmit={submitLink}>
            <input required type="url" placeholder="https://..." value={linkForm.url} onChange={(e) => setLinkForm((prev) => ({ ...prev, url: e.target.value }))} />
            <select value={linkForm.category} onChange={(e) => setLinkForm((prev) => ({ ...prev, category: e.target.value }))}>
              {LINK_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <input required placeholder="Title" value={linkForm.title} onChange={(e) => setLinkForm((prev) => ({ ...prev, title: e.target.value }))} />
            <input placeholder="Notes" value={linkForm.notes} onChange={(e) => setLinkForm((prev) => ({ ...prev, notes: e.target.value }))} />
            <div className="tag-list span-2">
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={linkForm.tag_ids.includes(tag.id) ? "tag active" : "tag"}
                  onClick={() => toggleLinkTag(tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <button type="submit" className="span-2">Create Link</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Title</th><th>Category</th><th>URL</th><th>Action</th></tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>{link.title}</td>
                    <td>{link.category}</td>
                    <td><a href={link.url} target="_blank" rel="noreferrer">Open</a></td>
                    <td><button type="button" className="btn-danger" onClick={() => removeLink(link.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {tab === "timeline" ? (
        <article className="panel">
          <form className="form-grid" onSubmit={submitTimeline}>
            <select value={timelineForm.status} onChange={(e) => setTimelineForm((prev) => ({ ...prev, status: e.target.value }))}>
              {BUILD_STATUS.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
            <input placeholder="Timeline notes" value={timelineForm.notes} onChange={(e) => setTimelineForm((prev) => ({ ...prev, notes: e.target.value }))} />
            <button type="submit" className="span-2">Add Timeline Entry</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Created</th><th>Status</th><th>Notes</th></tr></thead>
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
        </article>
      ) : null}
    </section>
  );
}

function TagsPage({ tags, onCreateTag }) {
  const [form, setForm] = useState({ name: "", color: "#d9822b" });

  async function submit(event) {
    event.preventDefault();
    await onCreateTag(form);
    setForm({ name: "", color: "#d9822b" });
  }

  return (
    <section className="page">
      <AppHeader title="Tag Library" subtitle="Maintain reusable labels for kits and links." onRefresh={() => {}} loading={false} />
      <article className="panel grid-2">
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Tag name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          <input type="color" value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} />
          <button type="submit" className="span-2">Create Tag</button>
        </form>
        <div className="tag-cloud">
          {tags.map((tag) => (
            <span key={tag.id} className="tag active" style={{ borderColor: tag.color || "#d9822b" }}>
              {tag.name}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

function SettingsPage({ token }) {
  return (
    <section className="page">
      <AppHeader title="Settings" subtitle="Environment and session information." onRefresh={() => {}} loading={false} />
      <article className="panel">
        <p><strong>API Base URL:</strong> {API_BASE_URL}</p>
        <p><strong>Session:</strong> {token ? "Authenticated" : "Guest"}</p>
      </article>
    </section>
  );
}

function LoginPage({ onLogin, error }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event) {
    event.preventDefault();
    const ok = await onLogin(username, password);
    if (ok) navigate("/dashboard");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="kicker">Artifactory</p>
        <h1>Sign in</h1>
        <p>Use your API account to unlock write workflows.</p>
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="span-2">Log In</button>
        </form>
        {error ? <p className="error-banner">{error}</p> : null}
        <NavLink to="/dashboard" className="ghost-link">Continue in guest mode</NavLink>
      </section>
    </main>
  );
}

export default function App() {
  const location = useLocation();
  const [token, setToken] = useState(() => loadTokenFromStorage());
  const [kits, setKits] = useState([]);
  const [kitPreviewMap, setKitPreviewMap] = useState({});
  const [preferredThumbnailAssetMap, setPreferredThumbnailAssetMap] = useState(() => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(THUMBNAIL_PREF_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState(null);
  const [kitFilters, setKitFilters] = useState(EMPTY_KIT_FILTERS);
  const [kitPage, setKitPage] = useState(1);
  const [kitTotal, setKitTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReferenceData() {
    setLoading(true);
    setError("");
    try {
      const [tagRes, statsRes] = await Promise.all([api.getTags(), api.getStats()]);
      setTags(tagRes || []);
      setStats(statsRes);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadKits({ nextPage = kitPage, nextFilters = kitFilters } = {}) {
    setError("");
    const skip = Math.max(0, (nextPage - 1) * PAGE_SIZE);
    try {
      const payload = Object.values(nextFilters).some((value) => String(value).trim().length > 0)
        ? await api.searchKits({ ...nextFilters, skip, limit: PAGE_SIZE })
        : await api.getKits({ skip, limit: PAGE_SIZE });
      setKits(payload.items || []);
      setKitTotal(payload.total || 0);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  useEffect(() => {
    void loadReferenceData();
  }, [token]);

  useEffect(() => {
    void loadKits({ nextPage: kitPage, nextFilters: kitFilters });
  }, [kitPage, kitFilters, token]);

  useEffect(() => {
    if (kits.length === 0) {
      setKitPreviewMap({});
      return;
    }
    let active = true;

    async function loadKitPreviews() {
      const rows = await Promise.all(
        kits.map(async (kit) => {
          try {
            const payload = await api.getAssets({ kitId: kit.id, skip: 0, limit: 30 });
            const images = (payload.items || []).filter((item) => item.mime_type?.startsWith("image/"));
            const preferredId = preferredThumbnailAssetMap[String(kit.id)];
            const image = images.find((item) => item.id === preferredId) || images[0] || null;
            return [kit.id, image ? api.assetFileUrl(image.id) : null];
          } catch (_) {
            return [kit.id, null];
          }
        })
      );

      if (!active) return;
      const next = {};
      rows.forEach(([id, src]) => {
        next[id] = src;
      });
      setKitPreviewMap(next);
    }

    void loadKitPreviews();
    return () => {
      active = false;
    };
  }, [kits, preferredThumbnailAssetMap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THUMBNAIL_PREF_STORAGE_KEY, JSON.stringify(preferredThumbnailAssetMap));
  }, [preferredThumbnailAssetMap]);

  async function handleCreateKit(payload) {
    const { imageFiles = [], imageAssetType = "BOX_ART", ...kitPayload } = payload;
    try {
      const createdKit = await api.createKit(kitPayload);
      if (imageFiles.length > 0) {
        await Promise.all(
          imageFiles.map(async (file) => {
            const formData = new FormData();
            formData.set("kit_id", String(createdKit.id));
            formData.set("type", imageAssetType);
            formData.set("description", "Uploaded during kit creation");
            formData.set("is_external_reference", "false");
            formData.set("file", file);
            await api.uploadAsset(formData);
          })
        );
      }
      await Promise.all([
        loadKits({ nextPage: 1, nextFilters: kitFilters }),
        loadReferenceData(),
      ]);
      setKitPage(1);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function handleCreateTag(payload) {
    try {
      await api.createTag(payload);
      await loadReferenceData();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function handleLogin(username, password) {
    setError("");
    try {
      const result = await api.login(username, password);
      setAuthToken(result.access_token);
      setToken(result.access_token);
      return true;
    } catch (err) {
      setError(toUserMessage(err));
      return false;
    }
  }

  function handleLogout() {
    setAuthToken(null);
    setToken(null);
    setError("");
  }

  function applyFilters() {
    setKitPage(1);
    void loadKits({ nextPage: 1, nextFilters: kitFilters });
  }

  function clearFilters() {
    setKitFilters(EMPTY_KIT_FILTERS);
    setKitPage(1);
  }

  function setKitThumbnailSource(kitId, assetId) {
    setPreferredThumbnailAssetMap((prev) => {
      const next = { ...prev };
      if (assetId === null || assetId === undefined) {
        delete next[String(kitId)];
      } else {
        next[String(kitId)] = assetId;
      }
      return next;
    });
  }

  const isLoginRoute = location.pathname === "/login";

  if (isLoginRoute) {
    return <LoginPage onLogin={handleLogin} error={error} />;
  }

  return (
    <main className="app-shell">
      <Sidebar token={token} onLogout={handleLogout} />
      <section className="content-shell">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage kits={kits} kitPreviewMap={kitPreviewMap} stats={stats} loading={loading} onRefresh={loadReferenceData} />} />
          <Route
            path="/kits"
            element={
              <KitsPage
                kits={kits}
                kitPreviewMap={kitPreviewMap}
                total={kitTotal}
                page={kitPage}
                filters={kitFilters}
                onPageChange={setKitPage}
                onFilterChange={(field, value) => setKitFilters((prev) => ({ ...prev, [field]: value }))}
                onApplyFilters={applyFilters}
                onClearFilters={clearFilters}
              />
            }
          />
          <Route path="/kits/new" element={<NewKitPage tags={tags} onCreate={handleCreateKit} />} />
          <Route
            path="/kits/:kitId"
            element={
              <KitWorkspacePage
                token={token}
                allTags={tags}
                thumbnailAssetMap={preferredThumbnailAssetMap}
                onSetThumbnailAsset={setKitThumbnailSource}
              />
            }
          />
          <Route path="/tags" element={<TagsPage tags={tags} onCreateTag={handleCreateTag} />} />
          <Route path="/settings" element={<SettingsPage token={token} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </section>
    </main>
  );
}
