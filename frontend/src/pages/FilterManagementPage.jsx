import { useState, useEffect, useMemo } from "react";
import { api, ApiError } from "../api/client";
import { BUILD_STATUS, CUSTOM_FACET_STORAGE_KEY } from "../constants";
import { caseFold, toUserMessage } from "../utils";
import AppHeader from "../components/AppHeader";

export default function FilterManagementPage({
  token,
  customFacetValues,
  onCreateCustomFacetValue,
  onRenameCustomFacetValue,
}) {
  const [kits, setKits] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [field, setField] = useState("brand");
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newTagColor, setNewTagColor] = useState("#d9822b");

  const fieldOptions = [
    { value: "brand", label: "Brand" },
    { value: "series", label: "Series" },
    { value: "scale", label: "Scale" },
    { value: "tag", label: "Tag" },
  ];

  const facetSummary = useMemo(() => {
    const map = new Map();
    if (field === "tag") {
      for (const tag of tags) {
        const value = String(tag.name || "").trim();
        if (!value) continue;
        map.set(caseFold(value), { value, count: 0 });
      }
      for (const kit of kits) {
        for (const tag of kit.tags || []) {
          const value = String(tag.name || "").trim();
          if (!value) continue;
          const key = caseFold(value);
          if (!map.has(key)) {
            map.set(key, { value, count: 1 });
          } else {
            map.get(key).count += 1;
          }
        }
      }
    } else {
      for (const custom of customFacetValues[field] || []) {
        const value = String(custom || "").trim();
        if (!value) continue;
        map.set(caseFold(value), { value, count: 0 });
      }
      for (const kit of kits) {
        const value = String(kit[field] || "").trim();
        if (!value) continue;
        const key = caseFold(value);
        if (!map.has(key)) {
          map.set(key, { value, count: 1 });
        } else {
          map.get(key).count += 1;
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [kits, tags, field, customFacetValues]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [allTags, allKits] = await Promise.all([
        api.getTags(),
        (async () => {
          const pageSize = 100;
          let skip = 0;
          let total = 0;
          const rows = [];
          do {
            const payload = await api.getKits({ skip, limit: pageSize });
            rows.push(...(payload.items || []));
            total = payload.total || 0;
            skip += pageSize;
          } while (skip < total);
          return rows;
        })(),
      ]);
      setTags(allTags || []);
      setKits(allKits || []);
      if (!fromValue && allKits.length > 0) {
        setFromValue(String(allKits[0][field] || ""));
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void loadData();
  }, [token]);

  useEffect(() => {
    if (facetSummary.length === 0) {
      setFromValue("");
      return;
    }
    if (!facetSummary.some((item) => item.value === fromValue)) {
      setFromValue(facetSummary[0].value);
    }
  }, [facetSummary, fromValue]);

  useEffect(() => {
    setToValue(fromValue || "");
  }, [field, fromValue]);

  async function applyRename() {
    const nextValue = toValue.trim();
    if (!fromValue || !nextValue || fromValue === nextValue) return;
    const fromKey = caseFold(fromValue);
    setSaving(true);
    setError("");
    try {
      if (field === "tag") {
        const matchedTags = tags.filter((tag) => caseFold(tag.name) === fromKey);
        if (matchedTags.length === 0) return;
        for (const tag of matchedTags) {
          await api.updateTag(tag.id, { name: nextValue });
        }
      } else {
        const affected = kits.filter((kit) => caseFold(kit[field]) === fromKey);
        for (const kit of affected) {
          await api.updateKit(kit.id, { [field]: nextValue });
        }
        onRenameCustomFacetValue(field, fromValue, nextValue);
      }
      setToValue("");
      await loadData();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function createFilterValue() {
    const value = newValue.trim();
    if (!value) return;
    setSaving(true);
    setError("");
    try {
      if (field === "tag") {
        await api.createTag({ name: value, color: newTagColor });
        setNewTagColor("#d9822b");
        await loadData();
      } else {
        // Call server API to persist the filter value
        try {
          await api.createFilterValue(field, value);
        } catch (_) {
          // Ignore API errors — localStorage fallback below
        }
        onCreateCustomFacetValue(field, value);
      }
      setNewValue("");
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <AppHeader title="Filter Management" subtitle="Authenticated workspace for maintaining filter source values." error={error} />
      <article className="panel filter-management-panel">
        <div className="form-grid filter-management-row">
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {fieldOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select value={fromValue} onChange={(e) => setFromValue(e.target.value)}>
            {facetSummary.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value} ({item.count})
              </option>
            ))}
          </select>
          <input placeholder="Rename to..." value={toValue} onChange={(e) => setToValue(e.target.value)} />
          <button
            className="filter-action-btn"
            type="button"
            onClick={applyRename}
            disabled={saving || !fromValue || !toValue.trim()}
          >
            {saving ? "Applying..." : "Apply Rename"}
          </button>
        </div>
        <div className="form-grid filter-management-row create-filter-row">
          <input placeholder={`Create new ${field} value`} value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <button className="filter-action-btn" type="button" onClick={createFilterValue} disabled={saving || !newValue.trim()}>
            Create
          </button>
          {field === "tag" ? (
            <input type="color" className="color-input" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
          ) : (
            <div />
          )}
        </div>
        <p className="muted">Static filter: status ({BUILD_STATUS.join(", ")}).</p>
        <p className="muted inventory-meta">
          {facetSummary.length} values in selected field · {kits.length} total kits · {tags.length} tags
        </p>
        <div className="facet-summary-grid">
          {facetSummary.map((item) => (
            <div key={`facet-${item.value}`} className="facet-summary-chip">
              <span>{item.value}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
          {facetSummary.length === 0 ? <p className="muted">No values available.</p> : null}
        </div>
      </article>
    </section>
  );
}
