import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

function getAssetUrl(asset) {
    if (asset.external_source === "immich") {
        return api.getImmichOriginalUrl(asset.external_asset_id);
    }
    return api.assetFileUrl(asset.id);
}

function getThumbUrl(asset) {
    if (asset.external_source === "immich") {
        return asset.external_thumbnail_url || api.getImmichThumbUrl(asset.external_asset_id);
    }
    return api.assetFileUrl(asset.id);
}

export default function ImageViewer({ images, currentIndex, coverId, onClose, onSetCover, onNavigate }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const imgRef = useRef(null);
    const containerRef = useRef(null);

    if (!images || images.length === 0) return null;
    const current = images[currentIndex];
    if (!current) return null;

    useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [currentIndex]);

    function getPanLimit(z) {
        if (!imgRef.current || !containerRef.current) return { x: 0, y: 0 };
        const imgRect = imgRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        // The displayed image size after CSS constrains it
        const imgW = imgRect.width / zoom * z;  // projected size at zoom z
        const imgH = imgRect.height / zoom * z;
        const limitX = Math.max(0, (imgW - containerRect.width) / 2);
        const limitY = Math.max(0, (imgH - containerRect.height) / 2);
        return { x: limitX, y: limitY };
    }

    function clampPan(z, px, py) {
        if (z <= 1) return { x: 0, y: 0 };
        const limit = getPanLimit(z);
        return {
            x: Math.max(-limit.x, Math.min(limit.x, px)),
            y: Math.max(-limit.y, Math.min(limit.y, py)),
        };
    }

    function handleWheel(e) {
        e.preventDefault();
        const direction = e.deltaY < 0 ? 1 : -1;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + direction * ZOOM_STEP));

        if (imgRef.current && containerRef.current) {
            const imgRect = imgRef.current.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            // Cursor position relative to the image center, clamped to image bounds
            const imgCenterX = imgRect.left + imgRect.width / 2;
            const imgCenterY = imgRect.top + imgRect.height / 2;
            const cx = e.clientX - imgCenterX;
            const cy = e.clientY - imgCenterY;

            const scale = newZoom / zoom;

            if (newZoom <= 1) {
                setPan({ x: 0, y: 0 });
            } else {
                const limit = getPanLimit(newZoom);
                const newPan = clampPan(newZoom,
                    (pan.x - cx) * scale,
                    (pan.y - cy) * scale
                );
                setPan(newPan);
            }
        }
        setZoom(newZoom);
    }

    function handleMouseDown(e) {
        if (zoom <= 1) return;
        e.preventDefault();
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }

    function handleMouseMove(e) {
        if (!dragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPan(clampPan(zoom,
            dragStart.current.panX + dx,
            dragStart.current.panY + dy
        ));
    }

    function handleMouseUp() {
        setDragging(false);
    }

    function handleDoubleClick(e) {
        e.preventDefault();
        if (zoom > 1.01) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
        } else {
            setZoom(2);
            setPan({ x: 0, y: 0 });
        }
    }

    function handlePrev() {
        const prev = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
        onNavigate(prev);
    }

    function handleNext() {
        const next = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
        onNavigate(next);
    }

    function handleKeyDown(e) {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowLeft") { e.preventDefault(); handlePrev(); }
        if (e.key === "ArrowRight") { e.preventDefault(); handleNext(); }
    }

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [currentIndex, images.length, zoom]);

    useEffect(() => {
        if (!dragging) return;
        const onUp = () => setDragging(false);
        window.addEventListener("mouseup", onUp);
        return () => window.removeEventListener("mouseup", onUp);
    }, [dragging]);

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) onClose();
    }

    const cursor = zoom > 1 ? (dragging ? "grabbing" : "grab") : "default";
    const hasTransform = zoom > 1.005;

    return (
        <div className="image-viewer-backdrop" onClick={handleBackdropClick}>
            <button className="image-viewer-close" onClick={onClose} aria-label="Close viewer">×</button>

            <button className="image-viewer-nav image-viewer-prev" onClick={handlePrev} aria-label="Previous image">
                ‹
            </button>

            <div
                ref={containerRef}
                className="image-viewer-main"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                <img
                    ref={imgRef}
                    src={getAssetUrl(current)}
                    alt={current.original_filename}
                    onDoubleClick={handleDoubleClick}
                    style={{
                        transform: hasTransform
                            ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                            : "none",
                        cursor,
                    }}
                    draggable={false}
                />
                {hasTransform ? (
                    <span className="image-viewer-zoom-badge">
                        {Math.round(zoom * 100)}%
                    </span>
                ) : null}
            </div>

            <button className="image-viewer-nav image-viewer-next" onClick={handleNext} aria-label="Next image">
                ›
            </button>

            <div className="image-viewer-toolbar">
                <span className="image-viewer-filename">
                    {current.original_filename} ({currentIndex + 1} / {images.length})
                </span>
                {onSetCover ? (
                    <button
                        className={`image-viewer-cover-btn ${current.id === coverId ? "is-cover" : ""}`}
                        onClick={() => onSetCover(current.id)}
                    >
                        {current.id === coverId ? "★ Cover Image" : "☆ Set as Cover"}
                    </button>
                ) : null}
            </div>

            <div className="image-viewer-thumbnails">
                {images.map((img, i) => (
                    <button
                        key={img.id}
                        className={`image-viewer-thumb ${i === currentIndex ? "active" : ""}`}
                        onClick={() => onNavigate(i)}
                    >
                        <img src={getThumbUrl(img)} alt={img.original_filename} />
                    </button>
                ))}
            </div>
        </div>
    );
}
