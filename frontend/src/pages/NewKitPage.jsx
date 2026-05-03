import { useState } from "react";
import { GRADES, BUILD_STATUS, EMPTY_KIT_FORM } from "../constants";
import AppHeader from "../components/AppHeader";

export default function NewKitPage({ tags, onCreate }) {
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
