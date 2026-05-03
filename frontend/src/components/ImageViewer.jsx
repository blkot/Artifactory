import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api/client";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export default function ImageViewer({ images, currentIndex, coverId, onClose, onSetCover, onNavigate }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const imgRef = useRef(null);

    if (!images || images.length === 0) return null;
    const current = images[currentIndex];
    if (!current) return null;

    // Reset transform when image changes
    useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [currentIndex]);

    function clampPan(z, px, py) {
        // When zoom <= 1, no panning
        if (z <= 1) return { x: 0, y: 0 };
        // Limit pan so image edges don't pull too far into view
        const maxPan = (z - 1) * 200;
        return {
            x: Math.max(-maxPan, Math.min(maxPan, px)),
            y: Math.max(-maxPan, Math.min(maxPan, py)),
        };
    }

    function handleWheel(e) {
        e.preventDefault();
        const direction = e.deltaY < 0 ? 1 : -1;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + direction * ZOOM_STEP));

        // Zoom toward cursor position
        if (imgRef.current) {
            const rect = imgRef.current.getBoundingClientRect();
            const cx = e.clientX - rect.left - rect.width / 2;
            const cy = e.clientY - rect.top - rect.height / 2;
            const scale = newZoom / zoom;
            const newPan = clampPan(newZoom,
                pan.x - cx * (scale - 1),
                pan.y - cy * (scale - 1)
            );
            setPan(newPan);
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

    function handleImageClick(e) {
        // Don't toggle zoom if we just finished dragging
        if (dragging) return;
        // Toggle between fit and 100%
        if (zoom > 1.01) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
        } else {
            setZoom(1);
            setPan({ x: 0, y: 0 });
        }
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
    }, [currentIndex, images.length, zoom, pan, dragging]);

    // Global mouseup to catch drag release outside the image
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

    return (
        <div className="image-viewer-backdrop" onClick={handleBackdropClick}>
            <button className="image-viewer-close" onClick={onClose} aria-label="Close viewer">×</button>

            <button className="image-viewer-nav image-viewer-prev" onClick={handlePrev} aria-label="Previous image">
                ‹
            </button>

            <div
                className="image-viewer-main"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                <img
                    ref={imgRef}
                    src={api.assetFileUrl(current.id)}
                    alt={current.original_filename}
                    onClick={handleImageClick}
                    onDoubleClick={handleDoubleClick}
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        cursor,
                        transition: dragging ? "none" : "transform 0.15s ease",
                    }}
                    draggable={false}
                />
                {zoom > 1.01 ? (
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
                        <img src={api.assetFileUrl(img.id)} alt={img.original_filename} />
                    </button>
                ))}
            </div>
        </div>
    );
}
