import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ViewStyle,
  TextStyle,
} from "react-native";
import { api } from "../../lib/api/client";
import Button from "../../components/ui/Button";
import Tag from "../../components/ui/Tag";
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

const TAG_COLORS = [
  "#c5672a",
  "#8d2b2b",
  "#2a6b4e",
  "#2a5c8d",
  "#8d6e2a",
  "#6b2a8d",
  "#2a8d8d",
  "#8d2a6b",
];

const FIELDS = ["brand", "series", "scale", "tag"] as const;
type FieldName = (typeof FIELDS)[number];

const FIELD_LABELS: Record<FieldName, string> = {
  brand: "Brand",
  series: "Series",
  scale: "Scale",
  tag: "Tag",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValueWithCount {
  value: string;
  count: number;
  color?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFilterValues(data: any): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map((v: any) => v.value ?? v);
  if (Array.isArray(data?.values)) return data.values.map((v: any) => v.value ?? v);
  if (Array.isArray(data?.items)) return data.items.map((v: any) => v.value ?? v);
  return [];
}

// ---------------------------------------------------------------------------
// Filter Management Screen
// ---------------------------------------------------------------------------

export default function FilterManagementScreen() {
  // Data
  const [kits, setKits] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [filterValues, setFilterValues] = useState<
    Record<string, string[]>
  >({ brand: [], series: [], scale: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedField, setSelectedField] = useState<FieldName>("brand");
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // Load tags and filter values in parallel
        const [tagsData, brandsData, seriesData, scalesData] =
          await Promise.all([
            api.getTags(),
            api.getFilterValues("brand"),
            api.getFilterValues("series"),
            api.getFilterValues("scale"),
          ]);

        if (cancelled) return;

        setTags(
          Array.isArray(tagsData)
            ? tagsData
            : (tagsData as any)?.items ?? [],
        );
        setFilterValues({
          brand: extractFilterValues(brandsData),
          series: extractFilterValues(seriesData),
          scale: extractFilterValues(scalesData),
        });

        // Load kits (paginated up to 200)
        const allKits: any[] = [];
        let hasMore = true;
        let skip = 0;
        while (hasMore && allKits.length < 200) {
          const data = await api.getKits({ skip, limit: 50 });
          if (cancelled) return;
          const items: any[] = data?.items ?? [];
          allKits.push(...items);
          hasMore = items.length === 50;
          skip += 50;
        }
        setKits(allKits);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------------------------------------------
  // Derived: values for the selected field with counts
  // -----------------------------------------------------------------------

  const fieldValues = useMemo((): ValueWithCount[] => {
    if (selectedField === "tag") {
      // Merge tag definitions with usage counts from kits
      const result = new Map<string, { count: number; color?: string }>();

      // Start with all defined tags (count 0)
      for (const t of tags) {
        const name = typeof t === "string" ? t : t.name;
        const color = typeof t === "string" ? undefined : t.color;
        result.set(name, { count: 0, color });
      }

      // Add usage counts from kits
      for (const kit of kits) {
        if (Array.isArray(kit.tags)) {
          for (const t of kit.tags) {
            const name = typeof t === "string" ? t : t.name;
            const tagColor = typeof t === "string" ? undefined : t.color;
            const existing = result.get(name);
            if (existing !== undefined) {
              existing.count += 1;
              if (!existing.color && tagColor) {
                existing.color = tagColor;
              }
            } else {
              result.set(name, { count: 1, color: tagColor });
            }
          }
        }
      }

      return Array.from(result.entries())
        .map(([value, info]) => ({
          value,
          count: info.count,
          color: info.color,
        }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    }

    // For brand / series / scale: union of filter_values table + kit data
    const result = new Map<string, number>();

    // Start with filter values from API (count 0)
    const apiValues = filterValues[selectedField] || [];
    for (const v of apiValues) {
      if (v) result.set(v, 0);
    }

    // Add counts from kit data
    for (const kit of kits) {
      const val = kit[selectedField];
      if (val) {
        result.set(val, (result.get(val) || 0) + 1);
      }
    }

    return Array.from(result.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }, [selectedField, kits, tags, filterValues]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleCreate = useCallback(async () => {
    const value = newValue.trim();
    if (!value) return;

    setCreating(true);
    try {
      if (selectedField === "tag") {
        const color =
          TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
        const created = (await api.createTag({ name: value, color })) as any;
        setTags((prev) => [...prev, created]);
      } else {
        await api.createFilterValue(selectedField, value);
        setFilterValues((prev) => ({
          ...prev,
          [selectedField]: [
            ...(prev[selectedField] || []),
            value,
          ],
        }));
      }
      setNewValue("");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to create value");
    } finally {
      setCreating(false);
    }
  }, [newValue, selectedField]);

  const handleDelete = useCallback(
    async (value: string) => {
      setDeleting(value);
      try {
        await api.deleteFilterValue(selectedField, value);
        setFilterValues((prev) => ({
          ...prev,
          [selectedField]: (prev[selectedField] || []).filter(
            (v) => v !== value,
          ),
        }));
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to delete value");
      } finally {
        setDeleting(null);
      }
    },
    [selectedField],
  );

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const isInFilterValues = useCallback(
    (value: string): boolean => {
      return (filterValues[selectedField] || []).includes(value);
    },
    [selectedField, filterValues],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.muted} />
          <Text style={styles.loadingText}>Loading filter data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Error banner */}
          {error ? (
            <View style={styles.errorWrapper}>
              <ErrorBanner message={error} />
            </View>
          ) : null}

          {/* Field selector */}
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Field</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fieldChipRow}
            >
              {FIELDS.map((field) => (
                <Tag
                  key={field}
                  label={FIELD_LABELS[field]}
                  active={selectedField === field}
                  onPress={() => setSelectedField(field)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Values list */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Values for "{FIELD_LABELS[selectedField]}"
            </Text>

            {fieldValues.length === 0 ? (
              <Text style={styles.emptyText}>
                No values found. Create one below.
              </Text>
            ) : (
              <View style={styles.valuesList}>
                {fieldValues.map((item) => {
                  const canDelete =
                    selectedField !== "tag" &&
                    item.count === 0 &&
                    isInFilterValues(item.value);
                  const isDeleting = deleting === item.value;

                  return (
                    <View key={item.value} style={styles.valueRow}>
                      {/* Tag color dot */}
                      {item.color ? (
                        <View
                          style={[
                            styles.tagColorDot,
                            { backgroundColor: item.color },
                          ]}
                        />
                      ) : null}

                      {/* Value name */}
                      <Text style={styles.valueName} numberOfLines={1}>
                        {item.value}
                      </Text>

                      {/* Count badge */}
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>{item.count}</Text>
                      </View>

                      {/* Delete button */}
                      {canDelete ? (
                        <TouchableOpacity
                          style={[
                            styles.deleteBtn,
                            isDeleting && styles.deleteBtnDisabled,
                          ]}
                          onPress={() => handleDelete(item.value)}
                          disabled={isDeleting}
                          activeOpacity={0.7}
                        >
                          {isDeleting ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.danger}
                            />
                          ) : (
                            <Text style={styles.deleteBtnText}>Del</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.deleteBtnSpacer} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Create new value */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Create New Value</Text>
            <View style={styles.createRow}>
              <TextInput
                style={styles.createInput}
                value={newValue}
                onChangeText={setNewValue}
                placeholder={`Enter ${FIELD_LABELS[selectedField].toLowerCase()} name...`}
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                autoCorrect={false}
              />
              <Button
                title="Create"
                onPress={handleCreate}
                disabled={!newValue.trim() || creating}
                loading={creating}
              />
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
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
    paddingTop: 16,
    paddingBottom: 40,
  } as ViewStyle,

  // Loading
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

  // Field selector
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  } as TextStyle,
  fieldChipRow: {
    flexDirection: "row",
    gap: 8,
  } as ViewStyle,

  // Values list
  valuesList: {
    gap: 6,
  } as ViewStyle,
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "#faf8f5",
    gap: 8,
  } as ViewStyle,
  tagColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  } as ViewStyle,
  valueName: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontWeight: "500",
  } as TextStyle,
  countBadge: {
    backgroundColor: "#ede7de",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: "center",
  } as ViewStyle,
  countText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  } as TextStyle,
  deleteBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "rgba(141,43,43,0.06)",
  } as ViewStyle,
  deleteBtnDisabled: {
    opacity: 0.5,
  } as ViewStyle,
  deleteBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  } as TextStyle,
  deleteBtnSpacer: {
    width: 41, // Approximate width of the delete button to keep alignment
  } as ViewStyle,

  // Empty
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 16,
  } as TextStyle,

  // Create row
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  } as ViewStyle,
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#faf8f5",
  } as TextStyle,

  // Bottom spacer
  bottomSpacer: {
    height: 48,
  } as ViewStyle,
});
