import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Image,
  Pressable,
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
import { cacheRemoteAssetDerivatives } from "../lib/imageCache";
import { touchRemoteAssetCache } from "../lib/localAssetStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageViewerProps {
  images: any[];
  currentIndex: number;
  coverId: number | string | null;
  onClose: () => void;
  onSetCover: (asset: any) => void;
  onNavigate: (index: number) => void;
  onAssetCached?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveThumbnailUrl(asset: any): string {
  if (asset.isLocalAsset) {
    return asset.thumbnailLocalUri || asset.displayLocalUri || asset.originalLocalUri;
  }
  if (asset.thumbnailLocalUri) {
    return asset.thumbnailLocalUri;
  }
  if (asset.external_source === "immich" && asset.external_asset_id) {
    return api.getImmichThumbUrl(asset.external_asset_id);
  }
  if (asset.thumbnail_path || asset.thumbnail_url) {
    return `${API_BASE_URL}/assets/${asset.id}/thumbnail`;
  }
  return api.assetFileUrl(asset.id);
}

function resolveImageUrl(asset: any): string {
  if (asset.isLocalAsset) {
    return asset.originalLocalUri || asset.displayLocalUri || asset.thumbnailLocalUri;
  }
  if (asset.external_source === "immich" && asset.external_asset_id) {
    return api.getImmichOriginalUrl(asset.external_asset_id);
  }
  return api.assetFileUrl(asset.id);
}

