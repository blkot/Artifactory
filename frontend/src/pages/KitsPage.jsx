import { useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { GRADES, BUILD_STATUS, PAGE_SIZE } from "../constants";
import AppHeader from "../components/AppHeader";

export default function KitsPage({
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
    <section className="page kits-inventory-page kits-inventory-two-column">
      <aside className="kits-left-stack">
        <AppHeader
          title="Kit Inventory"
          subtitle="Search, filter, and route into per-kit workspaces."
        />
        <article className="panel kits-banner-panel">
          <div className="panel-head kits-banner-head">
            <h2>Kits</h2>
            <NavLink to="/kits/new" className="inline-cta inline-cta-compact">
              + Add Kit
            </NavLink>
          </div>
          <form
            className="filter-grid kits-filter-stack"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <div className="kits-search-sticky">
              <input placeholder="Search by name" value={filters.q} onChange={(e) => onFilterChange("q", e.target.value)} />
            </div>
            <div className="kits-filters-scroll">
              <div className="multi-filter">
                <p>Grade</p>
                <div className="check-grid">
                  {GRADES.map((item) => (
                    <label key={`grade-${item}`} className={filters.grade.includes(item) ? "filter-chip active" : "filter-chip"}>
                      <input
                        type="checkbox"
                        checked={filters.grade.includes(item)}
                        onChange={() => onToggleFilterValue("grade", item)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="multi-filter">
                <p>Status</p>
                <div className="check-grid">
                  {BUILD_STATUS.map((item) => (
                    <label
                      key={`status-${item}`}
                      className={filters.build_status.includes(item) ? "filter-chip active" : "filter-chip"}
                    >
                      <input
                        type="checkbox"
                        checked={filters.build_status.includes(item)}
                        onChange={() => onToggleFilterValue("build_status", item)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
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
            </div>
          </form>
          <p className="muted inventory-meta">
            Showing {kits.length} of {total} kits {hasActiveFilters ? "(filtered)" : ""}
          </p>
        </article>
      </aside>

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
  );
}
