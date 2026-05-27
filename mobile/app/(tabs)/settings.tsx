import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  loadTokenFromStorage,
  setAuthToken,
  setRefreshToken,
  api,
  API_BASE_URL,
  REFRESH_TOKEN_STORAGE_KEY,
} from "../../lib/api/client";
import {
  BACKEND_READY_TIMEOUT_MS,
  IMAGE_CACHE_CONFIG,
  SYNC_MAX_JOBS_PER_RUN,
} from "../../lib/config";
import { clearRemoteImageCache, getImageCacheStats } from "../../lib/imageCache";
import Button from "../../components/ui/Button";
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

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

// ---------------------------------------------------------------------------
// Settings Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState({ count: 0, byteSize: 0 });
  const [clearingCache, setClearingCache] = useState(false);

  // -----------------------------------------------------------------------
  // Auth check
  // -----------------------------------------------------------------------

  const checkAuth = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const token = await loadTokenFromStorage();
      setIsAuthenticated(token !== null);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const refreshCacheStats = useCallback(async () => {
    try {
      setCacheStats(await getImageCacheStats());
    } catch {
      setCacheStats({ count: 0, byteSize: 0 });
    }
  }, []);

  useEffect(() => {
    refreshCacheStats();
  }, [refreshCacheStats]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
      try {
        await api.logout(refreshToken);
      } catch {
        // Server-side logout is best-effort
      }
      await setAuthToken(null);
      await setRefreshToken(null);
      setIsAuthenticated(false);
    } catch (err: any) {
      setError(err?.message || "Failed to logout");
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmClearImageCache = () => {
    Alert.alert(
      "Clear image cache?",
      "This only removes synced remote display/thumbnail cache. Pending local originals are kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setClearingCache(true);
            setError(null);
            try {
              await clearRemoteImageCache();
              await refreshCacheStats();
            } catch (err: any) {
              setError(err?.message || "Failed to clear image cache");
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

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
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>App configuration and session</Text>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorWrapper}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        {/* Session */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Session</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            {checkingAuth ? (
              <Text style={styles.statusMuted}>Checking...</Text>
            ) : (
              <Text
                style={[
                  styles.statusValue,
                  isAuthenticated ? styles.authActive : styles.authInactive,
                ]}
              >
                {isAuthenticated ? "Authenticated" : "Guest"}
              </Text>
            )}
          </View>
        </View>

        {/* API Base URL */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>API Base URL</Text>
            <Text style={styles.infoValue} selectable>
              {API_BASE_URL}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ready Timeout</Text>
            <Text style={styles.infoValue}>
              {BACKEND_READY_TIMEOUT_MS} ms
            </Text>
          </View>
        </View>

        {/* Offline asset tuning */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Offline Assets</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Display Cache</Text>
            <Text style={styles.infoValue}>
              {IMAGE_CACHE_CONFIG.displayMaxEdge}px · q{IMAGE_CACHE_CONFIG.displayQuality}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thumbnail Cache</Text>
            <Text style={styles.infoValue}>
              {IMAGE_CACHE_CONFIG.thumbnailMaxEdge}px · q{IMAGE_CACHE_CONFIG.thumbnailQuality}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cache Limit</Text>
            <Text style={styles.infoValue}>
              {formatBytes(IMAGE_CACHE_CONFIG.maxBytes)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Remote Cache</Text>
            <Text style={styles.infoValue}>
              {formatBytes(cacheStats.byteSize)} · {cacheStats.count} assets
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sync Batch</Text>
            <Text style={styles.infoValue}>
              {SYNC_MAX_JOBS_PER_RUN > 0
                ? `${SYNC_MAX_JOBS_PER_RUN} jobs/run`
                : "All queued jobs"}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Button
              title={clearingCache ? "Clearing..." : "Clear Synced Image Cache"}
              onPress={confirmClearImageCache}
              variant="ghost"
              disabled={clearingCache || cacheStats.count === 0}
              loading={clearingCache}
            />
          </View>
        </View>

        {/* Filter Management */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Data</Text>
          <Text style={styles.sectionDescription}>
            Manage custom filter values for brands, series, scales, and tags.
          </Text>
          <View style={styles.actionRow}>
            <Button
              title="Open Filter Management"
              onPress={() => router.push("/settings/filters")}
              variant="ghost"
            />
          </View>
        </View>

        {/* Logout */}
        {isAuthenticated ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Button
              title={loggingOut ? "Logging out..." : "Logout"}
              onPress={handleLogout}
              variant="danger"
              disabled={loggingOut}
              loading={loggingOut}
            />
          </View>
        ) : null}

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

  // Error
  errorWrapper: {
    marginBottom: 16,
  } as ViewStyle,

  // Section card
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 12,
  } as TextStyle,
  sectionDescription: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 12,
  } as TextStyle,

  // Session
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  statusLabel: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: "500",
  } as TextStyle,
  statusValue: {
    fontSize: 15,
    fontWeight: "600",
  } as TextStyle,
  statusMuted: {
    fontSize: 15,
    color: colors.muted,
  } as TextStyle,
  authActive: {
    color: "#2a6b4e",
  } as TextStyle,
  authInactive: {
    color: colors.muted,
  } as TextStyle,

  // Connection
  infoRow: {
    gap: 6,
    marginBottom: 10,
  } as ViewStyle,
  infoLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
  } as TextStyle,
  infoValue: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: "monospace",
    backgroundColor: "#f5f3ee",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: "hidden",
  } as TextStyle,

  // Actions
  actionRow: {
    alignItems: "flex-start",
  } as ViewStyle,

  // Bottom spacer
  bottomSpacer: {
    height: 48,
  } as ViewStyle,
});
