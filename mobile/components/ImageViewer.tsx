import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { api, API_BASE_URL, authenticatedImageSource } from "../lib/api/client";

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
  if (asset.external_source === "immich" && asset.external_asset_id) {
    return api.getImmichThumbUrl(asset.external_asset_id);
  }
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

const THUMB_SIZE = 52;
const THUMB_GAP = 8;
const THUMB_STRIP_PADDING = 12;

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
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView | null>(null);
  const thumbnailStripRef = useRef<ScrollView | null>(null);
  const didInitialScrollRef = useRef(false);
  const syncedIndexRef = useRef(currentIndex);
  const currentAsset = images[currentIndex];
  const isCover = currentAsset?.id != null && currentAsset.id === coverId;

  useEffect(() => {
    if (!pagerRef.current || images.length === 0) return;
    if (didInitialScrollRef.current && currentIndex === syncedIndexRef.current) {
      return;
    }
    syncedIndexRef.current = currentIndex;
    didInitialScrollRef.current = true;
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({
        x: currentIndex * pageWidth,
        animated: false,
      });
    });
  }, [currentIndex, images.length, pageWidth]);

  useEffect(() => {
    if (!thumbnailStripRef.current || images.length <= 1 || pageWidth <= 0) {
      return;
    }

    const itemWidth = THUMB_SIZE + THUMB_GAP;
    const centeredOffset =
      currentIndex * itemWidth -
      (pageWidth - THUMB_SIZE) / 2 +
      THUMB_STRIP_PADDING;
    const maxOffset = Math.max(
      0,
      images.length * itemWidth - THUMB_GAP + THUMB_STRIP_PADDING * 2 - pageWidth
    );

    thumbnailStripRef.current.scrollTo({
      x: Math.max(0, Math.min(centeredOffset, maxOffset)),
      animated: true,
    });
  }, [currentIndex, images.length, pageWidth]);

  const navigateTo = (index: number, animated = true) => {
    const nextIndex = Math.max(0, Math.min(index, images.length - 1));
    if (nextIndex === currentIndex) return;
    syncedIndexRef.current = nextIndex;
    pagerRef.current?.scrollTo({
      x: nextIndex * pageWidth,
      animated,
    });
    onNavigate(nextIndex);
  };

  const filename = currentAsset?.original_filename || "image";

  const handlePageSettled = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (pageWidth <= 0) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const clampedIndex = Math.max(0, Math.min(nextIndex, images.length - 1));
    const delta = clampedIndex - currentIndex;
    const settledIndex =
      Math.abs(delta) > 1 ? currentIndex + Math.sign(delta) : clampedIndex;

    if (settledIndex !== clampedIndex) {
      pagerRef.current?.scrollTo({
        x: settledIndex * pageWidth,
        animated: true,
      });
    }

    if (settledIndex !== currentIndex) {
      syncedIndexRef.current = settledIndex;
      onNavigate(settledIndex);
    }
  };

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
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            alwaysBounceHorizontal={false}
            directionalLockEnabled
            decelerationRate="fast"
            disableIntervalMomentum
            scrollEventThrottle={16}
            onMomentumScrollEnd={handlePageSettled}
          >
            {images.map((asset: any, index: number) => (
              <View key={asset.id ?? index} style={[styles.imagePage, { width: pageWidth }]}>
                <ScrollView
                  style={styles.zoomScroll}
                  contentContainerStyle={styles.zoomContent}
                  centerContent
                  bouncesZoom
                  minimumZoomScale={1}
                  maximumZoomScale={4}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <Image
                    source={authenticatedImageSource(resolveImageUrl(asset))}
                    style={[styles.fullImage, { width: pageWidth }]}
                    resizeMode="contain"
                  />
                </ScrollView>
              </View>
            ))}
          </ScrollView>
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
              ref={thumbnailStripRef}
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
                    onPress={() => navigateTo(index)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={authenticatedImageSource(resolveThumbUrl(asset))}
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
    position: "relative",
  } as ViewStyle,
  imagePage: {
    flex: 1,
  } as ViewStyle,
  zoomScroll: {
    flex: 1,
  } as ViewStyle,
  zoomContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  fullImage: {
    height: "100%",
  } as ImageStyle,

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
