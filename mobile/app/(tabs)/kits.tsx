import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, API_BASE_URL } from "../../lib/api/client";
import {
  GRADES,
  BUILD_STATUS,
  EMPTY_KIT_FILTERS,
  PAGE_SIZE,
} from "../../lib/constants";
import KitCard from "../../components/ui/KitCard";
import SortToggle from "../../components/ui/SortToggle";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Tag from "../../components/ui/Tag";

// ---------------------------------------------------------------------------
// Design tokens
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SortValue {
  sort: string;
  order: "asc" | "desc";
}

interface KitPreview {
  kitId: number;
  url: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_ASSET_TYPES = [
  "BOX_ART",
  "MANUAL",
  "BUILD_PHOTO",
  "REFERENCE_IMAGE",
];

function resolveThumbnailUrl(asset: any): string {
  if (asset.external_source === "immich" && asset.external_asset_id) {
    return api.getImmichThumbUrl(asset.external_asset_id);
  }
  if (asset.thumbnail_path || asset.thumbnail_url) {
    return `${API_BASE_URL}/assets/${asset.id}/thumbnail`;
  }
  return api.assetFileUrl(asset.id);
}

async function fetchKitPreview(kit: any): Promise<KitPreview> {
  try {
    const data = await api.getAssets({ kitId: kit.id, limit: 5 });
    const items: any[] = data?.items ?? [];
    const firstImage = items.find((a: any) =>
      IMAGE_ASSET_TYPES.includes(a.type)
    );
    return {
      kitId: kit.id,
      url: firstImage ? resolveThumbnailUrl(firstImage) : null,
    };
  } catch {
    return { kitId: kit.id, url: null };
  }
}

function hasActiveFilters(f: typeof EMPTY_KIT_FILTERS): boolean {
  return (
    f.q !== "" ||
    f.grade.length > 0 ||
    f.brand.length > 0 ||
    f.series.length > 0 ||
    f.build_status.length > 0 ||
    f.scale.length > 0 ||
    f.tag.length > 0
  );
}

function extractValues(data: any): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.values)) return data.values;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

// ---------------------------------------------------------------------------
// Kits Screen
// ---------------------------------------------------------------------------

