import React from "react";
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { api, API_BASE_URL } from "../lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageViewerProps {
  images: any[];
  currentIndex: number;
  coverId: number | null;
  onClose: () => void;
  onSetCover: (assetId: number) => void;
  onNavigate: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveThumbnailUrl(asset: any): string {
  if (asset.thumbnail_path || asset.thumbnail_url) {
    return `${API_BASE_URL}/assets/${asset.id}/thumbnail`;
  }
  return api.assetFileUrl(asset.id);
}

function resolveImageUrl(asset: any): string {
  if (asset.external_source === "immich" && asset.external_asset_id) {
    return api.getImmichOriginalUrl(asset.external_asset_id);
  }
  if (asset.thumbnail_path || asset.thumbnail_url) {
    return `${API_BASE_URL}/assets/${asset.id}/thumbnail`;
  }
  return api.assetFileUrl(asset.id);
}

function resolveThumbUrl(asset: any): string {
  if (asset.external_source === "immich" && asset.external_asset_id) {
    return api.getImmichThumbUrl(asset.external_asset_id);
  }
  return resolveThumbnailUrl(asset);
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const colors = {
  bg: "#f3efe8",
  surface: "#ffffff",
  ink: "#1b1d1f",
  muted: "#5f6870",
  line: "#d7d2c9",
  accent: "#c5672a",
  danger: "#8d2b2b",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// ImageViewer
// ---------------------------------------------------------------------------

export default function ImageViewer({
  images,
  currentIndex,
  coverId,
  onClose,
  onSetCover,
  onNavigate,
}: ImageViewerProps) {
  const currentAsset = images[currentIndex];
  const isCover = currentAsset?.id != null && currentAsset.id === coverId;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handlePrev = () => {
    if (hasPrev) onNavigate(currentIndex - 1);
  };

  const handleNext = () => {
    if (hasNext) onNavigate(currentIndex + 1);
  };

  const filename = currentAsset?.original_filename || "image";

  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* ---- Close button ---- */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeText}>{"×"}</Text>
        </TouchableOpacity>

        {/* ---- Image area ---- */}
        <View style={styles.imageArea}>
          {/* Prev button */}
          {hasPrev ? (
            <TouchableOpacity
              style={[styles.navButton, styles.navLeft]}
              onPress={handlePrev}
              activeOpacity={0.6}
            >
              <Text style={styles.navArrow}>{"‹"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.navButton, styles.navPlaceholder]} />
          )}

          {/* Tappable backdrop around image to close */}
          <TouchableOpacity
            style={styles.imageWrapper}
            activeOpacity={1}
            onPress={onClose}
          >
            {currentAsset ? (
              <Image
                source={{ uri: resolveImageUrl(currentAsset) }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : null}
          </TouchableOpacity>

          {/* Next button */}
          {hasNext ? (
            <TouchableOpacity
              style={[styles.navButton, styles.navRight]}
              onPress={handleNext}
              activeOpacity={0.6}
            >
              <Text style={styles.navArrow}>{"›"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.navButton, styles.navPlaceholder]} />
          )}
        </View>

        {/* ---- Toolbar ---- */}
        <View style={styles.toolbar}>
          <Text style={styles.toolbarFilename} numberOfLines={1}>
            {filename} ({currentIndex + 1}/{images.length})
          </Text>
          <TouchableOpacity
            style={styles.setCoverButton}
            onPress={() => {
              if (currentAsset?.id != null) onSetCover(currentAsset.id);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.setCoverText}>
              {isCover ? "★" : "☆"} Set as Cover
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---- Bottom thumbnail strip ---- */}
        {images.length > 1 ? (
          <View style={styles.thumbnailStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailStripInner}
            >
              {images.map((asset: any, index: number) => {
                const isActive = index === currentIndex;
                return (
                  <TouchableOpacity
                    key={asset.id ?? index}
                    style={[
                      styles.thumbWrap,
                      isActive && styles.thumbWrapActive,
                    ]}
                    onPress={() => onNavigate(index)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: resolveThumbUrl(asset) }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000000",
  } as ViewStyle,

  // Close button
  closeButton: {
    position: "absolute",
    top: 54,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  closeText: {
    fontSize: 22,
    fontWeight: "300",
    color: "#ffffff",
    lineHeight: 24,
  } as TextStyle,

  // Image area
  imageArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  } as ViewStyle,
  imageWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  fullImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  } as ImageStyle,

  // Nav buttons
  navButton: {
    width: 48,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  navLeft: {
    paddingRight: 4,
  } as ViewStyle,
  navRight: {
    paddingLeft: 4,
  } as ViewStyle,
  navPlaceholder: {
    opacity: 0,
  } as ViewStyle,
  navArrow: {
    fontSize: 42,
    fontWeight: "300",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 48,
  } as TextStyle,

  // Toolbar
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  } as ViewStyle,
  toolbarFilename: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    flex: 1,
    marginRight: 12,
  } as TextStyle,
  setCoverButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  } as ViewStyle,
  setCoverText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,

  // Thumbnail strip
  thumbnailStrip: {
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  } as ViewStyle,
  thumbnailStripInner: {
    paddingHorizontal: 12,
    gap: 8,
  } as ViewStyle,
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  } as ViewStyle,
  thumbWrapActive: {
    borderColor: colors.accent,
  } as ViewStyle,
  thumbImage: {
    width: "100%",
    height: "100%",
  } as ImageStyle,
});
