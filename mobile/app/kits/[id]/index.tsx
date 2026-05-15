import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Image,
  Modal,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { api, API_BASE_URL } from "../../../lib/api/client";
import { GRADES, BUILD_STATUS, LINK_CATEGORIES } from "../../../lib/constants";
import { buildKitEditForm, toUserMessage } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import Tag from "../../../components/ui/Tag";
import Input from "../../../components/ui/Input";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import ImageViewer from "../../../components/ImageViewer";
import ImmichPicker from "../../../components/ImmichPicker";

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
// Constants
// ---------------------------------------------------------------------------

const ASSET_TYPE_LABELS: Record<string, string> = {
  BOX_ART: "Box Art",
  MANUAL: "Manual",
  BUILD_PHOTO: "Build Photos",
  REFERENCE_IMAGE: "Reference Images",
  VIDEO: "Videos",
  DOCUMENT: "Documents",
};

const IMAGE_ASSET_TYPES = ["BOX_ART", "MANUAL", "BUILD_PHOTO", "REFERENCE_IMAGE"];

const DISPLAY_ASSET_TYPES = [
  "BOX_ART",
  "MANUAL",
  "BUILD_PHOTO",
  "REFERENCE_IMAGE",
  "VIDEO",
  "DOCUMENT",
];