export default function KitsScreen() {
  // Kit data
  const [kits, setKits] = useState<any[]>([]);
  const [previewMap, setPreviewMap] = useState<Map<number, string | null>>(
    new Map()
  );
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [filters, setFilters] = useState({ ...EMPTY_KIT_FILTERS });
  const [searchText, setSearchText] = useState("");

  // Sort
  const [sort, setSort] = useState<SortValue>({
    sort: "activity_at",
    order: "desc",
  });

  // Filter options (dynamically loaded)
  const [tags, setTags] = useState<any[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [scaleOptions, setScaleOptions] = useState<string[]>([]);

  // Refs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingMoreRef = useRef(false);
  const isInitialMount = useRef(true);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const loadKits = useCallback(
    async (
      currentPage: number,
      currentFilters: typeof EMPTY_KIT_FILTERS,
      currentSort: SortValue,
      append = false,
      showRefreshControl = false
    ) => {
      if (append) {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      } else if (showRefreshControl) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const isSearch = hasActiveFilters(currentFilters);
        const skip = (currentPage - 1) * PAGE_SIZE;

        let data: any;
        if (isSearch) {
          data = await api.searchKits({
            ...currentFilters,
            skip,
            limit: PAGE_SIZE,
            sort: currentSort.sort,
            order: currentSort.order,
          });
        } else {
          data = await api.getKits({
            skip,
            limit: PAGE_SIZE,
            sort: currentSort.sort,
            order: currentSort.order,
          });
        }

        const items: any[] = data?.items ?? [];
        const newTotal: number = data?.total ?? 0;

        if (append) {
          setKits((prev) => [...prev, ...items]);
        } else {
          setKits(items);
        }
        setTotal(newTotal);
      } catch (err: any) {
        if (!append) {
          setError(err?.message || "Failed to load kits");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    []
  );

  const loadFilterOptions = useCallback(async () => {
    try {
      const [tagsRes, brandsRes, seriesRes, scalesRes] =
        await Promise.allSettled([
          api.getTags(),
          api.getFilterValues("brand"),
          api.getFilterValues("series"),
          api.getFilterValues("scale"),
        ]);

      if (tagsRes.status === "fulfilled") {
        setTags(tagsRes.value ?? []);
      }
      if (brandsRes.status === "fulfilled") {
        setBrandOptions(extractValues(brandsRes.value));
      }
      if (seriesRes.status === "fulfilled") {
        setSeriesOptions(extractValues(seriesRes.value));
      }
      if (scalesRes.status === "fulfilled") {
        setScaleOptions(extractValues(scalesRes.value));
      }
    } catch {
      // Non-critical; filter chips just won't populate
    }
  }, []);

  // Load previews for current kits (same pattern as Dashboard)
  useEffect(() => {
    if (kits.length === 0) {
      setPreviewMap(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      const results = await Promise.allSettled(kits.map(fetchKitPreview));
      if (cancelled) return;

      const map = new Map<number, string | null>();
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          map.set(r.value.kitId, r.value.url);
        }
      });
      setPreviewMap(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [kits]);

  // Initial load
  useEffect(() => {
    loadKits(1, filters, sort, false);
    loadFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filters or sort change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPage(1);
    loadKits(1, filters, sort, false);
  }, [filters, sort, loadKits]);

  // Debounced search text -> filters.q
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => {
        if (prev.q === searchText) return prev;
        return { ...prev, q: searchText };
      });
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchText]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const toggleFilter = useCallback((field: string, value: string) => {
    setFilters((prev) => {
      const arr = (prev as any)[field] as string[];
      const idx = arr.indexOf(value);
      if (idx === -1) {
        return { ...prev, [field]: [...arr, value] };
      } else {
        return { ...prev, [field]: arr.filter((v: string) => v !== value) };
      }
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...EMPTY_KIT_FILTERS });
    setSearchText("");
  }, []);

  const handleSortChange = useCallback((newSort: SortValue) => {
    setSort(newSort);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current) return;
    const maxPage = Math.ceil(total / PAGE_SIZE);
    if (page >= maxPage) return;

    const nextPage = page + 1;
    setPage(nextPage);
    loadKits(nextPage, filters, sort, true);
  }, [page, total, filters, sort, loadKits]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    loadKits(1, filters, sort, false, true);
  }, [filters, sort, loadKits]);

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const isFilterActive = hasActiveFilters(filters);

  // -----------------------------------------------------------------------
  // Render: filter group
  // -----------------------------------------------------------------------

  const renderFilterGroup = (
    label: string,
    options: string[],
    field: string,
    selectedValues: string[]
  ) => {
    if (options.length === 0) return null;
    return (
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>{label}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsInner}
        >
          {options.map((opt) => (
            <Tag
              key={opt}
              label={opt}
              active={selectedValues.includes(opt)}
              onPress={() => toggleFilter(field, opt)}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  // -----------------------------------------------------------------------
  // Render: list header (search + filters + results bar)
  // -----------------------------------------------------------------------

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>{"⌕"}</Text>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by name..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchText !== "" ? (
          <TouchableOpacity
            onPress={() => setSearchText("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Text style={styles.searchClear}>{"✕"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <View style={styles.filtersContainer}>
        {renderFilterGroup("Grade", GRADES, "grade", filters.grade)}
        {renderFilterGroup(
          "Status",
          BUILD_STATUS,
          "build_status",
          filters.build_status
        )}
        {renderFilterGroup("Brand", brandOptions, "brand", filters.brand)}
        {renderFilterGroup("Series", seriesOptions, "series", filters.series)}
        {renderFilterGroup("Scale", scaleOptions, "scale", filters.scale)}
        {tags.length > 0
          ? renderFilterGroup(
              "Tags",
              tags.map((t: any) => (typeof t === "string" ? t : t.name ?? t)),
              "tag",
              filters.tag
            )
          : null}

        {isFilterActive ? (
          <TouchableOpacity
            style={styles.clearFiltersBtn}
            onPress={clearFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Result count + sort */}
      <View style={styles.resultBar}>
        <Text style={styles.resultText}>
          Showing {kits.length} of {total} kits
        </Text>
        <SortToggle value={sort} onChange={handleSortChange} />
      </View>
    </View>
  );

  // -----------------------------------------------------------------------
  // Render: kit card in grid
  // -----------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <View style={styles.gridCell}>
        <KitCard
          kit={item}
          previewUrl={previewMap.get(item.id) ?? undefined}
          onPress={() => router.push(`/kits/${item.id}`)}
        />
      </View>
    ),
    [previewMap]
  );

  // -----------------------------------------------------------------------
  // Render: footer (load more spinner)
  // -----------------------------------------------------------------------

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  // -----------------------------------------------------------------------
  // Render: empty state
  // -----------------------------------------------------------------------

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>
          {isFilterActive
            ? "No kits match your filters. Try adjusting or clearing them."
            : "No kits yet. Add your first kit to get started."}
        </Text>
      </View>
    );
  };

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Kit Inventory</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.importLinkButton}
            onPress={() => router.push("/links/import")}
            activeOpacity={0.7}
          >
            <Text style={styles.importLinkText}>Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/kits/new")}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+ Kit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorRow}>
          <ErrorBanner message={error} />
          <TouchableOpacity onPress={handleRefresh} activeOpacity={0.7}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Initial loading (no kits yet) */}
      {loading && kits.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.muted} />
          <Text style={styles.loadingText}>Loading kits...</Text>
        </View>
      ) : (
        <FlatList
          data={kits}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Layout
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  } as ViewStyle,
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  } as ViewStyle,

  // Top bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  } as ViewStyle,
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  } as TextStyle,
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  } as ViewStyle,
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  } as ViewStyle,
  importLinkButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: colors.surface,
  } as ViewStyle,
  importLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  } as TextStyle,
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,

  // Error
  errorRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
  } as ViewStyle,
  retryText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
    marginTop: 6,
    marginLeft: 4,
  } as TextStyle,

  // Loading (initial)
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  } as ViewStyle,
  loadingText: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 10,
  } as TextStyle,

  // Header container
  headerContainer: {
    paddingTop: 8,
    paddingBottom: 12,
  } as ViewStyle,

  // Search bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  } as ViewStyle,
  searchIcon: {
    fontSize: 18,
    color: colors.muted,
    marginRight: 8,
  } as TextStyle,
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  } as TextStyle,
  searchClear: {
    fontSize: 16,
    color: colors.muted,
    paddingLeft: 8,
  } as TextStyle,

  // Filter chips
  filtersContainer: {
    marginBottom: 8,
  } as ViewStyle,
  filterGroup: {
    marginBottom: 8,
  } as ViewStyle,
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  } as TextStyle,
  filterChipsInner: {
    gap: 6,
    paddingRight: 20,
  } as ViewStyle,
  clearFiltersBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(141,43,43,0.06)",
  } as ViewStyle,
  clearFiltersText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.danger,
  } as TextStyle,

  // Result bar
  resultBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 4,
  } as ViewStyle,
  resultText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  } as TextStyle,

  // Grid
  gridRow: {
    gap: 12,
    marginBottom: 12,
  } as ViewStyle,
  gridCell: {
    flex: 1,
  } as ViewStyle,

  // Footer (load more)
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
  } as ViewStyle,
  footerText: {
    fontSize: 14,
    color: colors.muted,
  } as TextStyle,

  // Empty
  emptyBox: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    marginTop: 20,
  } as ViewStyle,
  emptyText: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  } as TextStyle,
});
