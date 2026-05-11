import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, API_BASE_URL } from "../api/client";
import { GRADES, BUILD_STATUS, LINK_CATEGORIES } from "../constants";
import { buildKitEditForm, toUserMessage } from "../utils";
import AppHeader from "../components/AppHeader";
import ImageViewer from "../components/ImageViewer";
import ImmichPicker from "../components/ImmichPicker";
import immichIcon from "../assets/immich-icon.svg";

function assetUrl(path) {
    if (path && path.startsWith("/api/v1/")) {
        return `${API_BASE_URL}${path.slice(7)}`;
    }
    return path;
}

function getAssetDisplayUrl(asset) {
    if (!asset) return "";
    if (asset.external_source === "immich" && asset.external_thumbnail_url) {
        return asset.external_thumbnail_url;
    }
    if (asset.external_source === "immich") {
        return api.getImmichThumbUrl(asset.external_asset_id);
    }
    if (asset.thumbnail_url) {
        return assetUrl(asset.thumbnail_url);
    }
    return api.assetFileUrl(asset.id);
}

export default function KitWorkspacePage({
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
  const [pendingFiles, setPendingFiles] = useState({});
  const [editForm, setEditForm] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [immichSection, setImmichSection] = useState(null);
  const [selectedExistingTagId, setSelectedExistingTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#d9822b");
  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.mime_type?.startsWith("image/")),
    [assets]
  );
  const coverAsset = useMemo(
    () => {
      const coverId = thumbnailAssetMap?.[String(kitId)] || null;
      return imageAssets.find((asset) => asset.id === coverId) || imageAssets[0] || null;
    },
    [imageAssets, thumbnailAssetMap, kitId]
  );
  const imageAssetsByType = useMemo(() => {
    const groups = {};
    for (const asset of imageAssets) {
      const label = asset.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      if (!groups[asset.type]) groups[asset.type] = { label, assets: [] };
      groups[asset.type].assets.push(asset);
    }
    return Object.values(groups);
  }, [imageAssets]);

  const ASSET_SECTIONS = [
    { type: "BOX_ART", label: "Box Art", image: true },
    { type: "MANUAL", label: "Manual", image: true },
    { type: "BUILD_PHOTO", label: "Build Photos", image: true },
    { type: "REFERENCE_IMAGE", label: "Reference Images", image: true },
    { type: "VIDEO", label: "Videos", image: false },
    { type: "DOCUMENT", label: "Documents", image: false },
  ];

  useEffect(() => {
    if (!kitId) return;
    let active = true;

    async function loadWorkspace() {
      try {
        const [kitRes, assetRes, linkRes, timelineRes] = await Promise.all([
          api.getKit(Number(kitId)),
          api.getAssets({ kitId: Number(kitId), skip: 0, limit: 50 }),
          api.getLinks(Number(kitId)),
          api.getTimeline(Number(kitId)),
        ]);

        if (!active) return;
        setKit(kitRes);
        setEditForm(buildKitEditForm(kitRes));
        setAssets(assetRes.items || []);
        setLinks(linkRes || []);
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
      const allLinks = await api.getLinks(Number(kitId));
      setLinks(allLinks || []);
      setLinkForm({ url: "", category: "REVIEW", title: "", notes: "", tag_ids: [] });
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function removeLink(linkId) {
    if (!kitId) return;
    try {
      await api.deleteLink(linkId);
      const allLinks = await api.getLinks(Number(kitId));
      setLinks(allLinks || []);
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

  async function handleImmichConfirm(immichAssets) {
    setError("");
    try {
      for (const a of immichAssets) {
        const fd = new FormData();
        fd.set("kit_id", String(Number(kitId)));
        fd.set("type", immichSection);
        fd.set("external_source", "immich");
        fd.set("external_asset_id", a.id);
        fd.set("external_thumbnail_url", a.thumbnailUrl);
        await api.uploadAsset(fd);
      }
      const rows = await api.getAssets({ kitId: Number(kitId), skip: 0, limit: 50 });
      setAssets(rows.items || []);
    } catch (err) {
      setError(toUserMessage(err));
    }
    setImmichSection(null);
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
                  <input
                    type="color"
                    className="color-input"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                  />
                  <button type="button" onClick={createAndAssignTag} disabled={!newTagName.trim()}>
                    Create + Assign
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="span-2">
            <h3>Cover Image</h3>
            <div className="cover-panel-media" style={{ marginTop: "0.5rem" }}>
              {coverAsset ? (
                <img src={getAssetDisplayUrl(coverAsset)} alt={coverAsset.original_filename} onClick={() => {
                  const idx = imageAssets.findIndex(a => a.id === coverAsset.id);
                  setViewerOpen(true);
                  setViewerIndex(idx >= 0 ? idx : 0);
                }} style={{ cursor: "pointer" }} />
              ) : (
                <div className="kit-card-placeholder">
                  <span>{kit.grade}</span>
                </div>
              )}
            </div>
            <p className="muted" style={{ marginTop: "0.3rem" }}>
              {coverAsset ? "Click to open viewer. Use the viewer to change cover." : "No cover set. Open an image in the viewer to set as cover."}
            </p>
          </div>
          <div className="span-2">
            <h3>Image Gallery</h3>
            {imageAssetsByType.map((group) => (
              <div key={group.label} style={{ marginTop: "0.8rem" }}>
                <h4 style={{ margin: "0 0 0.5rem" }}>{group.label}</h4>
                <div className="kit-gallery-grid">
                  {group.assets.map((asset) => (
                    <article
                      key={asset.id}
                      className={`kit-gallery-card ${coverAsset?.id === asset.id ? "is-cover" : ""}`}
                      onClick={() => {
                        const allImages = imageAssets;
                        const idx = allImages.findIndex(a => a.id === asset.id);
                        setViewerOpen(true);
                        setViewerIndex(idx >= 0 ? idx : 0);
                      }}
                    >
                      <div className="kit-gallery-thumb-wrap">
                        <img src={getAssetDisplayUrl(asset)} alt={asset.original_filename} />
                        <span className={`asset-source-badge ${asset.external_source === "immich" ? "source-immich" : "source-native"}`}>
                          {asset.external_source === "immich" ? "IMMICH" : "NATIVE"}
                        </span>
                      </div>
                      <div className="kit-gallery-meta">
                        <p>{asset.original_filename}</p>
                        {coverAsset?.id === asset.id ? <span className="gallery-badge">Cover</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
            {imageAssets.length === 0 ? (
              <div className="kit-card-empty muted" style={{ marginTop: "0.7rem" }}>No image assets yet. Upload in the Assets tab.</div>
            ) : null}

            {/* Links summary */}
            {links.length > 0 ? (
              <div className="span-2" style={{ marginTop: "0.5rem" }}>
                <div className="panel-head">
                  <h3>Links ({links.length})</h3>
                </div>
                <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
                  <table>
                    <tbody>
                      {links.slice(0, 5).map((link) => (
                        <tr key={link.id}>
                          <td><a href={link.url} target="_blank" rel="noreferrer">{link.title}</a></td>
                          <td><span className="muted">{link.category}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Timeline summary */}
            {timeline.length > 0 ? (
              <div className="span-2" style={{ marginTop: "0.5rem" }}>
                <div className="panel-head">
                  <h3>Timeline ({timeline.length})</h3>
                </div>
                <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
                  <table>
                    <tbody>
                      {timeline.slice(0, 5).map((entry) => (
                        <tr key={entry.id}>
                          <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                          <td>{entry.status.replace("BuildStatus.", "")}</td>
                          <td><span className="muted">{entry.notes || "-"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}

      {tab === "assets" ? (
        <article className="panel">
          <div className="panel-head">
            <h3>Assets</h3>
          </div>

          {ASSET_SECTIONS.map((section) => {
            const sectionAssets = assets.filter((a) => a.type === section.type);
            const pendingForSection = pendingFiles[section.type] || [];

            return (
              <fieldset key={section.type} className="form-section">
                <legend>
                  {section.label}
                  <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                    ({sectionAssets.length})
                  </span>
                </legend>

                {/* Existing assets */}
                {sectionAssets.length > 0 ? (
                  section.image ? (
                    <div className="file-preview-grid">
                      {sectionAssets.map((asset) => (
                        <div key={asset.id} className="file-preview-item">
                          <div className="kit-gallery-thumb-wrap">
                            <img src={getAssetDisplayUrl(asset)} alt={asset.original_filename} />
                            {asset.external_source === "immich" ? (
                              <img className="asset-source-badge" src={immichIcon} alt="Immich" />
                            ) : (
                              <span className="asset-source-badge source-native">N</span>
                            )}
                          </div>
                          <span>{asset.original_filename}</span>
                          <button
                            type="button"
                            className="btn-danger file-preview-delete"
                            onClick={() => removeAsset(asset.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <tbody>
                          {sectionAssets.map((asset) => (
                            <tr key={asset.id}>
                              <td>
                                <a href={getAssetDisplayUrl(asset)} target="_blank" rel="noreferrer">
                                  {asset.original_filename}
                                </a>
                              </td>
                              <td>{asset.description || "-"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-danger"
                                  onClick={() => removeAsset(asset.id)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <p className="muted">No {section.label.toLowerCase()} yet.</p>
                )}

                {/* Pending files preview */}
                {pendingForSection.length > 0 ? (
                  <div className="file-preview-grid" style={{ marginTop: "0.5rem" }}>
                    {pendingForSection.map((file, i) => (
                      <div key={`pending-${i}`} className="file-preview-item file-preview-pending">
                        {file.type.startsWith("image/") ? (
                          <img src={URL.createObjectURL(file)} alt={file.name} />
                        ) : (
                          <div className="file-preview-placeholder">{file.name.split(".").pop()}</div>
                        )}
                        <span>{file.name}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Add files */}
                <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <label className="file-input-btn">
                    Add files...
                    <input
                      type="file"
                      hidden
                      accept={section.image ? "image/*" : undefined}
                      multiple
                      onChange={(e) => {
                        setPendingFiles((prev) => ({
                          ...prev,
                          [section.type]: Array.from(e.target.files || []),
                        }));
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="immich-btn"
                    onClick={() => setImmichSection(section.type)}
                  >
                    Immich
                  </button>
                </div>
              </fieldset>
            );
          })}

          {/* Upload all pending */}
          {Object.values(pendingFiles).some((files) => files.length > 0) ? (
            <button
              type="button"
              className="form-submit"
              onClick={async () => {
                setError("");
                try {
                  const uploads = [];
                  for (const [type, files] of Object.entries(pendingFiles)) {
                    for (const file of files) {
                      const formData = new FormData();
                      formData.set("kit_id", String(Number(kitId)));
                      formData.set("type", type);
                      formData.set("file", file);
                      uploads.push(api.uploadAsset(formData));
                    }
                  }
                  await Promise.all(uploads);
                  setPendingFiles({});
                  // Refresh assets
                  const rows = await api.getAssets({ kitId: Number(kitId), skip: 0, limit: 50 });
                  setAssets(rows.items || []);
                } catch (err) {
                  setError(toUserMessage(err));
                }
              }}
            >
              Upload Pending Files
            </button>
          ) : null}
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
      {viewerOpen ? (
        <ImageViewer
          images={imageAssets}
          currentIndex={viewerIndex}
          coverId={coverAsset?.id}
          onClose={() => setViewerOpen(false)}
          onNavigate={setViewerIndex}
          onSetCover={(assetId) => {
            if (onSetThumbnailAsset) onSetThumbnailAsset(Number(kitId), assetId);
          }}
        />
      ) : null}

      <ImmichPicker
        open={immichSection !== null}
        onClose={() => setImmichSection(null)}
        onConfirm={handleImmichConfirm}
      />
    </section>
  );
}