const TAG_COLOR_PRESETS = [
  "#c5672a",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveThumbnailUrl(asset: any): string {
  if (asset.thumbnail_path || asset.thumbnail_url) {
    return `${API_BASE_URL}/assets/${asset.id}/thumbnail`;
  }
  return api.assetFileUrl(asset.id);
}

function formatPrice(price: any): string | null {
  if (price === null || price === undefined || price === "") return null;
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num) || num <= 0) return null;
  return `¥${num.toFixed(2)}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function groupAssetsByType(assets: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const asset of assets) {
    const type = asset.type || "OTHER";
    if (!groups[type]) groups[type] = [];
    groups[type].push(asset);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Enum chip selector
// ---------------------------------------------------------------------------

function ChipSelector({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipSelectorRow}>
      {options.map((opt) => (
        <Tag
          key={opt}
          label={opt.replace(/_/g, " ")}
          active={value === opt}
          onPress={() => onChange(opt)}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Kit detail screen
// ---------------------------------------------------------------------------

export default function KitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kitId = Number(id);

  // Data
  const [kit, setKit] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add tag
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PRESETS[0]);
  const [addingTag, setAddingTag] = useState(false);

  // Add link
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkForm, setLinkForm] = useState({
    url: "",
    category: "REVIEW" as string,
    title: "",
    notes: "",
  });
  const [linkAdding, setLinkAdding] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Add timeline
  const [showAddTimeline, setShowAddTimeline] = useState(false);
  const [timelineForm, setTimelineForm] = useState({
    status: "NEW" as string,
    notes: "",
  });
  const [timelineAdding, setTimelineAdding] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Image viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Immich picker
  const [immichPickerOpen, setImmichPickerOpen] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [kitData, assetsData, linksData, timelineData] =
        await Promise.all([
          api.getKit(kitId),
          api.getAssets({ kitId, limit: 50 }),
          api.getLinks(kitId),
          api.getTimeline(kitId),
        ]);

      setKit(kitData);
      setAssets(Array.isArray(assetsData?.items) ? assetsData.items : []);
      setLinks(Array.isArray(linksData) ? linksData : []);
      setTimeline(Array.isArray(timelineData) ? timelineData : []);
    } catch (err: any) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, [kitId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -----------------------------------------------------------------------
  // Edit kit handlers
  // -----------------------------------------------------------------------

  const handleStartEdit = () => {
    setSaveError(null);
    setEditForm(buildKitEditForm(kit));
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setSaveError(null);
  };

  const handleSaveKit = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const payload: any = { ...editForm };
      // Convert purchase_price empty string to null
      if (payload.purchase_price === "") payload.purchase_price = null;
      else if (payload.purchase_price != null)
        payload.purchase_price = Number(payload.purchase_price);
      // Convert purchase_date empty string to null
      if (payload.purchase_date === "") payload.purchase_date = null;
      // Keep tag_ids unchanged by not sending them in the form edit
      payload.tag_ids = (kit.tags || []).map((t: any) => t.id);

      const updated = await api.updateKit(kitId, payload);
      setKit(updated);
      setEditMode(false);
    } catch (err: any) {
      setSaveError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Tag handlers
  // -----------------------------------------------------------------------

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    setAddingTag(true);

    try {
      const newTag = await api.createTag({
        name: newTagName.trim(),
        color: newTagColor,
      });
      const tagIds = [...(kit.tags || []).map((t: any) => t.id), newTag.id];
      const updated = await api.updateKit(kitId, { tag_ids: tagIds });
      setKit(updated);
      setNewTagName("");
      setShowAddTag(false);
    } catch (err: any) {
      // Best-effort; keep UI in current state
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      const tagIds = (kit.tags || [])
        .map((t: any) => t.id)
        .filter((tid: number) => tid !== tagId);
      const updated = await api.updateKit(kitId, { tag_ids: tagIds });
      setKit(updated);
    } catch {
      // Best-effort
    }
  };

  // -----------------------------------------------------------------------
  // Asset handlers
  // -----------------------------------------------------------------------

  const handleDeleteAsset = async (assetId: number) => {
    try {
      await api.deleteAsset(assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      // If this was the cover asset, clear the thumbnail reference on kit
      if (kit.thumbnail_asset_id === assetId) {
        const updated = await api.updateKit(kitId, {
          thumbnail_asset_id: null,
        });
        setKit(updated);
      }
    } catch {
      // Best-effort
    }
  };

  const handleSetCover = async (assetId: number) => {
    try {
      const updated = await api.updateKit(kitId, {
        thumbnail_asset_id: assetId,
      });
      setKit(updated);
    } catch {
      // Best-effort
    }
  };

  const handleImmichConfirm = async (
    immichAssets: any[],
    tagNames: string[]
  ) => {
    setImmichPickerOpen(false);

    for (const immichAsset of immichAssets) {
      try {
        const formData = new FormData();
        formData.append("kit_id", String(kitId));
        formData.append("type", "REFERENCE_IMAGE");
        formData.append("external_source", "immich");
        formData.append("external_asset_id", immichAsset.id);
        formData.append(
          "original_filename",
          immichAsset.originalFileName || immichAsset.originalPath || "immich_image"
        );
        // Include tag names as notes/description
        if (tagNames.length > 0) {
          formData.append("description", `Immich tags: ${tagNames.join(", ")}`);
        }

        await api.uploadAsset(formData);
      } catch {
        // Best-effort per asset
      }
    }

    // Reload assets
    loadData();
  };

  // -----------------------------------------------------------------------
  // Link handlers
  // -----------------------------------------------------------------------

  const handleAddLink = async () => {
    if (!linkForm.url.trim() || !linkForm.title.trim()) return;
    setLinkAdding(true);
    setLinkError(null);

    try {
      const newLink = await api.createLink({
        kit_id: kitId,
        url: linkForm.url.trim(),
        category: linkForm.category,
        title: linkForm.title.trim(),
        notes: linkForm.notes.trim() || null,
        tag_ids: [],
      });
      setLinks((prev) => [...prev, newLink]);
      setLinkForm({ url: "", category: "REVIEW", title: "", notes: "" });
      setShowAddLink(false);
    } catch (err: any) {
      setLinkError(toUserMessage(err));
    } finally {
      setLinkAdding(false);
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    try {
      await api.deleteLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {
      // Best-effort
    }
  };

  // -----------------------------------------------------------------------
  // Timeline handlers
  // -----------------------------------------------------------------------

  const handleAddTimeline = async () => {
    setTimelineAdding(true);
    setTimelineError(null);

    try {
      const entry = await api.createTimeline(kitId, {
        status: timelineForm.status,
        notes: timelineForm.notes.trim() || null,
      });
      setTimeline((prev) => [entry, ...prev]);
      setTimelineForm({ status: "NEW", notes: "" });
      setShowAddTimeline(false);
    } catch (err: any) {
      setTimelineError(toUserMessage(err));
    } finally {
      setTimelineAdding(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const groupedAssets = groupAssetsByType(assets);
  const coverAsset = assets.find((a) => a.id === kit?.thumbnail_asset_id);
  const imageAssets = assets.filter((a) =>
    IMAGE_ASSET_TYPES.includes(a.type)
  );

  // -----------------------------------------------------------------------
  // Loading / error states
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.muted} />
        <Text style={styles.loadingText}>Loading kit...</Text>
      </SafeAreaView>
    );
  }

  if (error && !kit) {
    return (
      <SafeAreaView style={styles.centered}>
        <ErrorBanner message={error} />
        <TouchableOpacity
          onPress={loadData}
          style={styles.retryBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!kit) return null;

  // -----------------------------------------------------------------------
  // Tab renderers
  // -----------------------------------------------------------------------

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "assets", label: `Assets (${assets.length})` },
    { key: "links", label: `Links (${links.length})` },
    { key: "timeline", label: `Timeline (${timeline.length})` },
  ];

  const renderTabs = () => (
    <View style={styles.tabsRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsInner}
      >
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabPill, tab === t.key && styles.tabPillActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabPillText,
                tab === t.key && styles.tabPillTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // --- Overview tab ---

  const renderProfileRow = (label: string, value: string | null) => {
    if (!value) return null;
    return (
      <View style={styles.profileRow}>
        <Text style={styles.profileLabel}>{label}</Text>
        <Text style={styles.profileValue}>{value}</Text>
      </View>
    );
  };

  const renderOverview = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentInner}
      showsVerticalScrollIndicator={false}
    >
      {/* Kit Profile */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kit Profile</Text>
          {!editMode ? (
            <TouchableOpacity onPress={handleStartEdit} activeOpacity={0.7}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {editMode ? (
          <View style={styles.editForm}>
            {saveError ? (
              <View style={styles.formErrorWrap}>
                <ErrorBanner message={saveError} />
              </View>
            ) : null}

            <Text style={styles.formSectionLabel}>Required Fields</Text>
            <Input
              label="Name"
              value={editForm.name}
              onChangeText={(v) => setEditForm({ ...editForm, name: v })}
              placeholder="Kit name"
              required
            />
            <Text style={styles.fieldHint}>Grade</Text>
            <ChipSelector
              options={GRADES}
              value={editForm.grade}
              onChange={(v) => setEditForm({ ...editForm, grade: v })}
            />
            <Input
              label="Series"
              value={editForm.series}
              onChangeText={(v) => setEditForm({ ...editForm, series: v })}
              placeholder="e.g. Universal Century"
              required
            />
            <Input
              label="Brand"
              value={editForm.brand}
              onChangeText={(v) => setEditForm({ ...editForm, brand: v })}
              placeholder="e.g. Bandai"
              required
            />
            <Input
              label="Scale"
              value={editForm.scale}
              onChangeText={(v) => setEditForm({ ...editForm, scale: v })}
              placeholder="e.g. 1/144"
              required
            />

            <Text style={[styles.formSectionLabel, { marginTop: 16 }]}>
              Optional
            </Text>
            <Input
              label="Kit Number"
              value={editForm.kit_number || ""}
              onChangeText={(v) =>
                setEditForm({ ...editForm, kit_number: v })
              }
              placeholder="e.g. RG-01-001"
            />
            <Input
              label="Purchase Date"
              value={editForm.purchase_date || ""}
              onChangeText={(v) =>
                setEditForm({ ...editForm, purchase_date: v })
              }
              placeholder="YYYY-MM-DD"
              type="date"
            />
            <Input
              label="Purchase Price"
              value={
                editForm.purchase_price != null
                  ? String(editForm.purchase_price)
                  : ""
              }
              onChangeText={(v) =>
                setEditForm({ ...editForm, purchase_price: v })
              }
              placeholder="0.00"
              type="number"
            />
            <Input
              label="Purchase Shop"
              value={editForm.purchase_shop || ""}
              onChangeText={(v) =>
                setEditForm({ ...editForm, purchase_shop: v })
              }
              placeholder="Store name"
            />
            <Text style={styles.fieldHint}>Build Status</Text>
            <ChipSelector
              options={BUILD_STATUS}
              value={editForm.build_status}
              onChange={(v) =>
                setEditForm({ ...editForm, build_status: v })
              }
            />

            <View style={styles.editActions}>
              <Button
                title="Save Changes"
                onPress={handleSaveKit}
                loading={saving}
              />
              <Button
                title="Cancel"
                onPress={handleCancelEdit}
                variant="ghost"
                disabled={saving}
              />
            </View>
          </View>
        ) : (
          <View style={styles.profileList}>
            {renderProfileRow("Grade", kit.grade)}
            {renderProfileRow("Series", kit.series)}
            {renderProfileRow("Brand", kit.brand)}
            {renderProfileRow("Scale", kit.scale)}
            {renderProfileRow("Kit Number", kit.kit_number)}
            {renderProfileRow("Purchase Date", formatDate(kit.purchase_date))}
            {renderProfileRow("Price", formatPrice(kit.purchase_price))}
            {renderProfileRow("Shop", kit.purchase_shop)}
            {renderProfileRow(
              "Build Status",
              (kit.build_status || "").replace("BuildStatus.", "").replace(/_/g, " ")
            )}
          </View>
        )}
      </View>

      {/* Tags */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <TouchableOpacity
            onPress={() => setShowAddTag(!showAddTag)}
            activeOpacity={0.7}
          >
            <Text style={styles.editLink}>+ Add tag</Text>
          </TouchableOpacity>
        </View>

        {showAddTag ? (
          <View style={styles.addTagForm}>
            <View style={styles.addTagRow}>
              <TextInput
                style={styles.addTagInput}
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="Tag name"
                placeholderTextColor={colors.muted}
                autoFocus
              />
              <Button
                title="Create & Assign"
                onPress={handleAddTag}
                loading={addingTag}
                disabled={!newTagName.trim()}
              />
            </View>
            <Text style={styles.fieldHint}>Color</Text>
            <View style={styles.colorPresetRow}>
              {TAG_COLOR_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorPreset,
                    { backgroundColor: c },
                    newTagColor === c && styles.colorPresetActive,
                  ]}
                  onPress={() => setNewTagColor(c)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          </View>
        ) : null}

        {kit.tags && kit.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {kit.tags.map((t: any) => (
              <Tag
                key={t.id}
                label={t.name}
                color={t.color || undefined}
                onRemove={() => handleRemoveTag(t.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>No tags yet</Text>
        )}
      </View>

      {/* Cover Image */}
      {coverAsset ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cover Image</Text>
          <TouchableOpacity
            onPress={() => {
              const idx = imageAssets.findIndex(
                (a: any) => a.id === coverAsset.id
              );
              setViewerIndex(idx >= 0 ? idx : 0);
              setViewerOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: resolveThumbnailUrl(coverAsset) }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <Text style={styles.assetCaption}>
            {coverAsset.original_filename}
          </Text>
        </View>
      ) : imageAssets.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cover Image</Text>
          <TouchableOpacity
            onPress={() => {
              setViewerIndex(0);
              setViewerOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: resolveThumbnailUrl(imageAssets[0]) }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <Text style={styles.assetCaption}>
            {imageAssets[0].original_filename}
          </Text>
        </View>
      ) : null}

      {/* Image Gallery */}
      {imageAssets.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Image Gallery</Text>
          {DISPLAY_ASSET_TYPES.filter(
            (t) =>
              IMAGE_ASSET_TYPES.includes(t) &&
              groupedAssets[t] &&
              groupedAssets[t].length > 0
          ).map((type) => (
            <View key={type} style={styles.galleryGroup}>
              <Text style={styles.galleryGroupTitle}>
                {ASSET_TYPE_LABELS[type] || type}
              </Text>
              <View style={styles.thumbnailGrid}>
                {groupedAssets[type].map((asset: any) => (
                  <TouchableOpacity
                    key={asset.id}
                    style={styles.thumbnailWrapper}
                    onPress={() => {
                      const idx = imageAssets.findIndex(
                        (a: any) => a.id === asset.id
                      );
                      setViewerIndex(idx >= 0 ? idx : 0);
                      setViewerOpen(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: resolveThumbnailUrl(asset) }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Links summary */}
      {links.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Recent Links ({links.length})
          </Text>
          {links.slice(0, 5).map((link: any) => (
            <View key={link.id} style={styles.summaryItem}>
              <Text style={styles.summaryTitle} numberOfLines={1}>
                {link.title}
              </Text>
              <Text style={styles.summaryMeta}>
                {link.category.replace(/_/g, " ")} &middot;{" "}
                {String(link.url).substring(0, 50)}
                {String(link.url).length > 50 ? "..." : ""}
              </Text>
            </View>
          ))}
          {links.length > 5 ? (
            <TouchableOpacity
              onPress={() => setTab("links")}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllLink}>
                See all {links.length} links
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Timeline summary */}
      {timeline.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Recent Timeline ({timeline.length})
          </Text>
          {timeline.slice(0, 5).map((entry: any) => (
            <View key={entry.id} style={styles.timelineSummaryItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineSummaryContent}>
                <Text style={styles.summaryTitle}>
                  {(entry.status || "")
                    .replace("BuildStatus.", "")
                    .replace(/_/g, " ")}
                </Text>
                <Text style={styles.summaryMeta}>
                  {formatDate(entry.created_at)}
                </Text>
                {entry.notes ? (
                  <Text style={styles.summaryNotes} numberOfLines={2}>
                    {entry.notes}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {timeline.length > 5 ? (
            <TouchableOpacity
              onPress={() => setTab("timeline")}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllLink}>
                See all {timeline.length} entries
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );

  // --- Assets tab ---

  const renderAssetsTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentInner}
      showsVerticalScrollIndicator={false}
    >
      {/* Import from Immich */}
      <TouchableOpacity
        style={styles.immichImportButton}
        onPress={() => setImmichPickerOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.immichImportText}>Import from Immich</Text>
      </TouchableOpacity>

      {assets.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No assets yet. Upload images, videos, or documents to this kit.
          </Text>
        </View>
      ) : (
        DISPLAY_ASSET_TYPES.map((type) => {
          const items = groupedAssets[type] || [];
          if (items.length === 0) return null;

          return (
            <View key={type} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {ASSET_TYPE_LABELS[type] || type} ({items.length})
                </Text>
                <Text style={styles.comingSoon}>Add files: coming soon</Text>
              </View>
              <View style={styles.thumbnailGrid}>
                {items.map((asset: any) => (
                  <View key={asset.id} style={styles.assetCard}>
                    {IMAGE_ASSET_TYPES.includes(type) ? (
                      <TouchableOpacity
                        onPress={() => {
                          const idx = imageAssets.findIndex(
                            (a: any) => a.id === asset.id
                          );
                          setViewerIndex(idx >= 0 ? idx : 0);
                          setViewerOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: resolveThumbnailUrl(asset) }}
                          style={styles.assetThumbnail}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.filePlaceholder}>
                        <Text style={styles.filePlaceholderText}>
                          {type === "VIDEO" ? "▶" : "📄"}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={styles.assetCaption}
                      numberOfLines={1}
                    >
                      {asset.original_filename}
                    </Text>
                    <View style={styles.assetActions}>
                      {type !== "VIDEO" && type !== "DOCUMENT" ? (
                        <TouchableOpacity
                          onPress={() => handleSetCover(asset.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.assetActionText}>
                            {kit.thumbnail_asset_id === asset.id
                              ? "Cover"
                              : "Set as cover"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => handleDeleteAsset(asset.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteAssetText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // --- Links tab ---

  const renderLinksTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentInner}
      showsVerticalScrollIndicator={false}
    >
      {/* Add link form */}
      {showAddLink ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add Link</Text>
            <TouchableOpacity
              onPress={() => setShowAddLink(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.editLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {linkError ? <ErrorBanner message={linkError} /> : null}
          <Input
            label="URL"
            value={linkForm.url}
            onChangeText={(v) => setLinkForm({ ...linkForm, url: v })}
            placeholder="https://..."
            required
          />
          <Text style={styles.fieldHint}>Category</Text>
          <ChipSelector
            options={LINK_CATEGORIES}
            value={linkForm.category}
            onChange={(v) => setLinkForm({ ...linkForm, category: v })}
          />
          <Input
            label="Title"
            value={linkForm.title}
            onChangeText={(v) => setLinkForm({ ...linkForm, title: v })}
            placeholder="Link title"
            required
          />
          <Input
            label="Notes"
            value={linkForm.notes}
            onChangeText={(v) => setLinkForm({ ...linkForm, notes: v })}
            placeholder="Optional notes"
            multiline
          />
          <View style={styles.editActions}>
            <Button
              title="Add Link"
              onPress={handleAddLink}
              loading={linkAdding}
              disabled={!linkForm.url.trim() || !linkForm.title.trim()}
            />
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Button title="+ Add Link" onPress={() => setShowAddLink(true)} />
        </View>
      )}

      {/* Link list */}
      {links.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No links yet. Add reference links, build logs, reviews, or
            tutorials.
          </Text>
        </View>
      ) : (
        links.map((link: any) => (
          <View key={link.id} style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={styles.listCardBody}>
                <Text style={styles.listCardTitle}>{link.title}</Text>
                <Text style={styles.listCardMeta}>
                  {(link.category || "")
                    .replace(/_/g, " ")
                    .replace("BUILD LOG", "Build Log")}{" "}
                  &middot;{" "}
                  {String(link.url).substring(0, 60)}
                  {String(link.url).length > 60 ? "..." : ""}
                </Text>
                {link.notes ? (
                  <Text style={styles.listCardNotes} numberOfLines={2}>
                    {link.notes}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteLink(link.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteAssetText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  // --- Timeline tab ---

  const renderTimelineTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentInner}
      showsVerticalScrollIndicator={false}
    >
      {/* Add timeline form */}
      {showAddTimeline ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add Entry</Text>
            <TouchableOpacity
              onPress={() => setShowAddTimeline(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.editLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {timelineError ? <ErrorBanner message={timelineError} /> : null}
          <Text style={styles.fieldHint}>Status</Text>
          <ChipSelector
            options={BUILD_STATUS}
            value={timelineForm.status}
            onChange={(v) =>
              setTimelineForm({ ...timelineForm, status: v })
            }
          />
          <Input
            label="Notes"
            value={timelineForm.notes}
            onChangeText={(v) =>
              setTimelineForm({ ...timelineForm, notes: v })
            }
            placeholder="What did you do?"
            multiline
          />
          <View style={styles.editActions}>
            <Button
              title="Add Entry"
              onPress={handleAddTimeline}
              loading={timelineAdding}
            />
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Button
            title="+ Add Entry"
            onPress={() => setShowAddTimeline(true)}
          />
        </View>
      )}

      {/* Timeline list */}
      {timeline.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No timeline entries yet. Track your build progress here.
          </Text>
        </View>
      ) : (
        <View style={styles.timelineContainer}>
          {timeline.map((entry: any, index: number) => (
            <View key={entry.id} style={styles.timelineItem}>
              <View style={styles.timelineLine}>
                <View
                  style={[
                    styles.timelineDot,
                    index === 0 && styles.timelineDotFirst,
                  ]}
                />
                {index < timeline.length - 1 ? (
                  <View style={styles.timelineBar} />
                ) : null}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>
                  {(entry.status || "")
                    .replace("BuildStatus.", "")
                    .replace(/_/g, " ")}
                </Text>
                <Text style={styles.timelineDate}>
                  {formatDate(entry.created_at)}
                </Text>
                {entry.notes ? (
                  <Text style={styles.timelineNotes}>{entry.notes}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      {/* Kit header */}
      <View style={styles.kitHeader}>
        <Text style={styles.kitName} numberOfLines={2}>
          {kit.name}
        </Text>
        <Text style={styles.kitSubtitle}>
          {kit.grade} &middot; {kit.series} &middot;{" "}
          {(kit.build_status || "")
            .replace("BuildStatus.", "")
            .replace(/_/g, " ")}
        </Text>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Tab content */}
      {tab === "overview" && renderOverview()}
      {tab === "assets" && renderAssetsTab()}
      {tab === "links" && renderLinksTab()}
      {tab === "timeline" && renderTimelineTab()}

      {/* Image Viewer */}
      {viewerOpen ? (
        <ImageViewer
          images={imageAssets}
          currentIndex={viewerIndex}
          coverId={coverAsset?.id ?? null}
          onClose={() => setViewerOpen(false)}
          onSetCover={handleSetCover}
          onNavigate={setViewerIndex}
        />
      ) : null}

      {/* Immich Picker */}
      <ImmichPicker
        visible={immichPickerOpen}
        onClose={() => setImmichPickerOpen(false)}
        onConfirm={handleImmichConfirm}
      />
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
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  } as ViewStyle,
  loadingText: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 12,
  } as TextStyle,
  retryBtn: {
    marginTop: 12,
  } as ViewStyle,
  retryText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: "600",
  } as TextStyle,

  // Kit header
  kitHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  } as ViewStyle,
  kitName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  } as TextStyle,
  kitSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  } as TextStyle,

  // Tabs
  tabsRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginTop: 12,
  } as ViewStyle,
  tabsInner: {
    paddingHorizontal: 20,
    gap: 6,
    paddingBottom: 10,
  } as ViewStyle,
  tabPill: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "transparent",
  } as ViewStyle,
  tabPillActive: {
    backgroundColor: "#2a2f34",
    borderColor: "#2a2f34",
  } as ViewStyle,
  tabPillText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  } as TextStyle,
  tabPillTextActive: {
    color: "#ffffff",
  } as TextStyle,

  // Tab content
  tabContent: {
    flex: 1,
  } as ViewStyle,
  tabContentInner: {
    padding: 20,
    paddingBottom: 60,
  } as ViewStyle,

  // Section
  section: {
    marginBottom: 24,
  } as ViewStyle,
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 10,
  } as TextStyle,
  editLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  } as TextStyle,
  comingSoon: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
  } as TextStyle,

  // Profile
  profileList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  } as ViewStyle,
  profileRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  } as ViewStyle,
  profileLabel: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
    width: 110,
  } as TextStyle,
  profileValue: {
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  } as TextStyle,

  // Edit form
  editForm: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  } as ViewStyle,
  formSectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 12,
  } as TextStyle,
  formErrorWrap: {
    marginBottom: 12,
  } as ViewStyle,
  fieldHint: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
    marginBottom: 4,
    marginTop: 8,
  } as TextStyle,
  chipSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  } as ViewStyle,
  editActions: {
    marginTop: 16,
    gap: 10,
  } as ViewStyle,

  // Tags
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  addTagForm: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 12,
  } as ViewStyle,
  addTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  } as ViewStyle,
  addTagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  } as TextStyle,
  colorPresetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  } as ViewStyle,
  colorPreset: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  } as ViewStyle,
  colorPresetActive: {
    borderColor: colors.ink,
    borderWidth: 3,
  } as ViewStyle,
  emptyHint: {
    fontSize: 14,
    color: colors.muted,
    fontStyle: "italic",
  } as TextStyle,

  // Cover image
  coverImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#ece3d7",
  } as ImageStyle,
  assetCaption: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
  } as TextStyle,

  // Gallery
  galleryGroup: {
    marginBottom: 16,
  } as ViewStyle,
  galleryGroupTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  } as TextStyle,
  thumbnailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  thumbnailWrapper: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ece3d7",
  } as ViewStyle,
  thumbnail: {
    width: "100%",
    height: "100%",
  } as ImageStyle,

  // Asset card (in assets tab)
  assetCard: {
    width: "48%",
    marginBottom: 12,
  } as ViewStyle,
  assetThumbnail: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    backgroundColor: "#ece3d7",
  } as ImageStyle,
  filePlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    backgroundColor: "#e8e4dc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  } as ViewStyle,
  filePlaceholderText: {
    fontSize: 28,
    color: colors.muted,
  } as TextStyle,
  assetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  } as ViewStyle,
  assetActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  } as TextStyle,
  deleteAssetText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  } as TextStyle,

  // Summary items (links & timeline)
  summaryItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  } as ViewStyle,
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  } as TextStyle,
  summaryMeta: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  } as TextStyle,
  summaryNotes: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 18,
  } as TextStyle,
  seeAllLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
    marginTop: 10,
  } as TextStyle,

  // List cards (links tab)
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
  } as ViewStyle,
  listCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  } as ViewStyle,
  listCardBody: {
    flex: 1,
    marginRight: 12,
  } as ViewStyle,
  listCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  } as TextStyle,
  listCardMeta: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  } as TextStyle,
  listCardNotes: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 18,
  } as TextStyle,

  // Timeline
  timelineContainer: {
    paddingLeft: 4,
  } as ViewStyle,
  timelineItem: {
    flexDirection: "row",
    marginBottom: 0,
  } as ViewStyle,
  timelineLine: {
    width: 24,
    alignItems: "center",
  } as ViewStyle,
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.line,
    marginTop: 4,
  } as ViewStyle,
  timelineDotFirst: {
    backgroundColor: colors.accent,
  } as ViewStyle,
  timelineBar: {
    width: 2,
    flex: 1,
    backgroundColor: colors.line,
    marginTop: -2,
  } as ViewStyle,
  timelineContent: {
    flex: 1,
    paddingBottom: 18,
    paddingLeft: 8,
  } as ViewStyle,
  timelineStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  } as TextStyle,
  timelineDate: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  } as TextStyle,
  timelineNotes: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 18,
  } as TextStyle,

  // Timeline summary (overview)
  timelineSummaryItem: {
    flexDirection: "row",
    paddingVertical: 6,
  } as ViewStyle,
  timelineSummaryContent: {
    flex: 1,
    marginLeft: 12,
  } as ViewStyle,

  // Empty
  emptyBox: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
  } as ViewStyle,
  emptyText: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  } as TextStyle,

  // Immich import button
  immichImportButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "rgba(197,103,42,0.05)",
  } as ViewStyle,
  immichImportText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent,
  } as TextStyle,

  // Image modal (legacy - kept for reference, replaced by ImageViewer)
  modalSafe: {
    flex: 1,
    backgroundColor: "#000000",
  } as ViewStyle,
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "flex-end",
  } as ViewStyle,
  modalClose: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,
  modalImage: {
    flex: 1,
    width: "100%",
  } as ImageStyle,
});
