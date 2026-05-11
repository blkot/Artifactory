import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Counter from "yet-another-react-lightbox/plugins/counter";

function getAssetUrl(asset) {
    if (asset.external_source === "immich") {
        return `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"}/immich/assets/${asset.external_asset_id}/original`;
    }
    return `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"}/assets/${asset.id}/file`;
}

function getThumbUrl(asset) {
    if (asset.external_source === "immich") {
        return asset.external_thumbnail_url
            || `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"}/immich/assets/${asset.external_asset_id}/thumbnail`;
    }
    if (asset.thumbnail_url) {
        const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
        if (asset.thumbnail_url.startsWith("/api/v1/")) {
            return `${base}${asset.thumbnail_url.slice(7)}`;
        }
        return asset.thumbnail_url;
    }
    return `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"}/assets/${asset.id}/file`;
}

export default function ImageViewer({ images, currentIndex, coverId, onClose, onSetCover, onNavigate }) {
    if (!images || images.length === 0) return null;

    const slides = images.map((img) => {
        let sourceBadge = null;
        if (img.external_source === "immich") {
            sourceBadge = "IMMICH";
        }
        return {
            src: getAssetUrl(img),
            poster: getThumbUrl(img),
            title: img.original_filename,
            description: sourceBadge
                ? `${sourceBadge} · ${img.original_filename}`
                : img.original_filename,
            coverId: img.id,
        };
    });

    return (
        <Lightbox
            open
            index={currentIndex}
            slides={slides}
            on={{ view: ({ index }) => onNavigate(index), exited: onClose }}
            plugins={[Zoom, Thumbnails, Counter]}
            zoom={{ maxZoomPixelRatio: 5, scrollToZoom: true }}
            thumbnails={{ position: "bottom", gap: 4 }}
            counter={{ container: { style: { top: "unset", bottom: "56px" } } }}
            toolbar={{
                buttons: [
                    onSetCover ? (
                        <button
                            key="set-cover"
                            type="button"
                            style={{
                                background: "rgba(255,255,255,0.15)",
                                border: "1px solid rgba(255,255,255,0.3)",
                                borderRadius: 6,
                                color: "#fff",
                                padding: "4px 10px",
                                fontSize: 13,
                                cursor: "pointer",
                                marginRight: 8,
                            }}
                            onClick={() => {
                                const idx = typeof currentIndex === "number" ? currentIndex : 0;
                                const asset = images[idx];
                                if (asset) onSetCover(asset.id);
                            }}
                        >
                            {coverId && images.some(i => i.id === coverId) ? "★ Cover" : "☆ Set as Cover"}
                        </button>
                    ) : null,
                    "close",
                ].filter(Boolean),
            }}
            animation={{ fade: 250, swipe: 300 }}
            carousel={{ finite: false }}
        />
    );
}
