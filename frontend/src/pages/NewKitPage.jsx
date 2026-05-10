import { useRef, useState } from "react";
import { GRADES, BUILD_STATUS, EMPTY_KIT_FORM } from "../constants";
import AppHeader from "../components/AppHeader";
import ImmichPicker from "../components/ImmichPicker";
import { api } from "../api/client";

const IMAGE_SECTIONS = [
    { key: "boxArt", label: "Box Art", type: "BOX_ART" },
    { key: "manual", label: "Manual", type: "MANUAL" },
    { key: "buildPhotos", label: "Build Photos", type: "BUILD_PHOTO" },
    { key: "referenceImages", label: "Reference Images", type: "REFERENCE_IMAGE" },
];

export default function NewKitPage({ tags, facetOptions, onCreate }) {
    const [form, setForm] = useState(EMPTY_KIT_FORM);
    const [showOptional, setShowOptional] = useState(false);
    const [sectionItems, setSectionItems] = useState({
        boxArt: [],
        manual: [],
        buildPhotos: [],
        referenceImages: [],
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#d9822b");
    const [immichSection, setImmichSection] = useState(null);
    const nextKeyRef = useRef(1);
    const immichKeyRef = useRef(Date.now());

    function updateField(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function addFiles(sectionKey, fileList) {
        const items = Array.from(fileList).map((file) => ({
            file,
            key: nextKeyRef.current++,
            status: "pending",
        }));
        setSectionItems((prev) => ({
            ...prev,
            [sectionKey]: [...prev[sectionKey], ...items],
        }));
    }

    function removeFile(sectionKey, key) {
        setSectionItems((prev) => ({
            ...prev,
            [sectionKey]: prev[sectionKey].filter((item) => item.key !== key),
        }));
    }

    function handleImmichConfirm(immichAssets) {
        const items = immichAssets.map((a) => ({
            key: immichKeyRef.current++,
            file: null,
            status: "done",
            externalAssetId: a.id,
            thumbnailUrl: a.thumbnailUrl,
            previewUrl: a.thumbnailUrl,
            filename: a.originalFileName || a.id,
        }));
        setSectionItems((prev) => ({
            ...prev,
            [immichSection]: [...prev[immichSection], ...items],
        }));
        setImmichSection(null);
    }

    function toggleTag(id) {
        setForm((prev) => ({
            ...prev,
            tag_ids: prev.tag_ids.includes(id)
                ? prev.tag_ids.filter((item) => item !== id)
                : [...prev.tag_ids, id],
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const kitPayload = {
                ...form,
                purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
                purchase_date: form.purchase_date || null,
            };
            const createdKit = await api.createKit(kitPayload);

            // Upload all files sequentially, tracking status per item
            for (const section of IMAGE_SECTIONS) {
                for (const item of sectionItems[section.key].filter((i) => i.status === "pending")) {
                    setSectionItems((prev) => ({
                        ...prev,
                        [section.key]: prev[section.key].map((i) =>
                            i.key === item.key ? { ...i, status: "uploading" } : i
                        ),
                    }));
                    try {
                        const formData = new FormData();
                        formData.set("kit_id", String(createdKit.id));
                        formData.set("type", section.type);
                        formData.set("description", section.label);
                        formData.set("file", item.file);
                        await api.uploadAsset(formData);
                        setSectionItems((prev) => ({
                            ...prev,
                            [section.key]: prev[section.key].map((i) =>
                                i.key === item.key ? { ...i, status: "done" } : i
                            ),
                        }));
                    } catch (_) {
                        setSectionItems((prev) => ({
                            ...prev,
                            [section.key]: prev[section.key].map((i) =>
                                i.key === item.key ? { ...i, status: "error" } : i
                            ),
                        }));
                    }
                }
            }

            // Upload Immich items (external asset references)
            for (const section of IMAGE_SECTIONS) {
                for (const item of sectionItems[section.key].filter(
                    (i) => i.externalAssetId && !i.file && i.status === "done"
                )) {
                    setSectionItems((prev) => ({
                        ...prev,
                        [section.key]: prev[section.key].map((i) =>
                            i.key === item.key ? { ...i, status: "uploading" } : i
                        ),
                    }));
                    try {
                        const formData = new FormData();
                        formData.set("kit_id", String(createdKit.id));
                        formData.set("type", section.type);
                        formData.set("external_source", "immich");
                        formData.set("external_asset_id", item.externalAssetId);
                        formData.set("external_thumbnail_url", item.thumbnailUrl);
                        await api.uploadAsset(formData);
                        setSectionItems((prev) => ({
                            ...prev,
                            [section.key]: prev[section.key].map((i) =>
                                i.key === item.key ? { ...i, status: "done", saved: true } : i
                            ),
                        }));
                    } catch (_) {
                        setSectionItems((prev) => ({
                            ...prev,
                            [section.key]: prev[section.key].map((i) =>
                                i.key === item.key ? { ...i, status: "error" } : i
                            ),
                        }));
                    }
                }
            }

            if (onCreate) await onCreate(createdKit);
        } catch (err) {
            const detailErrors = err?.details?.errors;
            if (detailErrors && detailErrors.length > 0) {
                setError(detailErrors.map(e => e.msg).join("; "));
            } else {
                setError(err.message || "Failed to create kit");
            }
        } finally {
            setSubmitting(false);
        }
    }

    const totalFiles = Object.values(sectionItems).reduce((sum, items) => sum + items.length, 0);

    return (
        <section className="page">
            <AppHeader
                title="Create Kit"
                subtitle="Add a new kit to your collection."
                error={error}
            />

            <form className="kit-form" onSubmit={handleSubmit}>
                {/* Required Fields */}
                <fieldset className="form-section">
                    <legend>Required Fields</legend>
                    <div className="form-row">
                        <label htmlFor="kit-name">Name *</label>
                        <input
                            id="kit-name"
                            required
                            placeholder="e.g. RX-78-2 Gundam"
                            value={form.name}
                            onChange={(e) => updateField("name", e.target.value)}
                        />
                    </div>
                    <div className="form-row">
                        <label htmlFor="kit-grade">Grade *</label>
                        <select
                            id="kit-grade"
                            value={form.grade}
                            onChange={(e) => updateField("grade", e.target.value)}
                        >
                            {GRADES.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-row">
                        <label htmlFor="kit-series">Series *</label>
                        <input
                            id="kit-series"
                            required
                            list="series-list"
                            placeholder="e.g. Universal Century"
                            value={form.series}
                            onChange={(e) => updateField("series", e.target.value)}
                        />
                        <datalist id="series-list">
                            {(facetOptions?.series || []).map((val) => (
                                <option key={val} value={val} />
                            ))}
                        </datalist>
                    </div>
                    <div className="form-row">
                        <label htmlFor="kit-brand">Brand *</label>
                        <input
                            id="kit-brand"
                            required
                            list="brand-list"
                            placeholder="e.g. Bandai"
                            value={form.brand}
                            onChange={(e) => updateField("brand", e.target.value)}
                        />
                        <datalist id="brand-list">
                            {(facetOptions?.brand || []).map((val) => (
                                <option key={val} value={val} />
                            ))}
                        </datalist>
                    </div>
                    <div className="form-row">
                        <label htmlFor="kit-scale">Scale *</label>
                        <input
                            id="kit-scale"
                            required
                            list="scale-list"
                            placeholder="e.g. 1/144"
                            value={form.scale}
                            onChange={(e) => updateField("scale", e.target.value)}
                        />
                        <datalist id="scale-list">
                            {(facetOptions?.scale || []).map((val) => (
                                <option key={val} value={val} />
                            ))}
                        </datalist>
                    </div>
                </fieldset>

                {/* Optional Details (collapsible) */}
                <fieldset className="form-section">
                    <legend>
                        <button
                            type="button"
                            className="section-toggle"
                            onClick={() => setShowOptional(!showOptional)}
                            aria-expanded={showOptional}
                        >
                            <span className="section-toggle-icon">{showOptional ? "▾" : "▸"}</span>
                            Optional Details
                        </button>
                    </legend>
                    {showOptional ? (
                        <div className="optional-fields">
                            <div className="form-row">
                                <label htmlFor="kit-number">Kit Number</label>
                                <input
                                    id="kit-number"
                                    placeholder="e.g. RG-01-001"
                                    value={form.kit_number}
                                    onChange={(e) => updateField("kit_number", e.target.value)}
                                />
                            </div>
                            <div className="form-row">
                                <label htmlFor="kit-date">Purchase Date</label>
                                <input
                                    id="kit-date"
                                    type="date"
                                    value={form.purchase_date}
                                    onChange={(e) => updateField("purchase_date", e.target.value)}
                                />
                            </div>
                            <div className="form-row">
                                <label htmlFor="kit-price">Purchase Price</label>
                                <input
                                    id="kit-price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={form.purchase_price}
                                    onChange={(e) => updateField("purchase_price", e.target.value)}
                                />
                            </div>
                            <div className="form-row">
                                <label htmlFor="kit-shop">Purchase Shop</label>
                                <input
                                    id="kit-shop"
                                    placeholder="e.g. Local Hobby Shop"
                                    value={form.purchase_shop}
                                    onChange={(e) => updateField("purchase_shop", e.target.value)}
                                />
                            </div>
                            <div className="form-row">
                                <label htmlFor="kit-status">Build Status</label>
                                <select
                                    id="kit-status"
                                    value={form.build_status}
                                    onChange={(e) => updateField("build_status", e.target.value)}
                                >
                                    {BUILD_STATUS.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <label>Tags</label>
                                <div className="tag-list">
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
                                    {tags.length === 0 ? <span className="muted">No tags yet</span> : null}
                                </div>
                                <div className="tag-create-row">
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
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const name = newTagName.trim();
                                            if (!name) return;
                                            try {
                                                const created = await api.createTag({ name, color: newTagColor });
                                                setForm((prev) => ({ ...prev, tag_ids: [...prev.tag_ids, created.id] }));
                                                setNewTagName("");
                                                setNewTagColor("#d9822b");
                                            } catch (_) {}
                                        }}
                                        disabled={!newTagName.trim()}
                                    >
                                        Create Tag
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </fieldset>

                {/* Kit Media */}
                {IMAGE_SECTIONS.map((section) => (
                    <fieldset key={section.key} className="form-section">
                        <legend>{section.label}</legend>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label className="file-input-btn">
                                Select files...
                                <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => addFiles(section.key, e.target.files)}
                                />
                            </label>
                            <button
                                type="button"
                                className="immich-btn"
                                onClick={() => setImmichSection(section.key)}
                            >
                                Immich
                            </button>
                        </div>
                        {sectionItems[section.key].length > 0 ? (
                            <div className="file-preview-grid">
                                {sectionItems[section.key].map((item) => (
                                    <div key={item.key} className={`file-preview-item ${item.status === "error" ? "file-upload-error" : ""}`}>
                                        <img
                                            src={item.file ? URL.createObjectURL(item.file) : item.thumbnailUrl}
                                            alt={item.file?.name || item.filename}
                                        />
                                        <button className="file-preview-remove" type="button"
                                            onClick={() => removeFile(section.key, item.key)}
                                            disabled={item.status === "uploading"}
                                        >×</button>
                                        <span className="file-preview-name">{item.file?.name || item.filename}</span>
                                        <span className={`file-upload-status status-${item.status}`}>
                                            {item.status === "pending" ? "Ready" :
                                             item.status === "uploading" ? "Uploading..." :
                                             item.status === "done" ? "✓ Uploaded" :
                                             "✗ Failed"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <p className="muted file-count">
                            {sectionItems[section.key].length} file(s) selected
                        </p>
                    </fieldset>
                ))}

                <button
                    type="submit"
                    className="form-submit"
                    disabled={submitting}
                >
                    {submitting ? "Creating..." : totalFiles > 0 ? `Create Kit + Upload ${totalFiles} Image(s)` : "Create Kit"}
                </button>
            </form>

            <ImmichPicker
                open={immichSection !== null}
                onClose={() => setImmichSection(null)}
                onConfirm={handleImmichConfirm}
            />
        </section>
    );
}
