import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Alert,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../lib/api/client";
import { GRADES, BUILD_STATUS, EMPTY_KIT_FORM } from "../../lib/constants";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Tag from "../../components/ui/Tag";
import ErrorBanner from "../../components/ui/ErrorBanner";
import ImmichPicker from "../../components/ImmichPicker";
import {
  buildLocalImageAssetFormData,
  takeAssetPhoto,
} from "../../lib/assetUpload";

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImmichAssetRef {
  id: string;
  originalFileName?: string;
  originalPath?: string;
}

interface SectionItem {
  key: string;
  file: ImagePicker.ImagePickerAsset;
  status: "pending" | "uploading" | "done" | "error";
  // For Immich imports
  immichAsset?: ImmichAssetRef;
  isImmich?: boolean;
}

interface SectionItems {
  boxArt: SectionItem[];
  manual: SectionItem[];
  buildPhotos: SectionItem[];
  referenceImages: SectionItem[];
}

const ASSET_TYPE_MAP: Record<keyof SectionItems, string> = {
  boxArt: "BOX_ART",
  manual: "MANUAL",
  buildPhotos: "BUILD_PHOTO",
  referenceImages: "REFERENCE_IMAGE",
};

const SECTION_LABELS: Record<keyof SectionItems, string> = {
  boxArt: "Box Art",
  manual: "Manual",
  buildPhotos: "Build Photos",
  referenceImages: "Reference Images",
};

let _keyCounter = 0;
function nextKey(): string {
  _keyCounter += 1;
  return `img_${Date.now()}_${_keyCounter}`;
}

const STATUS_BADGE: Record<
  SectionItem["status"],
  { label: string; bg: string; color: string }
> = {
  pending: { label: "New", bg: "#ede7de", color: "#3e3b37" },
  uploading: { label: "Uploading", bg: "#e8e3fa", color: "#3e2a8d" },
  done: { label: "Done", bg: "#d9f2e6", color: "#2a6b4e" },
  error: { label: "Error", bg: "#ffe7e7", color: "#8d2b2b" },
};

// ---------------------------------------------------------------------------
// ChipSelector
// ---------------------------------------------------------------------------

