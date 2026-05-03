import { useState } from "react";
import { GRADES, BUILD_STATUS, EMPTY_KIT_FORM } from "../constants";
import AppHeader from "../components/AppHeader";
import { api } from "../api/client";

const IMAGE_SECTIONS = [
    { key: "boxArt", label: "Box Art", type: "BOX_ART" },
    { key: "manual", label: "Manual", type: "MANUAL" },
    { key: "buildPhotos", label: "Build Photos", type: "BUILD_PHOTO" },
    { key: "referenceImages", label: "Reference Images", type: "REFERENCE_IMAGE" },
];

export default function NewKitPage({ tags, onCreate }) {
    const [form, setForm] = useState(EMPTY_KIT_FORM);
    const [showOptional, setShowOptional] = useState(false);
    const [sectionFiles, setSectionFiles] = useState({
        boxArt: [],
        manual: [],
        buildPhotos: [],
        referenceImages: [],
    });
    const [submitting, setSubmitting] = useState(false);

    function updateField(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function updateSectionFiles(key, fileList) {
        setSectionFiles((prev) => ({ ...prev, [key]: Array.from(fileList) }));
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
        setSubmitting(true);
        try {
            const kitPayload = {
                ...form,
                purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
                purchase_date: form.purchase_date || null,
            };
            const createdKit = await api.createKit(kitPayload);

            // Upload all selected images in parallel
            const uploads = [];
            for (const section of IMAGE_SECTIONS) {
                for (const file of sectionFiles[section.key]) {
                    const formData = new FormData();
                    formData.set("kit_id", String(createdKit.id));
                    formData.set("type", section.type);
                    formData.set("description", section.label);
                    formData.set("file", file);
                    uploads.push(api.uploadAsset(formData));
                }
            }
            await Promise.all(uploads);

            // Reset form
            setForm(EMPTY_KIT_FORM);
            setSectionFiles({ boxArt: [], manual: [], buildPhotos: [], referenceImages: [] });
            setShowOptional(false);
            if (onCreate) await onCreate(createdKit);
        } finally {
            setSubmitting(false);
        }
    }

    const totalFiles = Object.values(sectionFiles).reduce((sum, files) => sum + files.length, 0);

    return (
        <section className="page">
            <AppHeader
                title="Create Kit"
                subtitle="Add a new kit to your collection."
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
                            placeholder="e.g. Universal Century"
                            value={form.series}
                            onChange={(e) => updateField("series", e.target.value)}
                        />
                    </div>
                    <div className="form-row">
                        <label htmlFor="kit-brand">Brand *</label>
                        <input
                            id="kit-brand"
                            required
                            placeholder="e.g. Bandai"
                            value={form.brand}
                            onChange={(e) => updateField("brand", e.target.value)}
                        />
                    </div>
                    <div className="form-row">
                        <label htmlFor="kit-scale">Scale *</label>
                        <input
                            id="kit-scale"
                            required
                            placeholder="e.g. 1/144"
                            value={form.scale}
                            onChange={(e) => updateField("scale", e.target.value)}
                        />
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
                            </div>
                        </div>
                    ) : null}
                </fieldset>

                {/* Kit Media */}
                {IMAGE_SECTIONS.map((section) => (
                    <fieldset key={section.key} className="form-section">
                        <legend>{section.label}</legend>
                        <input
                            type="file"
                            id={`file-${section.key}`}
                            accept="image/*"
                            multiple
                            onChange={(e) => updateSectionFiles(section.key, e.target.files)}
                        />
                        {sectionFiles[section.key].length > 0 ? (
                            <div className="file-preview-grid">
                                {sectionFiles[section.key].map((file, i) => (
                                    <div key={i} className="file-preview-item">
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt={file.name}
                                        />
                                        <span>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <p className="muted file-count">
                            {sectionFiles[section.key].length} file(s) selected
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
        </section>
    );
}
