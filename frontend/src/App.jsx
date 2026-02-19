import { useEffect, useMemo, useRef, useState } from "react";
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
  brand: [],
  series: [],
  build_status: "",
  scale: [],
  tag: [],
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

function buildKitEditForm(kit) {
  return {
    name: kit.name || "",
    grade: kit.grade || "HG",
    series: kit.series || "",
    brand: kit.brand || "",
    scale: kit.scale || "",
    kit_number: kit.kit_number || "",
    purchase_date: kit.purchase_date || "",
    purchase_price: kit.purchase_price ?? "",
    purchase_shop: kit.purchase_shop || "",
    build_status: String(kit.build_status || "NEW").replace("BuildStatus.", ""),
  };
}

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
    { to: "/dashboard", label: "Dashboard", short: "DB" },
    { to: "/kits", label: "Kits", short: "KT" },
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

function AppHeader({ title, subtitle, error }) {
  return (
    <header className="app-header">
      <div className="app-header-copy">
        <h1>{title}</h1>
        <p className="app-subtitle">{subtitle}</p>
      </div>
      {error ? <p className="error-banner">{error}</p> : null}
    </header>
  );
}

function DashboardPage({ kits, kitPreviewMap, stats }) {
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

function KitsPage({
  kits,
  kitPreviewMap,
  tags,
  facetOptions,
  total,
  filters,
  onFilterChange,
  onToggleFilterValue,
  onClearFilters,
  onLoadMore,
  hasMore,
  loadingMore,
}) {
  const loadMoreRef = useRef(null);
  const listScrollRef = useRef(null);
  const hasActiveFilters = Object.values(filters).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  });

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: listScrollRef.current, rootMargin: "180px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <section className="page kits-inventory-page kits-inventory-split">
      <aside className="kits-header-panel">
        <AppHeader
          title="Kit Inventory"
          subtitle="Search, filter, and route into per-kit workspaces."
        />
      </aside>

      <section className="kits-right-stack">
        <article className="panel kits-banner-panel">
          <div className="panel-head">
            <h2>Kits</h2>
            <NavLink to="/kits/new" className="inline-cta">
              + Add Kit
            </NavLink>
          </div>
          <form
            className="filter-grid kits-filter-stack"
            onSubmit={(event) => {
              event.preventDefault();
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
            <div className="multi-filter">
              <p>Brand</p>
              <div className="check-grid">
                {facetOptions.brand.map((item) => (
                  <label key={`brand-${item}`} className={filters.brand.includes(item) ? "filter-chip active" : "filter-chip"}>
                    <input
                      type="checkbox"
                      checked={filters.brand.includes(item)}
                      onChange={() => onToggleFilterValue("brand", item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
                {facetOptions.brand.length === 0 ? <span className="muted">No options</span> : null}
              </div>
            </div>
            <div className="multi-filter">
              <p>Series</p>
              <div className="check-grid">
                {facetOptions.series.map((item) => (
                  <label key={`series-${item}`} className={filters.series.includes(item) ? "filter-chip active" : "filter-chip"}>
                    <input
                      type="checkbox"
                      checked={filters.series.includes(item)}
                      onChange={() => onToggleFilterValue("series", item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
                {facetOptions.series.length === 0 ? <span className="muted">No options</span> : null}
              </div>
            </div>
            <div className="multi-filter">
              <p>Scale</p>
              <div className="check-grid">
                {facetOptions.scale.map((item) => (
                  <label key={`scale-${item}`} className={filters.scale.includes(item) ? "filter-chip active" : "filter-chip"}>
                    <input
                      type="checkbox"
                      checked={filters.scale.includes(item)}
                      onChange={() => onToggleFilterValue("scale", item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
                {facetOptions.scale.length === 0 ? <span className="muted">No options</span> : null}
              </div>
            </div>
            <div className="multi-filter">
              <p>Tags</p>
              <div className="check-grid">
                {tags.map((tag) => (
                  <label key={`tag-filter-${tag.id}`} className={filters.tag.includes(tag.name) ? "filter-chip active" : "filter-chip"}>
                    <input
                      type="checkbox"
                      checked={filters.tag.includes(tag.name)}
                      onChange={() => onToggleFilterValue("tag", tag.name)}
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
                {tags.length === 0 ? <span className="muted">No tags</span> : null}
              </div>
            </div>
            <div className="actions-row">
              <button type="button" onClick={onClearFilters}>
                Clear
              </button>
            </div>
          </form>
          <p className="muted inventory-meta">
            Showing {kits.length} of {total} kits {hasActiveFilters ? "(filtered)" : ""}
          </p>
        </article>

        <article className="panel kits-list-panel">
          <div className="kits-list-scroll" ref={listScrollRef}>
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
            <div ref={loadMoreRef} className="load-more-anchor" />
            {loadingMore ? <p className="muted load-more-text">Loading more kits...</p> : null}
            {!hasMore && kits.length > 0 ? <p className="muted load-more-text">End of list.</p> : null}
          </div>
        </article>
      </section>
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

function KitWorkspacePage({
  token,
  allTags,
  thumbnailAssetMap,
  onSetThumbnailAsset,
  onKitMutated,
  onKitDeleted,
}) {
  const navigate = useNavigate();
  const { kitId } = useParams();
  const [tab, setTab] = useState("overview");
  const [kit, setKit] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const [editForm, setEditForm] = useState(null);
  const [selectedCoverCandidateId, setSelectedCoverCandidateId] = useState(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [selectedExistingTagId, setSelectedExistingTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#d9822b");
  const thumbnailAssetId = thumbnailAssetMap?.[String(kitId)] || null;
  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.mime_type?.startsWith("image/")),
    [assets]
  );
  const coverAsset = useMemo(
    () => imageAssets.find((asset) => asset.id === thumbnailAssetId) || imageAssets[0] || null,
    [imageAssets, thumbnailAssetId]
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
        setEditForm(buildKitEditForm(kitRes));
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

  useEffect(() => {
    if (imageAssets.length === 0) {
      setSelectedCoverCandidateId(null);
      return;
    }
    const preferred = imageAssets.find((asset) => asset.id === thumbnailAssetId);
    setSelectedCoverCandidateId((prev) => prev || preferred?.id || imageAssets[0].id);
  }, [imageAssets, thumbnailAssetId]);

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

  async function submitKitUpdate(event) {
    event.preventDefault();
    if (!kitId || !editForm) return;
    setIsSaving(true);
    setError("");
    try {
      const payload = {
        ...editForm,
        purchase_price:
          editForm.purchase_price === "" || editForm.purchase_price === null
            ? null
            : Number(editForm.purchase_price),
        purchase_date: editForm.purchase_date || null,
      };
      const updated = await api.updateKit(Number(kitId), payload);
      setKit(updated);
      setEditForm(buildKitEditForm(updated));
      setIsEditing(false);
      if (onKitMutated) await onKitMutated();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteKit() {
    if (!kitId) return;
    if (!window.confirm("Delete this kit and all related assets/links/timeline entries?")) return;
    setError("");
    try {
      await api.deleteKit(Number(kitId));
      if (onKitDeleted) await onKitDeleted();
      navigate("/kits");
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  function applySelectedCover() {
    if (!kitId || !selectedCoverCandidateId) return;
    onSetThumbnailAsset(Number(kitId), selectedCoverCandidateId);
  }

  async function updateKitTagIds(nextTagIds) {
    if (!kitId) return;
    const updated = await api.updateKit(Number(kitId), { tag_ids: nextTagIds });
    setKit(updated);
    if (onKitMutated) await onKitMutated();
  }

  async function removeKitTag(tagId) {
    if (!kit) return;
    const nextTagIds = (kit.tags || []).map((tag) => tag.id).filter((id) => id !== tagId);
    try {
      await updateKitTagIds(nextTagIds);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function assignExistingTag() {
    if (!kit || !selectedExistingTagId) return;
    const existing = new Set((kit.tags || []).map((tag) => tag.id));
    existing.add(Number(selectedExistingTagId));
    try {
      await updateKitTagIds(Array.from(existing));
      setSelectedExistingTagId("");
      setTagPickerOpen(false);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function createAndAssignTag() {
    if (!kit) return;
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await api.createTag({ name, color: newTagColor });
      const existing = new Set((kit.tags || []).map((tag) => tag.id));
      existing.add(created.id);
      await updateKitTagIds(Array.from(existing));
      setNewTagName("");
      setNewTagColor("#d9822b");
      setTagPickerOpen(false);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  if (!kit) {
    return (
      <section className="page">
      <AppHeader title="Kit Workspace" subtitle="Loading kit details..." error={error} />
      </section>
    );
  }

  return (
    <section className="page">
      <AppHeader
        title={kit.name}
        subtitle={`${kit.grade} · ${kit.series} · ${String(kit.build_status).replace("BuildStatus.", "")}`}
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
            <div className="panel-head">
              <h3>Kit Profile</h3>
              <div className="actions-row">
                <button type="button" onClick={() => setIsEditing((prev) => !prev)}>
                  {isEditing ? "Cancel Edit" : "Edit Basic Info"}
                </button>
                <button type="button" className="btn-danger" onClick={deleteKit}>
                  Delete Kit
                </button>
              </div>
            </div>
            {isEditing && editForm ? (
              <form className="form-grid" onSubmit={submitKitUpdate}>
                <input required value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                <select value={editForm.grade} onChange={(e) => setEditForm((prev) => ({ ...prev, grade: e.target.value }))}>
                  {GRADES.map((grade) => <option key={`edit-grade-${grade}`} value={grade}>{grade}</option>)}
                </select>
                <input required value={editForm.series} onChange={(e) => setEditForm((prev) => ({ ...prev, series: e.target.value }))} />
                <input required value={editForm.brand} onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))} />
                <input required value={editForm.scale} onChange={(e) => setEditForm((prev) => ({ ...prev, scale: e.target.value }))} />
                <input value={editForm.kit_number} onChange={(e) => setEditForm((prev) => ({ ...prev, kit_number: e.target.value }))} />
                <input type="date" value={editForm.purchase_date} onChange={(e) => setEditForm((prev) => ({ ...prev, purchase_date: e.target.value }))} />
                <input type="number" step="0.01" min="0" value={editForm.purchase_price} onChange={(e) => setEditForm((prev) => ({ ...prev, purchase_price: e.target.value }))} />
                <input value={editForm.purchase_shop} onChange={(e) => setEditForm((prev) => ({ ...prev, purchase_shop: e.target.value }))} />
                <select value={editForm.build_status} onChange={(e) => setEditForm((prev) => ({ ...prev, build_status: e.target.value }))}>
                  {BUILD_STATUS.map((status) => <option key={`edit-status-${status}`} value={status}>{status}</option>)}
                </select>
                <button type="submit" className="span-2" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </form>
            ) : (
              <>
            <p><strong>Brand:</strong> {kit.brand}</p>
            <p><strong>Scale:</strong> {kit.scale}</p>
            <p><strong>Kit Number:</strong> {kit.kit_number || "-"}</p>
            <p><strong>Shop:</strong> {kit.purchase_shop || "-"}</p>
            <p><strong>Price:</strong> {kit.purchase_price ? `$${Number(kit.purchase_price).toFixed(2)}` : "-"}</p>
              </>
            )}
          </div>
          <div>
            <h3>Tags</h3>
            <div className="tag-list kit-tags-list">
              {(kit.tags || []).map((tag) => (
                <button type="button" className="tag active tag-edit-chip" key={tag.id} onClick={() => removeKitTag(tag.id)}>
                  <span>{tag.name}</span>
                  <span className="tag-chip-remove" aria-hidden="true">
                    x
                  </span>
                </button>
              ))}
              <button type="button" className="tag tag-add-chip" onClick={() => setTagPickerOpen((prev) => !prev)}>
                + Add tag
              </button>
            </div>
            {(kit.tags || []).length === 0 ? <span className="muted">No tags linked yet.</span> : null}
            {tagPickerOpen ? (
              <div className="tag-picker-panel">
                <div className="actions-row">
                  <select value={selectedExistingTagId} onChange={(e) => setSelectedExistingTagId(e.target.value)}>
                    <option value="">Select existing tag</option>
                    {allTags
                      .filter((tag) => !(kit.tags || []).some((assigned) => assigned.id === tag.id))
                      .map((tag) => (
                        <option key={`assign-tag-${tag.id}`} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                  <button type="button" onClick={assignExistingTag} disabled={!selectedExistingTagId}>
                    Assign
                  </button>
                </div>
                <div className="actions-row">
                  <input
                    placeholder="New tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                  <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
                  <button type="button" onClick={createAndAssignTag} disabled={!newTagName.trim()}>
                    Create + Assign
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="span-2">
            <div className="cover-panel">
              <div className="cover-panel-media">
                {coverAsset ? (
                  <img src={api.assetFileUrl(coverAsset.id)} alt={coverAsset.original_filename} />
                ) : (
                  <div className="kit-card-placeholder">
                    <span>{kit.grade}</span>
                  </div>
                )}
              </div>
              <div className="cover-panel-info">
                <h3>Cover Image</h3>
                <p className="muted">
                  {coverAsset
                    ? `Current source: ${coverAsset.original_filename}`
                    : "No image selected. Placeholder is currently used."}
                </p>
                <div className="actions-row">
                  <button type="button" onClick={applySelectedCover} disabled={!selectedCoverCandidateId}>
                    Set Selected as Cover
                  </button>
                  <button type="button" onClick={() => onSetThumbnailAsset(Number(kitId), null)}>
                    Use Placeholder
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="span-2">
            <div className="panel-head">
              <h3>Image Gallery</h3>
              <p className="muted">Select one image, then use the cover action above.</p>
            </div>
            <div className="kit-gallery-grid">
              {imageAssets.map((asset) => (
                <article
                  key={asset.id}
                  className={[
                    "kit-gallery-card",
                    thumbnailAssetId === asset.id ? "is-cover" : "",
                    selectedCoverCandidateId === asset.id ? "active" : "",
                  ].join(" ").trim()}
                  onClick={() => setSelectedCoverCandidateId(asset.id)}
                >
                  <img src={api.assetFileUrl(asset.id)} alt={asset.original_filename} />
                  <div className="kit-gallery-meta">
                    <p>{asset.original_filename}</p>
                    {thumbnailAssetId === asset.id ? <span className="gallery-badge">Current Cover</span> : null}
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

function SettingsPage({ token }) {
  return (
    <section className="page">
      <AppHeader title="Settings" subtitle="Environment and session information." />
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
  const [kitFacetOptions, setKitFacetOptions] = useState({ brand: [], series: [], scale: [] });
  const [stats, setStats] = useState(null);
  const [kitFilters, setKitFilters] = useState(EMPTY_KIT_FILTERS);
  const [kitPage, setKitPage] = useState(1);
  const [kitTotal, setKitTotal] = useState(0);
  const [kitsLoadingMore, setKitsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReferenceData() {
    setLoading(true);
    setError("");
    try {
      const [tagRes, statsRes, kitRes] = await Promise.all([
        api.getTags(),
        api.getStats(),
        api.getKits({ skip: 0, limit: 100 }),
      ]);
      setTags(tagRes || []);
      setStats(statsRes);
      const rows = kitRes.items || [];
      setKitFacetOptions({
        brand: [...new Set(rows.map((item) => item.brand).filter(Boolean))].sort(),
        series: [...new Set(rows.map((item) => item.series).filter(Boolean))].sort(),
        scale: [...new Set(rows.map((item) => item.scale).filter(Boolean))].sort(),
      });
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadKits({ nextPage = 1, nextFilters = kitFilters, append = false } = {}) {
    setError("");
    if (append) setKitsLoadingMore(true);
    const skip = Math.max(0, (nextPage - 1) * PAGE_SIZE);
    try {
      const payload = Object.values(nextFilters).some((value) => String(value).trim().length > 0)
        ? await api.searchKits({ ...nextFilters, skip, limit: PAGE_SIZE })
        : await api.getKits({ skip, limit: PAGE_SIZE });
      if (append) {
        setKits((prev) => {
          const merged = [...prev, ...(payload.items || [])];
          const byId = new Map(merged.map((item) => [item.id, item]));
          return Array.from(byId.values());
        });
      } else {
        setKits(payload.items || []);
      }
      setKitTotal(payload.total || 0);
      setKitPage(nextPage);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      if (append) setKitsLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadReferenceData();
  }, [token]);

  useEffect(() => {
    void loadKits({ nextPage: 1, nextFilters: kitFilters, append: false });
  }, [token]);

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
        loadKits({ nextPage: 1, nextFilters: kitFilters, append: false }),
        loadReferenceData(),
      ]);
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

  function updateKitFilters(updater) {
    setKitFilters((prev) => {
      const next =
        typeof updater === "function"
          ? updater(prev)
          : {
              ...prev,
              ...updater,
            };
      void loadKits({ nextPage: 1, nextFilters: next, append: false });
      return next;
    });
  }

  function clearFilters() {
    setKitFilters(EMPTY_KIT_FILTERS);
    void loadKits({ nextPage: 1, nextFilters: EMPTY_KIT_FILTERS, append: false });
  }

  async function handleKitMutation() {
    await Promise.all([
      loadKits({ nextPage: 1, nextFilters: kitFilters, append: false }),
      loadReferenceData(),
    ]);
  }

  async function handleKitDeletion() {
    await Promise.all([
      loadKits({ nextPage: 1, nextFilters: kitFilters, append: false }),
      loadReferenceData(),
    ]);
  }

  async function loadMoreKits() {
    if (kitsLoadingMore) return;
    if (kits.length >= kitTotal) return;
    await loadKits({ nextPage: kitPage + 1, nextFilters: kitFilters, append: true });
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
          <Route path="/dashboard" element={<DashboardPage kits={kits} kitPreviewMap={kitPreviewMap} stats={stats} />} />
          <Route
            path="/kits"
            element={
              <KitsPage
                kits={kits}
                kitPreviewMap={kitPreviewMap}
                tags={tags}
                facetOptions={kitFacetOptions}
                total={kitTotal}
                filters={kitFilters}
                onFilterChange={(field, value) =>
                  updateKitFilters((prev) => ({
                    ...prev,
                    [field]: value,
                  }))
                }
                onToggleFilterValue={(field, value) =>
                  updateKitFilters((prev) => {
                    const current = Array.isArray(prev[field]) ? prev[field] : [];
                    return {
                      ...prev,
                      [field]: current.includes(value)
                        ? current.filter((item) => item !== value)
                        : [...current, value],
                    };
                  })
                }
                onClearFilters={clearFilters}
                onLoadMore={loadMoreKits}
                hasMore={kits.length < kitTotal}
                loadingMore={kitsLoadingMore}
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
                onKitMutated={handleKitMutation}
                onKitDeleted={handleKitDeletion}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage token={token} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </section>
    </main>
  );
}