function imageQualityCandidates(asset: any): string[] {
  const candidates: string[] = [];

  if (asset.isLocalAsset) {
    candidates.push(asset.originalLocalUri);
    candidates.push(asset.displayLocalUri);
    candidates.push(asset.thumbnailLocalUri);
  } else if (asset.external_source === "immich" && asset.external_asset_id) {
    candidates.push(api.getImmichOriginalUrl(asset.external_asset_id));
    if (asset.displayLocalUri) {
      candidates.push(String(asset.displayLocalUri));
    }
    if (asset.external_thumbnail_url) {
      candidates.push(String(asset.external_thumbnail_url));
    }
    candidates.push(api.getImmichThumbUrl(asset.external_asset_id));
    if (asset.thumbnailLocalUri) {
      candidates.push(String(asset.thumbnailLocalUri));
    }
  } else {
    candidates.push(api.assetFileUrl(asset.id));
    if (asset.displayLocalUri) {
      candidates.push(String(asset.displayLocalUri));
    }
    if (asset.thumbnail_path || asset.thumbnail_url) {
      candidates.push(`${API_BASE_URL}/assets/${asset.id}/thumbnail`);
    }
    if (asset.thumbnailLocalUri) {
      candidates.push(String(asset.thumbnailLocalUri));
    }
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function resolveThumbUrl(asset: any): string {
  if (asset.isLocalAsset) {
    return asset.thumbnailLocalUri || asset.displayLocalUri || asset.originalLocalUri;
  }
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
const TAP_CANCEL_DISTANCE = 10;

function ProgressiveImage({
  asset,
  width,
  onAssetCached,
  onPress,
}: {
  asset: any;
  width: number;
  onAssetCached?: () => void;
  onPress?: () => void;
}) {
  const candidates = imageQualityCandidates(asset);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const cacheAttemptedRef = useRef(false);
  const tapStartRef = useRef({ x: 0, y: 0, moved: false });
  const activeUri = candidates[candidateIndex] || resolveImageUrl(asset);
  const source = activeUri?.startsWith("file://")
    ? { uri: activeUri }
    : authenticatedImageSource(activeUri);

  useEffect(() => {
    setCandidateIndex(0);
    cacheAttemptedRef.current = false;
  }, [asset?.id, asset?.external_asset_id]);

  return (
    <Pressable
      style={[styles.imageTapTarget, { width }]}
      onTouchStart={(event) => {
        const touch = event.nativeEvent;
        tapStartRef.current = {
          x: touch.pageX,
          y: touch.pageY,
          moved: false,
        };
      }}
      onTouchMove={(event) => {
        const touch = event.nativeEvent;
        const dx = touch.pageX - tapStartRef.current.x;
        const dy = touch.pageY - tapStartRef.current.y;
        if (Math.hypot(dx, dy) > TAP_CANCEL_DISTANCE) {
          tapStartRef.current.moved = true;
        }
      }}
      onPress={() => {
        if (!tapStartRef.current.moved) {
          onPress?.();
        }
      }}
    >
      <Image
        source={source}
        style={[styles.fullImage, { width }]}
        resizeMode="contain"
        onError={() => {
          setCandidateIndex((current) =>
            current < candidates.length - 1 ? current + 1 : current
          );
        }}
        onLoad={() => {
          if (
            !asset?.isLocalAsset &&
            asset?.id &&
            activeUri?.startsWith("file://") &&
            (activeUri === asset.displayLocalUri || activeUri === asset.thumbnailLocalUri)
          ) {
            touchRemoteAssetCache(Number(asset.id)).catch(() => {});
          }
          if (
            cacheAttemptedRef.current ||
            candidateIndex !== 0 ||
            asset?.isLocalAsset ||
            asset?.displayLocalUri ||
            !asset?.id ||
            !activeUri ||
            activeUri.startsWith("file://")
          ) {
            return;
          }
          cacheAttemptedRef.current = true;
          cacheRemoteAssetDerivatives({
            remoteAssetId: Number(asset.id),
            sourceUri: activeUri,
          })
            .then(() => onAssetCached?.())
            .catch(() => {});
        }}
      />
    </Pressable>
  );
}

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
  onAssetCached,
}: ImageViewerProps) {
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView | null>(null);
  const thumbnailStripRef = useRef<ScrollView | null>(null);
  const didInitialScrollRef = useRef(false);
  const syncedIndexRef = useRef(currentIndex);
  const dragStartXRef = useRef(currentIndex * pageWidth);
  const dragStartIndexRef = useRef(currentIndex);
  const settleTargetIndexRef = useRef<number | null>(null);
  const currentAsset = images[currentIndex];
  const currentAssetKey = currentAsset?.isLocalAsset
    ? currentAsset.localId
    : currentAsset?.id;
  const isCover = currentAssetKey != null && currentAssetKey === coverId;

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

  const settleToIndex = (index: number, animated = true) => {
    const nextIndex = Math.max(0, Math.min(index, images.length - 1));
    settleTargetIndexRef.current = nextIndex;
    pagerRef.current?.scrollTo({
      x: nextIndex * pageWidth,
      animated,
    });
    if (nextIndex !== syncedIndexRef.current) {
      syncedIndexRef.current = nextIndex;
      onNavigate(nextIndex);
    }
  };

  const navigateTo = (index: number, animated = true) => {
    settleToIndex(index, animated);
  };

  const filename = currentAsset?.original_filename || "image";

  const handlePageDragStart = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    dragStartXRef.current = event.nativeEvent.contentOffset.x;
    dragStartIndexRef.current = syncedIndexRef.current;
    settleTargetIndexRef.current = null;
  };

  const handlePageDragEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (pageWidth <= 0) return;
    const baseIndex = dragStartIndexRef.current;
    const dragDistance = event.nativeEvent.contentOffset.x - dragStartXRef.current;
    const velocityX = (event.nativeEvent as any).velocity?.x || 0;
    const threshold = Math.min(Math.max(pageWidth * 0.18, 44), 110);
    let targetIndex = baseIndex;

    if (dragDistance > threshold || velocityX > 0.35) {
      targetIndex = baseIndex + 1;
    } else if (dragDistance < -threshold || velocityX < -0.35) {
      targetIndex = baseIndex - 1;
    }

    settleToIndex(targetIndex, true);
  };

  const handlePageSettled = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (pageWidth <= 0) return;
    const requestedTarget = settleTargetIndexRef.current;
    if (requestedTarget !== null) {
      const settledOffset = requestedTarget * pageWidth;
      if (Math.abs(event.nativeEvent.contentOffset.x - settledOffset) > 1) {
        pagerRef.current?.scrollTo({
          x: settledOffset,
          animated: false,
        });
      }
      settleTargetIndexRef.current = null;
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const clampedIndex = Math.max(0, Math.min(nextIndex, images.length - 1));
    const delta = clampedIndex - syncedIndexRef.current;
    const settledIndex =
      Math.abs(delta) > 1 ? syncedIndexRef.current + Math.sign(delta) : clampedIndex;

    if (settledIndex !== clampedIndex) {
      pagerRef.current?.scrollTo({
        x: settledIndex * pageWidth,
        animated: true,
      });
    }

    settleToIndex(settledIndex, false);
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
            bounces
            alwaysBounceHorizontal
            directionalLockEnabled
            decelerationRate="fast"
            disableIntervalMomentum
            scrollEventThrottle={16}
            onScrollBeginDrag={handlePageDragStart}
            onScrollEndDrag={handlePageDragEnd}
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
                  <ProgressiveImage
                    asset={asset}
                    width={pageWidth}
                    onAssetCached={onAssetCached}
                    onPress={onClose}
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
              if (currentAsset) onSetCover(currentAsset);
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
                      source={
                        resolveThumbUrl(asset).startsWith("file://")
                          ? { uri: resolveThumbUrl(asset) }
                          : authenticatedImageSource(resolveThumbUrl(asset))
                      }
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
  imageTapTarget: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

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
