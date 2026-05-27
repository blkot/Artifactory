import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api } from "../../lib/api/client";
import { LINK_CATEGORIES } from "../../lib/constants";
import { normalizeLinkUrl, parseSharedLink } from "../../lib/linkParser";
import Button from "../../components/ui/Button";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Tag from "../../components/ui/Tag";

const colors = {
  bg: "#f3efe8",
  surface: "#ffffff",
  ink: "#1b1d1f",
  muted: "#5f6870",
  line: "#d7d2c9",
  accent: "#c5672a",
  danger: "#8d2b2b",
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function LinkImportScreen() {
  const { sharedText, sharedUrl } = useLocalSearchParams<{
    sharedText?: string | string[];
    sharedUrl?: string | string[];
  }>();
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("REVIEW");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [kits, setKits] = useState<any[]>([]);
  const [kitQuery, setKitQuery] = useState("");
  const [selectedKitId, setSelectedKitId] = useState<number | null>(null);
  const [loadingKits, setLoadingKits] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialSharedPayload = useMemo(() => {
    return [firstParam(sharedText), firstParam(sharedUrl)]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" ");
  }, [sharedText, sharedUrl]);

  const applyRawText = useCallback((text: string) => {
    setRawText(text);
    const parsed = parseSharedLink(text);
    if (!parsed) return;
    setUrl(parsed.url);
    setTitle(parsed.title);
    setCategory(parsed.category);
    setNotes(parsed.notes);
    setSource(parsed.source);
    setThumbnailUri(parsed.thumbnailUri ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getKits({ limit: 100 });
        if (!cancelled) {
          setKits(data?.items ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load kits");
        }
      } finally {
        if (!cancelled) {
          setLoadingKits(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialSharedPayload) {
      applyRawText(initialSharedPayload);
      return;
    }

    (async () => {
      try {
        const text = await Clipboard.getStringAsync();
        applyRawText(text);
      } catch {
        // Clipboard can be denied by iOS privacy settings. Manual paste still works.
      }
    })();
  }, [applyRawText, initialSharedPayload]);

  const filteredKits = useMemo(() => {
    const q = kitQuery.trim().toLowerCase();
    if (!q) return kits;
    return kits.filter((kit) =>
      [kit.name, kit.series, kit.brand, kit.grade, kit.scale]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [kits, kitQuery]);
  const selectedKit = useMemo(
    () => kits.find((kit) => kit.id === selectedKitId) ?? null,
    [kits, selectedKitId]
  );

  const handleSave = async () => {
    if (!selectedKitId || !url.trim() || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const normalizedUrl = normalizeLinkUrl(url);
      const existingLinks = await api.getLinks(selectedKitId);
      const duplicate = Array.isArray(existingLinks)
        ? existingLinks.find(
            (link) => normalizeLinkUrl(String(link.url)) === normalizedUrl
          )
        : null;
      if (duplicate) {
        if (
          thumbnailUri?.startsWith("file://") &&
          duplicate.id &&
          !duplicate.thumbnail_url &&
          !duplicate.thumbnail_path
        ) {
          try {
            const formData = new FormData();
            formData.append("file", {
              uri: thumbnailUri,
              name: thumbnailUri.split("/").pop()?.split("?")[0] || "link-thumbnail.jpg",
              type: thumbnailUri.toLowerCase().includes(".png") ? "image/png" : "image/jpeg",
            } as any);
            await api.uploadLinkThumbnail(duplicate.id, formData);
            router.replace(`/kits/${selectedKitId}?tab=links`);
            return;
          } catch {
            setError("That kit already has this link, and the thumbnail could not be attached.");
            return;
          }
        }
        setError("That kit already has this link.");
        return;
      }

      const newLink = await api.createLink({
        kit_id: selectedKitId,
        url: url.trim(),
        category,
        title: title.trim(),
        notes: notes.trim() || null,
        source,
        tag_ids: [],
      });
      if (thumbnailUri?.startsWith("file://") && newLink?.id) {
        try {
          const formData = new FormData();
          formData.append("file", {
            uri: thumbnailUri,
            name: thumbnailUri.split("/").pop()?.split("?")[0] || "link-thumbnail.jpg",
            type: thumbnailUri.toLowerCase().includes(".png") ? "image/png" : "image/jpeg",
          } as any);
          await api.uploadLinkThumbnail(newLink.id, formData);
        } catch {
          // The link itself is already saved; the shared thumbnail is optional.
        }
      }
      router.replace(`/kits/${selectedKitId}?tab=links`);
    } catch (err: any) {
      setError(err?.message || "Failed to save link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>{"‹ Back"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Link</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorWrap}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Shared Text</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={rawText}
            onChangeText={applyRawText}
            placeholder="Paste shared content here..."
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
          />
          <Button
            title="Parse Clipboard"
            variant="ghost"
            onPress={async () => {
              try {
                applyRawText(await Clipboard.getStringAsync());
              } catch {
                setError("Clipboard access was not available. Paste manually.");
              }
            }}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Link</Text>
          {source || thumbnailUri ? (
            <View style={styles.sourcePreview}>
              {thumbnailUri ? (
                <Image source={{ uri: thumbnailUri }} style={styles.thumbnailPreview} />
              ) : null}
              {source ? (
                <Text style={styles.sourceBadge}>{source}</Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.label}>URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Link title"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {LINK_CATEGORIES.map((item) => (
              <Tag
                key={item}
                label={item.replace(/_/g, " ")}
                active={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </View>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Choose Kit</Text>
          <TextInput
            style={styles.input}
            value={kitQuery}
            onChangeText={setKitQuery}
            placeholder="Search kits..."
            placeholderTextColor={colors.muted}
          />
          {loadingKits ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.loadingText}>Loading kits...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.kitListScroll}
              contentContainerStyle={styles.kitList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {filteredKits.slice(0, 30).map((kit) => {
                const selected = selectedKitId === kit.id;
                return (
                  <TouchableOpacity
                    key={kit.id}
                    style={[styles.kitRow, selected && styles.kitRowSelected]}
                    onPress={() => setSelectedKitId(kit.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.kitName} numberOfLines={1}>
                      {kit.name}
                    </Text>
                    <Text style={styles.kitMeta} numberOfLines={1}>
                      {[kit.grade, kit.scale, kit.series].filter(Boolean).join(" · ")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>
      <View style={styles.actionBar}>
        <View style={styles.actionSummary}>
          <Text style={styles.actionLabel}>Target kit</Text>
          <Text style={styles.actionTitle} numberOfLines={1}>
            {selectedKit?.name || "Choose a kit"}
          </Text>
        </View>
        <View style={styles.actionButton}>
          <Button
            title={saving ? "Saving..." : "Save Link"}
            onPress={handleSave}
            loading={saving}
            disabled={!selectedKitId || !url.trim() || !title.trim() || saving}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  } as ViewStyle,
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
  } as ViewStyle,
  backText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  } as TextStyle,
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  } as TextStyle,
  headerSpacer: {
    width: 48,
  } as ViewStyle,
  scroll: {
    flex: 1,
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  } as ViewStyle,
  errorWrap: {
    marginBottom: 12,
  } as ViewStyle,
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 10,
  } as TextStyle,
  label: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "700",
    marginBottom: 5,
    marginTop: 8,
    textTransform: "uppercase",
  } as TextStyle,
  sourcePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  } as ViewStyle,
  thumbnailPreview: {
    width: 84,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#eee8df",
  },
  sourceBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(197,103,42,0.12)",
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  } as TextStyle,
  input: {
    borderWidth: 1,
    borderColor: "#b9b2a7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#ffffff",
  } as TextStyle,
  multilineInput: {
    minHeight: 96,
    marginBottom: 10,
  } as TextStyle,
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  } as ViewStyle,
  loadingText: {
    fontSize: 14,
    color: colors.muted,
  } as TextStyle,
  kitListScroll: {
    maxHeight: 260,
    marginTop: 10,
  } as ViewStyle,
  kitList: {
    gap: 8,
    paddingBottom: 2,
  } as ViewStyle,
  kitRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#faf8f5",
  } as ViewStyle,
  kitRowSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(197,103,42,0.08)",
  } as ViewStyle,
  kitName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  } as TextStyle,
  kitMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  } as TextStyle,
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    zIndex: 2,
  } as ViewStyle,
  actionSummary: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  actionLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "800",
    textTransform: "uppercase",
  } as TextStyle,
  actionTitle: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "700",
    marginTop: 2,
  } as TextStyle,
  actionButton: {
    minWidth: 130,
  } as ViewStyle,
});
