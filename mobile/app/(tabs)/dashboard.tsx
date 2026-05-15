import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { router } from "expo-router";
import { api, API_BASE_URL } from "../../lib/api/client";
import MetricCard from "../../components/ui/MetricCard";
import KitCard from "../../components/ui/KitCard";
import SortToggle from "../../components/ui/SortToggle";
import ErrorBanner from "../../components/ui/ErrorBanner";

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
  if (asset.thumbnail_path || asset.thumbnail_url) {
    return `${API_BASE_URL}/assets/${asset.id}/thumbnail`;
  }
  return api.assetFileUrl(asset.id);
}

function formatCurrency(value: number): string {
  if (value >= 10_000) {
    const k = value / 1_000;
    return `¥${k.toFixed(k >= 100 ? 0 : 1)}K`;
  }
  if (Number.isInteger(value)) {
    return `¥${value.toLocaleString()}`;
  }
  return `¥${value.toFixed(2)}`;
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

// ---------------------------------------------------------------------------
// Dashboard Screen
// ---------------------------------------------------------------------------

export default function DashboardScreen() {
  // Stats
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Recent kits
  const [kits, setKits] = useState<any[]>([]);
  const [kitsLoading, setKitsLoading] = useState(true);
  const [kitsError, setKitsError] = useState<string | null>(null);

  // Sort
  const [sort, setSort] = useState<SortValue>({
    sort: "created_at",
    order: "desc",
  });

  // Kit previews
  const [previews, setPreviews] = useState<Map<number, string | null>>(
    new Map()
  );
  const [previewsLoading, setPreviewsLoading] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err: any) {
      setStatsError(err?.message || "Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadKits = useCallback(async (sortValue: SortValue) => {
    setKitsLoading(true);
    setKitsError(null);
    try {
      const data = await api.getKits({
        limit: 10,
        sort: sortValue.sort,
        order: sortValue.order,
      });
      setKits(data?.items ?? []);
    } catch (err: any) {
      setKitsError(err?.message || "Failed to load kits");
    } finally {
      setKitsLoading(false);
    }
  }, []);

  // Load previews for the current kits
  useEffect(() => {
    if (kits.length === 0) {
      setPreviews(new Map());
      return;
    }

    let cancelled = false;
    setPreviewsLoading(true);

    (async () => {
      const results = await Promise.allSettled(kits.map(fetchKitPreview));
      if (cancelled) return;

      const map = new Map<number, string | null>();
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          map.set(r.value.kitId, r.value.url);
        }
      });
      setPreviews(map);
      setPreviewsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [kits]);

  // Initial load
  useEffect(() => {
    loadStats();
    loadKits(sort);
  }, [loadStats, loadKits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload kits when sort changes
  useEffect(() => {
    loadKits(sort);
  }, [sort, loadKits]);

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------

  const activeCount: number =
    stats?.by_status?.find(
      (s: { status: string; count: number }) =>
        s.status === "BuildStatus.IN_PROGRESS" || s.status === "IN_PROGRESS"
    )?.count ?? 0;

  const error = statsError || kitsError;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Monitor your collection</Text>
          </View>
        </View>

        {/* Error */}
        {error ? <ErrorBanner message={error} /> : null}

        {/* Stats Section */}
        <View style={styles.section}>
          {statsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.loadingText}>Loading stats...</Text>
            </View>
          ) : stats ? (
            <View style={styles.metricGrid}>
              <View style={styles.metricGridCell}>
                <MetricCard label="Total" value={stats.total_kits} />
              </View>
              <View style={styles.metricGridCell}>
                <MetricCard
                  label="Spent"
                  value={formatCurrency(stats.total_spent ?? 0)}
                />
              </View>
              <View style={styles.metricGridCell}>
                <MetricCard
                  label="Comp %"
                  value={`${Math.round(stats.completion_rate ?? 0)}%`}
                />
              </View>
              <View style={styles.metricGridCell}>
                <MetricCard label="Active" value={activeCount} />
              </View>
            </View>
          ) : null}
        </View>

        {/* Recent Kits Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Kits</Text>
            <SortToggle value={sort} onChange={setSort} />
          </View>

          {kitsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.loadingText}>Loading kits...</Text>
            </View>
          ) : kits.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No kits yet. Add your first kit to get started.
              </Text>
            </View>
          ) : (
            <FlatList
              horizontal
              data={kits}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item }: { item: any }) => (
                <View style={styles.kitCardWrapper}>
                  <KitCard
                    kit={item}
                    previewUrl={previews.get(item.id) ?? undefined}
                    onPress={() => router.push(`/kits/${item.id}`)}
                  />
                </View>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kitListContent}
              scrollEnabled={kits.length > 1}
            />
          )}

          {previewsLoading && kits.length > 0 ? (
            <Text style={styles.previewsHint}>Loading previews...</Text>
          ) : null}
        </View>

        {/* View Inventory Link */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.viewAll}
            onPress={() => router.push("/(tabs)/kits")}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View Inventory</Text>
            <Text style={styles.viewAllArrow}>&rarr;</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  } as ViewStyle,

  scroll: {
    flex: 1,
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  } as ViewStyle,

  // Header
  header: {
    marginBottom: 24,
  } as ViewStyle,
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    marginTop: 4,
  } as TextStyle,

  // Sections
  section: {
    marginBottom: 28,
  } as ViewStyle,
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  } as TextStyle,

  // Loading / Empty
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 18,
  } as ViewStyle,
  loadingText: {
    fontSize: 15,
    color: colors.muted,
  } as TextStyle,
  emptyBox: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  } as ViewStyle,
  emptyText: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  } as TextStyle,

  // Metric grid (2 columns)
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  } as ViewStyle,
  metricGridCell: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "48%",
  } as ViewStyle,

  // Kit card in horizontal list
  kitCardWrapper: {
    width: 200,
    marginRight: 12,
  } as ViewStyle,
  kitListContent: {
    paddingRight: 20,
  } as ViewStyle,

  // Preview loading hint
  previewsHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 10,
    marginLeft: 4,
  } as TextStyle,

  // View all link
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  } as ViewStyle,
  viewAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff9f2",
  } as TextStyle,
  viewAllArrow: {
    fontSize: 18,
    color: "#fff9f2",
    marginTop: -1,
  } as TextStyle,

  // Bottom spacer
  bottomSpacer: {
    height: 48,
  } as ViewStyle,
});