function ChipSelector({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((option) => {
        const active = option === selected;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(option)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// NewKitScreen
// ---------------------------------------------------------------------------

export default function NewKitScreen() {
  const [form, setForm] = useState({ ...EMPTY_KIT_FORM });
  const [showOptional, setShowOptional] = useState(false);
  const [sectionItems, setSectionItems] = useState<SectionItems>({
    boxArt: [],
    manual: [],
    buildPhotos: [],
    referenceImages: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    brand: string[];
    series: string[];
    scale: string[];
  }>({ brand: [], series: [], scale: [] });
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showCreateTag, setShowCreateTag] = useState(false);

  // Immich picker
  const [immichPickerOpen, setImmichPickerOpen] = useState(false);
  const [activeImmichSection, setActiveImmichSection] =
    useState<keyof SectionItems | null>(null);
  const [immichTagNames, setImmichTagNames] = useState<string[]>([]);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const [tagsData, brandData, seriesData, scaleData] = await Promise.all([
          api.getTags(),
          api.getFilterValues("brand"),
          api.getFilterValues("series"),
          api.getFilterValues("scale"),
        ]);
        setTags(
          Array.isArray(tagsData) ? tagsData : (tagsData as any)?.items ?? [],
        );
        setFilterOptions({
          brand: Array.isArray(brandData)
            ? brandData
            : (brandData as any)?.values ?? [],
          series: Array.isArray(seriesData)
            ? seriesData
            : (seriesData as any)?.values ?? [],
          scale: Array.isArray(scaleData)
            ? scaleData
            : (scaleData as any)?.values ?? [],
        });
      } catch (_) {
        // suggestions are non-critical; form works without them
      }
    })();
  }, []);

  // Request media library permission on mount
  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTag = (tagId: number) => {
    setForm((prev) => {
      const current = prev.tag_ids as number[];
      if (current.includes(tagId)) {
        return { ...prev, tag_ids: current.filter((id) => id !== tagId) };
      }
      return { ...prev, tag_ids: [...current, tagId] };
    });
  };

  // -----------------------------------------------------------------------
  // Tag creation
  // -----------------------------------------------------------------------

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await api.createTag({ name, color: newTagColor });
      const newTag = created as any;
      setTags((prev) => [...prev, newTag]);
      setForm((prev) => ({
        ...prev,
        tag_ids: [...(prev.tag_ids as number[]), newTag.id],
      }));
      setNewTagName("");
      setShowCreateTag(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to create tag");
    }
  };

  // -----------------------------------------------------------------------
  // Image picking
  // -----------------------------------------------------------------------

  const pickImages = async (section: keyof SectionItems) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const newItems: SectionItem[] = result.assets.map((asset) => ({
        key: nextKey(),
        file: asset,
        status: "pending" as const,
      }));

      setSectionItems((prev) => ({
        ...prev,
        [section]: [...prev[section], ...newItems],
      }));
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to pick images");
    }
  };

  const takePhoto = async (section: keyof SectionItems) => {
    try {
      const asset = await takeAssetPhoto();
      if (!asset) return;

      setSectionItems((prev) => ({
        ...prev,
        [section]: [
          ...prev[section],
          {
            key: nextKey(),
            file: asset,
            status: "pending" as const,
          },
        ],
      }));
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to take photo");
    }
  };

  const removeItem = (section: keyof SectionItems, key: string) => {
    setSectionItems((prev) => ({
      ...prev,
      [section]: prev[section].filter((item) => item.key !== key),
    }));
  };

  const handleImmichConfirm = (
    immichAssets: any[],
    tagNames: string[]
  ) => {
    setImmichPickerOpen(false);
    setImmichTagNames(tagNames);

    const section = activeImmichSection;
    if (!section) return;

    const newItems: SectionItem[] = immichAssets.map((asset) => ({
      key: nextKey(),
      file: {
        uri: "",
        width: 0,
        height: 0,
      } as ImagePicker.ImagePickerAsset,
      status: "pending" as const,
      immichAsset: {
        id: asset.id,
        originalFileName: asset.originalFileName,
        originalPath: asset.originalPath,
      },
      isImmich: true,
    }));

    setSectionItems((prev) => ({
      ...prev,
      [section]: [...prev[section], ...newItems],
    }));
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const totalFiles = Object.values(sectionItems).reduce(
    (sum, items) => sum + items.length,
    0,
  );

  const handleSubmit = async () => {
    setError(null);

    if (!form.name.trim()) {
      setError("Kit name is required.");
      return;
    }

    setSubmitting(true);
    try {
      // Build kit payload
      const kitPayload: any = {
        name: form.name.trim(),
        grade: form.grade,
        series: form.series.trim(),
        brand: form.brand.trim(),
        scale: form.scale.trim(),
      };

      if (form.kit_number.trim()) {
        kitPayload.kit_number = form.kit_number.trim();
      }
      if (form.purchase_date) {
        kitPayload.purchase_date = form.purchase_date;
      }
      if (form.purchase_price) {
        const price = parseFloat(form.purchase_price);
        if (!isNaN(price)) {
          kitPayload.purchase_price = price;
        }
      }
      if (form.purchase_shop.trim()) {
        kitPayload.purchase_shop = form.purchase_shop.trim();
      }
      if (form.build_status) {
        kitPayload.build_status = form.build_status;
      }
      if ((form.tag_ids as number[]).length > 0) {
        kitPayload.tag_ids = form.tag_ids;
      }

      const createdKit = (await api.createKit(kitPayload)) as any;

      // Upload files section by section, sequentially
      const sections = Object.keys(sectionItems) as (keyof SectionItems)[];
      for (const section of sections) {
        const assetType = ASSET_TYPE_MAP[section];
        const items = sectionItems[section];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          setSectionItems((prev) => {
            const updated = [...prev[section]];
            updated[i] = { ...updated[i], status: "uploading" };
            return { ...prev, [section]: updated };
          });

          try {
            if (item.isImmich && item.immichAsset) {
              // Immich external asset: create asset record without file upload
              const formData = new FormData();
              formData.append("kit_id", String(createdKit.id));
              formData.append("type", assetType);
              formData.append("external_source", "immich");
              formData.append("external_asset_id", item.immichAsset.id);
              formData.append(
                "original_filename",
                item.immichAsset.originalFileName ||
                  item.immichAsset.originalPath ||
                  "immich_image"
              );
              if (immichTagNames.length > 0) {
                formData.append(
                  "description",
                  `Immich tags: ${immichTagNames.join(", ")}`
                );
              }

              await api.uploadAsset(formData);
            } else {
              const formData = buildLocalImageAssetFormData({
                kitId: createdKit.id,
                type: assetType,
                asset: item.file,
              });

              await api.uploadAsset(formData);
            }

            setSectionItems((prev) => {
              const updated = [...prev[section]];
              updated[i] = { ...updated[i], status: "done" };
              return { ...prev, [section]: updated };
            });
          } catch {
            setSectionItems((prev) => {
              const updated = [...prev[section]];
              updated[i] = { ...updated[i], status: "error" };
              return { ...prev, [section]: updated };
            });
          }
        }
      }

      router.replace(`/kits/${createdKit.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create kit");
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderSuggestions = (field: "brand" | "series" | "scale") => {
    const values = filterOptions[field];
    if (values.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.suggestionsScroll}
        contentContainerStyle={styles.suggestionsRow}
      >
        {values.map((val) => (
          <TouchableOpacity
            key={val}
            onPress={() => updateField(field, val)}
            activeOpacity={0.7}
          >
            <Tag label={val} active={form[field] === val} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderImageSection = (section: keyof SectionItems) => {
    const items = sectionItems[section];
    return (
      <View style={styles.imageSection}>
        <View style={styles.imageActionRow}>
          <TouchableOpacity
            style={[styles.imageActionButton, styles.imageActionButtonPrimary]}
            onPress={() => takePhoto(section)}
            activeOpacity={0.7}
          >
            <Text style={styles.imageActionButtonPrimaryText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageActionButton}
            onPress={() => pickImages(section)}
            activeOpacity={0.7}
          >
            <Text style={styles.imageActionButtonText}>Choose Photos</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.immichImportButton}
          onPress={() => {
            setActiveImmichSection(section);
            setImmichPickerOpen(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.immichImportText}>Import from Immich</Text>
        </TouchableOpacity>

        {items.length > 0 && (
          <View style={styles.previewGrid}>
            {items.map((item) => (
              <View key={item.key} style={styles.previewTile}>
                {item.isImmich && item.immichAsset ? (
                  <View style={styles.immichPreviewPlaceholder}>
                    <Text style={styles.immichPreviewIcon}>{"🖼"}</Text>
                    <Text style={styles.immichPreviewLabel}>
                      {item.immichAsset.originalFileName ||
                        item.immichAsset.id ||
                        "Immich"}
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: item.file.uri }}
                    style={styles.previewImage}
                  />
                )}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeItem(section, item.key)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.removeButtonText}>{"×"}</Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_BADGE[item.status].bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: STATUS_BADGE[item.status].color },
                    ]}
                  >
                    {STATUS_BADGE[item.status].label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
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

        {/* ---- Required Section ---- */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Required</Text>

          <Input
            label="Name"
            value={form.name}
            onChangeText={(v) => updateField("name", v)}
            placeholder="RX-78-2 Gundam"
            required
          />

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Grade<Text style={styles.required}> *</Text>
            </Text>
            <ChipSelector
              options={GRADES}
              selected={form.grade}
              onSelect={(v) => updateField("grade", v)}
            />
          </View>

          <View style={styles.fieldGap} />

          <Input
            label="Series"
            value={form.series}
            onChangeText={(v) => updateField("series", v)}
            placeholder="Universal Century"
            required
          />
          {renderSuggestions("series")}

          <Input
            label="Brand"
            value={form.brand}
            onChangeText={(v) => updateField("brand", v)}
            placeholder="Bandai"
            required
          />
          {renderSuggestions("brand")}

          <Input
            label="Scale"
            value={form.scale}
            onChangeText={(v) => updateField("scale", v)}
            placeholder="1/144"
            required
          />
          {renderSuggestions("scale")}
        </View>

        {/* ---- Optional Section ---- */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setShowOptional((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>
              Optional {showOptional ? "▾" : "▸"}
            </Text>
          </TouchableOpacity>

          {showOptional && (
            <View style={styles.optionalContent}>
              <Input
                label="Kit Number"
                value={form.kit_number}
                onChangeText={(v) => updateField("kit_number", v)}
                placeholder="RG-01-001"
              />

              <Input
                label="Purchase Date"
                value={form.purchase_date}
                onChangeText={(v) => updateField("purchase_date", v)}
                placeholder="YYYY-MM-DD"
              />

              <Input
                label="Price"
                value={form.purchase_price}
                onChangeText={(v) => updateField("purchase_price", v)}
                placeholder="0.00"
                type="number"
              />

              <Input
                label="Shop"
                value={form.purchase_shop}
                onChangeText={(v) => updateField("purchase_shop", v)}
                placeholder="Amazon"
              />

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Build Status</Text>
                <ChipSelector
                  options={BUILD_STATUS}
                  selected={form.build_status}
                  onSelect={(v) => updateField("build_status", v)}
                />
              </View>

              <View style={styles.fieldGap} />

              {/* Tags */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Tags</Text>
                {tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {tags.map((tag: any) => {
                      const isSelected = (form.tag_ids as number[]).includes(
                        tag.id,
                      );
                      return (
                        <Tag
                          key={tag.id}
                          label={tag.name}
                          active={isSelected}
                          onPress={() => toggleTag(tag.id)}
                          color={tag.color}
                        />
                      );
                    })}
                  </View>
                )}

                {/* Create tag row */}
                {showCreateTag ? (
                  <View style={styles.createTagRow}>
                    <TextInput
                      style={styles.createTagInput}
                      value={newTagName}
                      onChangeText={setNewTagName}
                      placeholder="Tag name..."
                      placeholderTextColor={colors.muted}
                      autoFocus
                    />
                    <View style={styles.colorPresetsRow}>
                      {TAG_COLORS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          onPress={() => setNewTagColor(c)}
                          style={[
                            styles.colorPreset,
                            { backgroundColor: c },
                            newTagColor === c && styles.colorPresetSelected,
                          ]}
                        />
                      ))}
                    </View>
                    <View style={styles.createTagActions}>
                      <TouchableOpacity
                        onPress={handleCreateTag}
                        disabled={!newTagName.trim()}
                        style={[
                          styles.createTagButton,
                          !newTagName.trim() && styles.createTagButtonDisabled,
                        ]}
                      >
                        <Text style={styles.createTagButtonText}>Create</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setShowCreateTag(false);
                          setNewTagName("");
                        }}
                        style={styles.cancelTagButton}
                      >
                        <Text style={styles.cancelTagButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addTagButton}
                    onPress={() => setShowCreateTag(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addTagButtonText}>+ Create Tag...</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ---- Image Sections ---- */}
        {(Object.keys(SECTION_LABELS) as (keyof SectionItems)[]).map(
          (section) => (
            <View key={section} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {SECTION_LABELS[section]}
              </Text>
              {renderImageSection(section)}
            </View>
          ),
        )}

        {/* Submit */}
        <Button
          title={
            submitting
              ? "Creating..."
              : totalFiles > 0
                ? `Create Kit + Upload ${totalFiles} Image${totalFiles !== 1 ? "s" : ""}`
                : "Create Kit"
          }
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Immich Picker */}
      <ImmichPicker
        visible={immichPickerOpen}
        onClose={() => {
          setImmichPickerOpen(false);
          setActiveImmichSection(null);
        }}
        onConfirm={handleImmichConfirm}
      />
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

  // Field wrapper (for non-Input fields like Grade, Build Status, Tags)
  fieldWrapper: {
    marginBottom: 4,
  } as ViewStyle,
  fieldLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
    marginBottom: 4,
  } as TextStyle,
  required: {
    color: colors.danger,
  } as TextStyle,
  fieldGap: {
    height: 12,
  } as ViewStyle,

  // Chip row (horizontal scroll)
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  } as ViewStyle,
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d0c7bb",
    backgroundColor: "#ede7de",
  } as ViewStyle,
  chipActive: {
    backgroundColor: "#2f3740",
    borderColor: "#2f3740",
  } as ViewStyle,
  chipText: {
    fontSize: 13,
    color: "#3e3b37",
    fontWeight: "500",
  } as TextStyle,
  chipTextActive: {
    color: "#f9f2ea",
  } as TextStyle,

  // Suggestions row
  suggestionsScroll: {
    marginTop: -4,
    marginBottom: 4,
  } as ViewStyle,
  suggestionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  } as ViewStyle,

  // Collapsible
  collapsibleHeader: {
    // takes full width, sectionTitle handles text
  } as ViewStyle,
  optionalContent: {
    marginTop: 4,
  } as ViewStyle,

  // Tags
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  } as ViewStyle,
  addTagButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
    alignSelf: "flex-start",
  } as ViewStyle,
  addTagButtonText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  } as TextStyle,

  // Create tag
  createTagRow: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "#faf8f5",
  } as ViewStyle,
  createTagInput: {
    borderWidth: 1,
    borderColor: "#b9b2a7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
    marginBottom: 10,
  } as TextStyle,
  colorPresetsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  } as ViewStyle,
  colorPreset: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  } as ViewStyle,
  colorPresetSelected: {
    borderColor: colors.ink,
    transform: [{ scale: 1.15 }],
  } as ViewStyle,
  createTagActions: {
    flexDirection: "row",
    gap: 10,
  } as ViewStyle,
  createTagButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: colors.ink,
  } as ViewStyle,
  createTagButtonDisabled: {
    opacity: 0.5,
  } as ViewStyle,
  createTagButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff9f2",
  } as TextStyle,
  cancelTagButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  } as ViewStyle,
  cancelTagButtonText: {
    fontSize: 14,
    color: colors.muted,
  } as TextStyle,

  // Image sections
  imageSection: {} as ViewStyle,
  imageActionRow: {
    flexDirection: "row",
    gap: 10,
  } as ViewStyle,
  imageActionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#faf8f5",
  } as ViewStyle,
  imageActionButtonPrimary: {
    borderColor: colors.accent,
    backgroundColor: "rgba(197,103,42,0.08)",
  } as ViewStyle,
  imageActionButtonText: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: "500",
  } as TextStyle,
  imageActionButtonPrimaryText: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: "700",
  } as TextStyle,
  selectFilesButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#faf8f5",
  } as ViewStyle,
  selectFilesText: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: "500",
  } as TextStyle,

  // Preview grid
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  } as ViewStyle,
  previewTile: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
  } as ViewStyle,
  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  } as ImageStyle,
  removeButton: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  removeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  } as TextStyle,
  statusBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: "center",
  } as ViewStyle,
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  } as TextStyle,

  // Immich import button
  immichImportButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "rgba(197,103,42,0.05)",
  } as ViewStyle,
  immichImportText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent,
  } as TextStyle,

  // Immich preview placeholder
  immichPreviewPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8e4dc",
    padding: 4,
  } as ViewStyle,
  immichPreviewIcon: {
    fontSize: 18,
    marginBottom: 2,
  } as TextStyle,
  immichPreviewLabel: {
    fontSize: 8,
    color: colors.muted,
    textAlign: "center",
    numberOfLines: 2,
  } as TextStyle,

  // Bottom spacer
  bottomSpacer: {
    height: 32,
  } as ViewStyle,
});
