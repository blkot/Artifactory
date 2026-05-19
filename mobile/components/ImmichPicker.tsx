import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { api, authenticatedImageSource } from "../lib/api/client";
import ErrorBanner from "./ui/ErrorBanner";
import Button from "./ui/Button";
import Tag from "./ui/Tag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImmichPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (assets: any[], tagNames: string[]) => void;
}

interface ImmichTag {
  id: string;
  name: string;
  value: string;
}

interface ImmichAsset {
  id: string;
  originalFileName?: string;
  originalPath?: string;
  type?: string;
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
const COLUMN_GAP = 8;
const COLUMN_WIDTH = (SCREEN_WIDTH - 40 - COLUMN_GAP) / 2;

// ---------------------------------------------------------------------------
// ImmichPicker
// ---------------------------------------------------------------------------

export default function ImmichPicker({
  visible,
  onClose,
  onConfirm,
}: ImmichPickerProps) {
  // Phase: "tags" | "results"
  const [phase, setPhase] = useState<"tags" | "results">("tags");

  // Tags
  const [tags, setTags] = useState<ImmichTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  // Results
  const [assets, setAssets] = useState<ImmichAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPhase("tags");
      setSelectedTagIds(new Set());
      setSelectedAssetIds(new Set());
      setAssets([]);
      setPage(1);
      setHasMore(false);
      setError(null);
      fetchTags();
    }
  }, [visible]);

  // -----------------------------------------------------------------------
  // Fetch tags
  // -----------------------------------------------------------------------

  const fetchTags = async () => {
    setTagsLoading(true);
    setTagsError(null);
    try {
      const data = (await api.getImmichTags()) as ImmichTag[];
      setTags(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setTagsError(err?.message || "Failed to load tags");
    } finally {
      setTagsLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Toggle tag selection
  // -----------------------------------------------------------------------

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  const handleSearch = async () => {
    if (selectedTagIds.size === 0) return;
    setPhase("results");
    setPage(1);
    setAssets([]);
    setSelectedAssetIds(new Set());
    setError(null);
    setLoading(true);

    try {
      const data = (await api.searchImmichAssets(
        Array.from(selectedTagIds),
        1,
        60
      )) as any;
      const items = data?.assets?.items ?? data?.items ?? data ?? [];
      setAssets(Array.isArray(items) ? items : []);
      const totalPages = data?.assets?.totalPages ?? data?.totalPages ?? 1;
      setHasMore(totalPages > 1);
    } catch (err: any) {
      setError(err?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Load more (infinite scroll)
  // -----------------------------------------------------------------------

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    try {
      const data = (await api.searchImmichAssets(
        Array.from(selectedTagIds),
        nextPage,
        60
      )) as any;
      const items = data?.assets?.items ?? data?.items ?? data ?? [];
      setAssets((prev) => [...prev, ...(Array.isArray(items) ? items : [])]);
      setPage(nextPage);
      const totalPages = data?.assets?.totalPages ?? data?.totalPages ?? 1;
      setHasMore(nextPage < totalPages);
    } catch {
      // Silently fail on load-more
    } finally {
      setLoadingMore(false);
    }
  };

  // -----------------------------------------------------------------------
  // Asset selection
  // -----------------------------------------------------------------------

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedAssetIds(new Set(assets.map((a) => a.id)));
  };

  const clearSelection = () => {
    setSelectedAssetIds(new Set());
  };

  // -----------------------------------------------------------------------
  // Confirm
  // -----------------------------------------------------------------------

  const handleConfirm = () => {
    const selectedAssets = assets.filter((a) => selectedAssetIds.has(a.id));
    const selectedTagNames = tags
      .filter((t) => selectedTagIds.has(t.id))
      .map((t) => t.name || t.value);
    onConfirm(selectedAssets, selectedTagNames);
  };

  // -----------------------------------------------------------------------
  // Render: tags phase
  // -----------------------------------------------------------------------

  const renderTagsPhase = () => (
    <View style={styles.sheetContent}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Select Immich Tags</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.sheetClose}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sheetHint}>
          Choose one or more tags to search for images in your Immich library.
        </Text>

        {tagsError ? (
          <View style={styles.errorWrap}>
            <ErrorBanner message={tagsError} />
          </View>
        ) : null}

        {tagsLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={styles.loadingText}>Loading tags...</Text>
          </View>
        ) : tags.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No tags found in your Immich library.
            </Text>
          </View>
        ) : (
          <View style={styles.tagsGrid}>
            {tags.map((tag) => (
              <Tag
                key={tag.id}
                label={tag.name || tag.value}
                active={selectedTagIds.has(tag.id)}
                onPress={() => toggleTag(tag.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.sheetFooter}>
        <Text style={styles.selectionCount}>
          {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? "s" : ""}{" "}
          selected
        </Text>
        <Button
          title="Search"
          onPress={handleSearch}
          disabled={selectedTagIds.size === 0 || tagsLoading}
          loading={loading}
        />
      </View>
    </View>
  );

  // -----------------------------------------------------------------------
  // Render: results phase
  // -----------------------------------------------------------------------

  const renderAssetItem = ({ item }: { item: ImmichAsset }) => {
    const isSelected = selectedAssetIds.has(item.id);
    return (
      <TouchableOpacity
        style={styles.assetCell}
        onPress={() => toggleAsset(item.id)}
        activeOpacity={0.8}
      >
        <Image
          source={authenticatedImageSource(api.getImmichThumbUrl(item.id))}
          style={styles.assetThumb}
          resizeMode="cover"
        />
        {isSelected ? (
          <View style={styles.checkOverlay}>
            <Text style={styles.checkMark}>{"✓"}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderResultsPhase = () => {
    const selectedCount = selectedAssetIds.size;

    return (
      <View style={styles.sheetContent}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <TouchableOpacity
            onPress={() => setPhase("tags")}
            activeOpacity={0.7}
          >
            <Text style={styles.sheetBack}>{"‹ Tags"}</Text>
          </TouchableOpacity>
          <Text style={styles.sheetTitleSmall}>
            {assets.length} images
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.sheetClose}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Select all / clear bar */}
        <View style={styles.selectBar}>
          <TouchableOpacity onPress={selectAllVisible} activeOpacity={0.7}>
            <Text style={styles.selectBarAction}>Select all visible</Text>
          </TouchableOpacity>
          {selectedAssetIds.size > 0 ? (
            <TouchableOpacity onPress={clearSelection} activeOpacity={0.7}>
              <Text style={styles.selectBarAction}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorWrap}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        {/* Grid */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.muted} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : assets.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No images found for the selected tags.
            </Text>
          </View>
        ) : (
          <FlatList
            data={assets}
            renderItem={renderAssetItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.assetRow}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.assetGrid}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreWrap}>
                  <ActivityIndicator size="small" color={colors.muted} />
                </View>
              ) : null
            }
          />
        )}

        {/* Bottom bar */}
        <View style={styles.sheetFooter}>
          <Text style={styles.selectionCount}>
            {selectedCount} selected
          </Text>
          <Button
            title={selectedCount > 0 ? `Confirm · ${selectedCount}` : "Confirm"}
            onPress={handleConfirm}
            disabled={selectedCount === 0}
          />
        </View>
      </View>
    );
  };

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalWrapper}>
        {/* Tappable backdrop */}
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        {/* Bottom sheet */}
        <View style={styles.bottomSheet}>
          {phase === "tags" ? renderTagsPhase() : renderResultsPhase()}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Modal
  modalWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  } as ViewStyle,
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  } as ViewStyle,
  bottomSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    minHeight: "50%",
    overflow: "hidden",
  } as ViewStyle,

  // Sheet content
  sheetContent: {
    flex: 1,
    paddingTop: 16,
  } as ViewStyle,
  sheetScroll: {
    flex: 1,
  } as ViewStyle,
  sheetScrollContent: {
    paddingBottom: 16,
  } as ViewStyle,

  // Header
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  } as ViewStyle,
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  } as TextStyle,
  sheetTitleSmall: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  } as TextStyle,
  sheetClose: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent,
  } as TextStyle,
  sheetBack: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent,
  } as TextStyle,
  sheetHint: {
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 20,
  } as TextStyle,

  // Tags grid
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
  } as ViewStyle,

  // Select bar
  selectBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 8,
  } as ViewStyle,
  selectBarAction: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  } as TextStyle,

  // Asset grid
  assetGrid: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  } as ViewStyle,
  assetRow: {
    gap: COLUMN_GAP,
    marginBottom: COLUMN_GAP,
  } as ViewStyle,
  assetCell: {
    width: COLUMN_WIDTH,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ece3d7",
    borderWidth: 1,
    borderColor: colors.line,
  } as ViewStyle,
  assetThumb: {
    width: "100%",
    height: "100%",
  } as ImageStyle,
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(197,103,42,0.3)",
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  checkMark: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
  } as TextStyle,

  // Loading, empty, error
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  } as ViewStyle,
  loadingText: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 10,
  } as TextStyle,
  loadingMoreWrap: {
    paddingVertical: 16,
    alignItems: "center",
  } as ViewStyle,
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  } as ViewStyle,
  emptyText: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  } as TextStyle,
  errorWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  } as ViewStyle,

  // Footer
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  } as ViewStyle,
  selectionCount: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
  } as TextStyle,
});
