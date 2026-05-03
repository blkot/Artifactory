import { useEffect, useCallback } from "react";
import { api } from "../api/client";

export default function ImageViewer({ images, currentIndex, coverId, onClose, onSetCover, onNavigate }) {
    if (!images || images.length === 0) return null;

    const current = images[currentIndex];
    if (!current) return null;

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
        if (e.key === "ArrowLeft") handlePrev();
        if (e.key === "ArrowRight") handleNext();
    }

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [currentIndex, images.length]);

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) onClose();
    }

    return (
        <div className="image-viewer-backdrop" onClick={handleBackdropClick}>
            <button className="image-viewer-close" onClick={onClose} aria-label="Close viewer">×</button>

            <button className="image-viewer-nav image-viewer-prev" onClick={handlePrev} aria-label="Previous image">
                ‹
            </button>

            <div className="image-viewer-main">
                <img src={api.assetFileUrl(current.id)} alt={current.original_filename} />
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
