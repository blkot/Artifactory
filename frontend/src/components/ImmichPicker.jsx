import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api/client";

export default function ImmichPicker({ open, onClose, onConfirm }) {
    const [phase, setPhase] = useState("tags"); // "tags" | "results"
    const [tags, setTags] = useState([]);
    const [selectedTagIds, setSelectedTagIds] = useState(new Set());
    const [assets, setAssets] = useState([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState("");
    const scrollRef = useRef(null);
    const loaderRef = useRef(null);
    const lastClickedRef = useRef(null);

    // Fetch tags on open
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setError("");
        setPhase("tags");
        setSelectedTagIds(new Set());
        setSelectedAssetIds(new Set());
        setSelectAll(false);
        setAssets([]);
        api.getImmichTags()
            .then(data => { setTags(data || []); })
            .catch(err => { setError("Failed to load tags: " + (err.message || "unknown")); })
            .finally(() => setLoading(false));
    }, [open]);

    function toggleTag(tagId) {
        setSelectedTagIds(prev => {
            const next = new Set(prev);
            next.has(tagId) ? next.delete(tagId) : next.add(tagId);
            return next;
        });
    }

    async function startSearch() {
        if (selectedTagIds.size === 0) return;
        setLoading(true);
        setError("");
        setPhase("results");
        try {
            const data = await api.searchImmichAssets(Array.from(selectedTagIds), 1, 60);
            setAssets(data?.assets?.items || []);
            setTotal(data?.assets?.total || 0);
            setHasMore((data?.assets?.items?.length || 0) < (data?.assets?.total || 0));
            setPage(1);
            setSelectedAssetIds(new Set());
            setSelectAll(false);
        } catch (err) {
            setError("Search failed: " + (err.message || "unknown"));
        } finally {
            setLoading(false);
        }
    }

    // Infinite scroll
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const data = await api.searchImmichAssets(Array.from(selectedTagIds), nextPage, 60);
            const newItems = data?.assets?.items || [];
            setAssets(prev => [...prev, ...newItems]);
            setHasMore(newItems.length > 0 && (assets.length + newItems.length) < (data?.assets?.total || 0));
            setPage(nextPage);
        } catch (_) {} finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, page, selectedTagIds, assets.length]);

    useEffect(() => {
        if (phase !== "results") return;
        const target = loaderRef.current;
        if (!target) return;
        const observer = new IntersectionObserver(
            entries => { if (entries[0]?.isIntersecting) loadMore(); },
            { root: scrollRef.current, rootMargin: "200px" }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [phase, loadMore]);

    function toggleAsset(assetId, shiftKey = false) {
        setSelectedAssetIds(prev => {
            const next = new Set(prev);
            if (shiftKey && lastClickedRef.current) {
                const lastIdx = assets.findIndex(a => a.id === lastClickedRef.current);
                const thisIdx = assets.findIndex(a => a.id === assetId);
                const [start, end] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
                for (let i = start; i <= end; i++) next.add(assets[i].id);
                if (prev.has(assetId) && prev.has(lastClickedRef.current)) {
                    for (let i = start; i <= end; i++) next.delete(assets[i].id);
                }
            } else {
                next.has(assetId) ? next.delete(assetId) : next.add(assetId);
            }
            setSelectAll(false);
            return next;
        });
        lastClickedRef.current = assetId;
    }

    function selectAllVisible() {
        setSelectedAssetIds(new Set(assets.map(a => a.id)));
        setSelectAll(false);
    }

    function selectAllMatching() {
        setSelectedAssetIds(new Set(assets.map(a => a.id)));
        setSelectAll(true);
    }

    function clearSelection() {
        setSelectedAssetIds(new Set());
        setSelectAll(false);
    }

    function handleConfirm() {
        let selected;
        if (selectAll) {
            selected = assets.filter(a => selectedAssetIds.has(a.id));
        } else {
            selected = assets.filter(a => selectedAssetIds.has(a.id));
        }
        // Collect unique tag names from all selected assets
        const tagNames = [...new Set(
            selected.flatMap(a => (a.tags || []).map(t => t.value || t.name).filter(Boolean))
        )];
        onConfirm(selected.map(a => ({
            id: a.id,
            thumbnailUrl: api.getImmichThumbUrl(a.id),
            originalFileName: a.originalFileName || "",
        })), tagNames);
        onClose();
    }

    if (!open) return null;

    const selectedCount = selectAll ? Math.max(total, selectedAssetIds.size) : selectedAssetIds.size;

    return (
        <div className="immich-picker-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="immich-picker-panel">
                <button className="image-viewer-close" onClick={onClose} aria-label="Close">×</button>

                {error ? <p className="error-banner">{error}</p> : null}

                {phase === "tags" ? (
                    <>
                        <h2>Select Tags</h2>
                        {loading ? <p className="muted">Loading tags...</p> : null}
                        <div className="tag-cloud">
                            {tags.map(tag => (
                                <button
                                    key={tag.id}
                                    type="button"
                                    className={selectedTagIds.has(tag.id) ? "tag active" : "tag"}
                                    onClick={() => toggleTag(tag.id)}
                                >
                                    {tag.value || tag.name}
                                </button>
                            ))}
                        </div>
                        <button
                            className="form-submit"
                            style={{marginTop: "1rem"}}
                            onClick={startSearch}
                            disabled={selectedTagIds.size === 0 || loading}
                        >
                            Search ({selectedTagIds.size} tag(s))
                        </button>
                    </>
                ) : (
                    <>
                        <h2>Select Images</h2>
                        <div className="bulk-actions">
                            <button type="button" onClick={selectAllVisible}>Select all visible</button>
                            <button type="button" onClick={selectAllMatching}>Select all {total}</button>
                            <button type="button" onClick={clearSelection}>Clear</button>
                        </div>
                        {loading ? <p className="muted">Searching...</p> : null}
                        <div className="thumb-grid" ref={scrollRef}>
                            {assets.map(asset => (
                                <div
                                    key={asset.id}
                                    className={`thumb-item ${selectedAssetIds.has(asset.id) ? "selected" : ""}`}
                                    onClick={e => toggleAsset(asset.id, e.shiftKey)}
                                >
                                    <img
                                        src={api.getImmichThumbUrl(asset.id)}
                                        alt={asset.originalFileName || ""}
                                        loading="lazy"
                                    />
                                    {selectedAssetIds.has(asset.id) ? <div className="thumb-checkmark">&#10003;</div> : null}
                                </div>
                            ))}
                            <div ref={loaderRef} style={{height: 1}} />
                        </div>
                        {loadingMore ? <p className="muted" style={{textAlign:"center"}}>Loading more...</p> : null}
                        <div className="sticky-bar">
                            <span>{selectedCount} selected</span>
                            <button className="form-submit" onClick={handleConfirm} disabled={selectedCount === 0}>
                                Confirm &amp; Add to Kit
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
