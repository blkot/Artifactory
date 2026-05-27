import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Alert,
  AppState,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  api,
  API_BASE_URL,
  authenticatedImageSource,
} from "../../../lib/api/client";
import { GRADES, BUILD_STATUS, LINK_CATEGORIES } from "../../../lib/constants";
import { buildKitEditForm, toUserMessage } from "../../../lib/utils";
import { normalizeLinkUrl, parseSharedLink } from "../../../lib/linkParser";
import Button from "../../../components/ui/Button";
import Tag from "../../../components/ui/Tag";
import Input from "../../../components/ui/Input";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import ImageViewer from "../../../components/ImageViewer";
import ImmichPicker from "../../../components/ImmichPicker";
import {
  LOCAL_IMAGE_ASSET_TYPES,
  takeAssetPhoto,
} from "../../../lib/assetUpload";
import {
  createCachedLocalAsset,
  deleteCachedLocalAssetFiles,
} from "../../../lib/imageCache";
import {
  deleteLocalAsset,
  enqueueUploadJob,
  initLocalAssetStore,
  insertLocalAsset,
  listLocalAssetsForKit,
  listRemoteAssetCachesForAssetIds,
  requeueUploadJob,
  updateLocalAssetSync,
  type LocalAsset,
  type RemoteAssetCache,
} from "../../../lib/localAssetStore";
import { checkBackendReady, type BackendStatus } from "../../../lib/serviceStatus";
import { prepareSyncQueue, syncPendingAssets } from "../../../lib/syncQueue";

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

function imageSourceForUri(uri: string) {
  return uri?.startsWith("file://")
    ? { uri }
    : authenticatedImageSource(uri);
}

function linkThumbnailSource(link: any) {
  if (link.thumbnailUri?.startsWith("file://")) return { uri: link.thumbnailUri };
  if (link.thumbnail_url || link.thumbnail_path) {
    return authenticatedImageSource(api.linkThumbnailUrl(link.id));
  }
  return null;
}

function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  if (source === "bilibili") return "Bilibili";
  if (source === "xiaohongshu") return "Xiaohongshu";
  if (source === "generic") return null;
  return source;
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

function localAssetToDisplayAsset(asset: LocalAsset) {
  return {
    id: `local:${asset.localId}`,
    localId: asset.localId,
    kit_id: asset.kitId,
    type: asset.type,
    original_filename: asset.originalFilename,
    mime_type: asset.mimeType,
    description: asset.description,
    isLocalAsset: true,
    originalLocalUri: asset.originalLocalUri,
    displayLocalUri: asset.displayLocalUri,
    thumbnailLocalUri: asset.thumbnailLocalUri,
    syncStatus: asset.syncStatus,
    remoteAssetId: asset.remoteAssetId,
    setAsCover: asset.setAsCover,
    created_at: asset.createdAt,
    lastAttemptAt: asset.lastAttemptAt,
    error: asset.error,
  };
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
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
  const { id, tab: requestedTab } = useLocalSearchParams<{
    id: string;
    tab?: string;
  }>();
  const kitId = Number(id);

  // Data
  const [kit, setKit] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [localAssets, setLocalAssets] = useState<LocalAsset[]>([]);
  const [remoteAssetCaches, setRemoteAssetCaches] = useState<RemoteAssetCache[]>(
    []
  );
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("unknown");
  const [links, setLinks] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tab, setTab] = useState(
    ["overview", "assets", "links", "timeline"].includes(String(requestedTab))
      ? String(requestedTab)
      : "overview"
  );
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
  const [rawLinkText, setRawLinkText] = useState("");
  const [linkForm, setLinkForm] = useState({
    url: "",
    category: "REVIEW" as string,
    title: "",
    notes: "",
    source: null as string | null,
    thumbnailUri: null as string | null,
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
  const [photoDraft, setPhotoDraft] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [assetUploadType, setAssetUploadType] = useState("BUILD_PHOTO");
  const [assetUploadDescription, setAssetUploadDescription] = useState("");
  const [assetSetCover, setAssetSetCover] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const syncRequestedRef = useRef(false);

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

  const refreshLocalAssets = useCallback(async () => {
    await initLocalAssetStore();
    setLocalAssets(await listLocalAssetsForKit(kitId));
  }, [kitId]);

  const refreshRemoteAssetCaches = useCallback(async () => {
    await initLocalAssetStore();
    const ids = assets
      .map((asset) => Number(asset.id))
      .filter((id) => Number.isFinite(id));
    setRemoteAssetCaches(await listRemoteAssetCachesForAssetIds(ids));
  }, [assets]);

  useEffect(() => {
    refreshRemoteAssetCaches();
  }, [refreshRemoteAssetCaches]);

  const runForegroundSync = useCallback(async () => {
    if (syncRequestedRef.current) return;
    syncRequestedRef.current = true;
    setSyncInProgress(true);
    try {
      await initLocalAssetStore();
      await prepareSyncQueue();
      await refreshLocalAssets();
      const status = await checkBackendReady();
      setBackendStatus(status);
      if (status === "online") {
        await syncPendingAssets({ onAssetUpdated: refreshLocalAssets });
        await refreshLocalAssets();
        await loadData();
      }
    } finally {
      setSyncInProgress(false);
      syncRequestedRef.current = false;
    }
  }, [loadData, refreshLocalAssets]);

  useEffect(() => {
    runForegroundSync();
  }, [runForegroundSync]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runForegroundSync();
      }
    });
    return () => sub.remove();
  }, [runForegroundSync]);

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

  const confirmDeleteAsset = (asset: any) => {
    Alert.alert(
      "Delete asset?",
      `This will permanently remove ${asset.original_filename || "this asset"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteAsset(asset.id),
        },
      ]
    );
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

  const handleSetViewerCover = async (asset: any) => {
    if (asset?.isLocalAsset && asset.localId) {
      await updateLocalAssetSync(asset.localId, { setAsCover: true });
      await refreshLocalAssets();
      runForegroundSync();
      return;
    }
    if (asset?.id != null) {
      await handleSetCover(asset.id);
    }
  };

  const confirmDeleteLocalAsset = (asset: any) => {
    if (!asset?.isLocalAsset || !asset.localId) return;
    Alert.alert(
      "Remove local asset?",
      "This removes the pending local copy and cancels its upload job.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const local = localAssets.find(
              (item) => item.localId === asset.localId
            );
            if (local) {
              await deleteCachedLocalAssetFiles(local);
            }
            await deleteLocalAsset(asset.localId);
            await refreshLocalAssets();
          },
        },
      ]
    );
  };

  const handleRetryLocalAsset = async (asset: any) => {
    if (!asset?.isLocalAsset || !asset.localId) return;
    await requeueUploadJob(asset.localId);
    await refreshLocalAssets();
    runForegroundSync();
  };

  const resetPhotoDraft = () => {
    setPhotoDraft(null);
    setAssetUploadType("BUILD_PHOTO");
    setAssetUploadDescription("");
    setAssetSetCover(false);
    setAssetUploadError(null);
  };

  const persistLocalImageAsset = async ({
    asset,
    type,
    description,
    setAsCover = false,
  }: {
    asset: ImagePicker.ImagePickerAsset;
    type: string;
    description?: string;
    setAsCover?: boolean;
  }) => {
    setAssetUploading(true);
    setAssetUploadError(null);
    try {
      await initLocalAssetStore();
      const cached = await createCachedLocalAsset({
        kitId,
        type,
        asset,
        description,
        setAsCover,
      });
      await insertLocalAsset(cached);
      await enqueueUploadJob(cached.localId);
      await refreshLocalAssets();
      runForegroundSync();
      return cached;
    } catch (err: any) {
      setAssetUploadError(err?.message || "Failed to save local asset");
      throw err;
    } finally {
      setAssetUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const asset = await takeAssetPhoto();
      if (!asset) return;
      setAssetUploadType("BUILD_PHOTO");
      setAssetUploadDescription("");
      setAssetSetCover(!kit.thumbnail_asset_id && displayAssets.length === 0);
      setAssetUploadError(null);
      setPhotoDraft(asset);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to take photo");
    }
  };

  const handleChoosePhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (result.canceled) return;

      for (const asset of result.assets) {
        await persistLocalImageAsset({
          asset,
          type: "BUILD_PHOTO",
        });
      }
    } catch (err: any) {
      setAssetUploadError(err?.message || "Failed to upload selected photos");
    }
  };

  const handleSavePhotoDraft = async () => {
    if (!photoDraft) return;
    try {
      await persistLocalImageAsset({
        asset: photoDraft,
        type: assetUploadType,
        description: assetUploadDescription,
        setAsCover: assetSetCover,
      });
      resetPhotoDraft();
    } catch (err: any) {
      setAssetUploadError(err?.message || "Failed to save photo");
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
    const normalizedUrl = normalizeLinkUrl(linkForm.url);
    const duplicate = links.find(
      (link) => normalizeLinkUrl(String(link.url)) === normalizedUrl
    );
    if (duplicate) {
      if (
        linkForm.thumbnailUri?.startsWith("file://") &&
        duplicate.id &&
        !duplicate.thumbnail_url &&
        !duplicate.thumbnail_path
      ) {
        setLinkAdding(true);
        setLinkError(null);
        try {
          const formData = new FormData();
          formData.append("file", {
            uri: linkForm.thumbnailUri,
            name:
              linkForm.thumbnailUri.split("/").pop()?.split("?")[0] ||
              "link-thumbnail.jpg",
            type: linkForm.thumbnailUri.toLowerCase().includes(".png")
              ? "image/png"
              : "image/jpeg",
          } as any);
          const updatedLink = await api.uploadLinkThumbnail(duplicate.id, formData);
          setLinks((prev) =>
            prev.map((link) => (link.id === duplicate.id ? updatedLink : link))
          );
          setLinkForm({
            url: "",
            category: "REVIEW",
            title: "",
            notes: "",
            source: null,
            thumbnailUri: null,
          });
          setRawLinkText("");
          setShowAddLink(false);
        } catch (err: any) {
          setLinkError(toUserMessage(err));
        } finally {
          setLinkAdding(false);
        }
        return;
      }
      setLinkError("This kit already has that link.");
      return;
    }

    setLinkAdding(true);
    setLinkError(null);

    try {
      const newLink = await api.createLink({
        kit_id: kitId,
        url: linkForm.url.trim(),
        category: linkForm.category,
        title: linkForm.title.trim(),
        notes: linkForm.notes.trim() || null,
        source: linkForm.source,
        tag_ids: [],
      });
      let savedLink = newLink;
      let thumbnailUploadFailed = false;
      if (linkForm.thumbnailUri?.startsWith("file://") && newLink?.id) {
        try {
          const formData = new FormData();
          formData.append("file", {
            uri: linkForm.thumbnailUri,
            name:
              linkForm.thumbnailUri.split("/").pop()?.split("?")[0] ||
              "link-thumbnail.jpg",
            type: linkForm.thumbnailUri.toLowerCase().includes(".png")
              ? "image/png"
              : "image/jpeg",
          } as any);
          savedLink = await api.uploadLinkThumbnail(newLink.id, formData);
        } catch {
          thumbnailUploadFailed = true;
        }
      }

      setLinks((prev) => [...prev, savedLink]);
      setLinkForm({
        url: "",
        category: "REVIEW",
        title: "",
        notes: "",
        source: null,
        thumbnailUri: null,
      });
      setRawLinkText("");
      setShowAddLink(false);
      if (thumbnailUploadFailed) {
        Alert.alert("Link saved", "The shared thumbnail could not be uploaded.");
      }
    } catch (err: any) {
      setLinkError(toUserMessage(err));
    } finally {
      setLinkAdding(false);
    }
  };

  const handleRawLinkTextChange = (value: string) => {
    setRawLinkText(value);
    const parsed = parseSharedLink(value);
    if (!parsed) return;
    setLinkForm((prev) => ({
      ...prev,
      url: parsed.url,
      title: parsed.title,
      category: parsed.category,
      notes: prev.notes || parsed.notes,
      source: parsed.source,
      thumbnailUri: parsed.thumbnailUri ?? null,
    }));
  };

  const handleDeleteLink = async (linkId: number) => {
    try {
      await api.deleteLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {
      // Best-effort
    }
  };

  const confirmDeleteLink = (link: any) => {
    Alert.alert(
      "Delete link?",
      `This will permanently remove ${link.title || "this link"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteLink(link.id),
        },
      ]
    );
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

  const displayAssets = useMemo(() => {
    const localByRemoteId = new Map(
      localAssets
        .filter((asset) => asset.remoteAssetId)
        .map((asset) => [asset.remoteAssetId, asset])
    );
    const cacheByRemoteId = new Map(
      remoteAssetCaches.map((cache) => [cache.remoteAssetId, cache])
    );
    const enrichedRemoteAssets = assets.map((asset) => {
      const local = localByRemoteId.get(asset.id);
      const cache = cacheByRemoteId.get(asset.id);
      return {
        ...asset,
        displayLocalUri: local?.displayLocalUri ?? cache?.displayLocalUri,
        thumbnailLocalUri: local?.thumbnailLocalUri ?? cache?.thumbnailLocalUri,
      };
    });
    const remoteIds = new Set(enrichedRemoteAssets.map((asset) => asset.id));
    const localDisplayAssets = localAssets
      .filter(
        (asset) =>
          asset.syncStatus !== "synced" ||
          !asset.remoteAssetId ||
          !remoteIds.has(asset.remoteAssetId)
      )
      .map(localAssetToDisplayAsset);
    return [...localDisplayAssets, ...enrichedRemoteAssets];
  }, [assets, localAssets, remoteAssetCaches]);
  const groupedAssets = groupAssetsByType(displayAssets);
  const localCoverAsset = displayAssets.find(
    (asset) => asset.isLocalAsset && asset.setAsCover && asset.syncStatus !== "synced"
  );
  const coverAsset =
    localCoverAsset ?? displayAssets.find((a) => a.id === kit?.thumbnail_asset_id);
  const imageAssets = displayAssets.filter((a) =>
    IMAGE_ASSET_TYPES.includes(a.type)
  );
  const coverId = coverAsset?.isLocalAsset ? coverAsset.localId : coverAsset?.id ?? null;
  const syncSummary = useMemo(() => {
    const pending = localAssets.filter((asset) =>
      ["local", "queued"].includes(asset.syncStatus)
    ).length;
    const uploading = localAssets.filter(
      (asset) => asset.syncStatus === "uploading"
    ).length;
    const failed = localAssets.filter(
      (asset) => asset.syncStatus === "failed"
    ).length;
    const synced = localAssets.filter(
      (asset) => asset.syncStatus === "synced"
    ).length;
    const remoteCacheBytes = remoteAssetCaches.reduce(
      (total, cache) => total + cache.byteSize,
      0
    );
    return {
      pending,
      uploading,
      failed,
      synced,
      cached: remoteAssetCaches.length,
      cacheSize: formatBytes(remoteCacheBytes),
    };
  }, [localAssets, remoteAssetCaches]);

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
              source={imageSourceForUri(resolveThumbnailUrl(coverAsset))}
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
              source={imageSourceForUri(resolveThumbnailUrl(imageAssets[0]))}
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
                      source={imageSourceForUri(resolveThumbnailUrl(asset))}
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
          {links.slice(0, 5).map((link: any) => {
            const thumbnail = linkThumbnailSource(link);
            const label = sourceLabel(link.source);
            return (
              <View key={link.id} style={styles.summaryItem}>
                {thumbnail ? (
                  <Image source={thumbnail} style={styles.summaryLinkThumbnail} />
                ) : null}
                <View style={styles.summaryText}>
                  {label ? (
                    <Text style={styles.summarySourceBadge}>{label}</Text>
                  ) : null}
                  <Text style={styles.summaryTitle} numberOfLines={1}>
                    {link.title}
                  </Text>
                  <Text style={styles.summaryMeta}>
                    {link.category.replace(/_/g, " ")} &middot;{" "}
                    {String(link.url).substring(0, 50)}
                    {String(link.url).length > 50 ? "..." : ""}
                  </Text>
                </View>
              </View>
            );
          })}
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
      <View style={styles.assetImportPanel}>
        {assetUploadError ? <ErrorBanner message={assetUploadError} /> : null}
        <View style={styles.serviceStatusRow}>
          <Text style={styles.serviceStatusText}>
            Backend: {backendStatus === "online" ? "Online" : backendStatus === "offline" ? "Offline" : "Checking"}
          </Text>
          <TouchableOpacity
            onPress={runForegroundSync}
            activeOpacity={0.7}
            disabled={syncInProgress}
          >
            <Text style={styles.serviceStatusAction}>
              {syncInProgress ? "Syncing..." : "Retry sync"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.syncSummaryGrid}>
          <View style={styles.syncSummaryItem}>
            <Text style={styles.syncSummaryValue}>{syncSummary.pending}</Text>
            <Text style={styles.syncSummaryLabel}>Pending</Text>
          </View>
          <View style={styles.syncSummaryItem}>
            <Text style={styles.syncSummaryValue}>{syncSummary.uploading}</Text>
            <Text style={styles.syncSummaryLabel}>Syncing</Text>
          </View>
          <View
            style={[
              styles.syncSummaryItem,
              syncSummary.failed > 0 && styles.syncSummaryItemWarning,
            ]}
          >
            <Text
              style={[
                styles.syncSummaryValue,
                syncSummary.failed > 0 && styles.syncSummaryValueWarning,
              ]}
            >
              {syncSummary.failed}
            </Text>
            <Text style={styles.syncSummaryLabel}>Failed</Text>
          </View>
          <View style={styles.syncSummaryItem}>
            <Text style={styles.syncSummaryValue}>{syncSummary.cacheSize}</Text>
            <Text style={styles.syncSummaryLabel}>
              Cache ({syncSummary.cached})
            </Text>
          </View>
        </View>
        <View style={styles.assetImportRow}>
          <TouchableOpacity
            style={[styles.assetImportButton, styles.assetImportButtonPrimary]}
            onPress={handleTakePhoto}
            activeOpacity={0.7}
            disabled={assetUploading}
          >
            <Text style={styles.assetImportButtonPrimaryText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.assetImportButton}
            onPress={handleChoosePhotos}
            activeOpacity={0.7}
            disabled={assetUploading}
          >
            <Text style={styles.assetImportButtonText}>
              {assetUploading ? "Uploading..." : "Choose Photos"}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.immichImportButton}
          onPress={() => setImmichPickerOpen(true)}
          activeOpacity={0.7}
          disabled={assetUploading}
        >
          <Text style={styles.immichImportText}>Import from Immich</Text>
        </TouchableOpacity>
      </View>

      {displayAssets.length === 0 ? (
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
                          source={imageSourceForUri(resolveThumbnailUrl(asset))}
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
                    {coverId === (asset.isLocalAsset ? asset.localId : asset.id) ? (
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    ) : null}
                    {asset.isLocalAsset ? (
                      <>
                        <View style={styles.localAssetActions}>
                          <Text
                            style={[
                              styles.localAssetBadge,
                              asset.syncStatus === "failed" && styles.localAssetBadgeFailed,
                            ]}
                          >
                            {asset.syncStatus === "uploading"
                              ? "Syncing"
                              : asset.syncStatus === "failed"
                                ? "Failed"
                                : "Pending"}
                          </Text>
                          {asset.syncStatus !== "uploading" ? (
                            <>
                              {asset.syncStatus === "failed" ? (
                                <TouchableOpacity
                                  onPress={() => handleRetryLocalAsset(asset)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.localAssetRetryText}>Retry</Text>
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity
                                onPress={() => confirmDeleteLocalAsset(asset)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.localAssetRemoveText}>Remove</Text>
                              </TouchableOpacity>
                            </>
                          ) : null}
                        </View>
                        {asset.error ? (
                          <Text style={styles.localAssetError} numberOfLines={2}>
                            {asset.error}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
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
            label="Shared Text"
            value={rawLinkText}
            onChangeText={handleRawLinkTextChange}
            placeholder="Paste Xiaohongshu/Bilibili share text..."
            multiline
          />
          <Input
            label="URL"
            value={linkForm.url}
            onChangeText={(v) => setLinkForm({ ...linkForm, url: v })}
            placeholder="https://..."
            required
          />
          {linkForm.source || linkForm.thumbnailUri ? (
            <View style={styles.linkSourcePreview}>
              {linkForm.thumbnailUri ? (
                <Image
                  source={{ uri: linkForm.thumbnailUri }}
                  style={styles.linkThumbnailPreview}
                />
              ) : null}
              {sourceLabel(linkForm.source) ? (
                <Text style={styles.linkSourceBadge}>
                  {sourceLabel(linkForm.source)}
                </Text>
              ) : null}
            </View>
          ) : null}
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
        links.map((link: any) => {
          const thumbnail = linkThumbnailSource(link);
          const label = sourceLabel(link.source);
          return (
          <View key={link.id} style={styles.listCard}>
            <View style={styles.listCardHeader}>
              {thumbnail ? (
                <Image source={thumbnail} style={styles.linkThumbnail} />
              ) : null}
              <View style={styles.listCardBody}>
                {label ? (
                  <Text style={styles.linkSourceBadge}>{label}</Text>
                ) : null}
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
              <View style={styles.linkActions}>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/links/webview",
                      params: {
                        url: String(link.url),
                        title: String(link.title || "Link"),
                      },
                    })
                  }
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.assetActionText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDeleteLink(link)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteAssetText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          );
        })
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
        <TouchableOpacity
          style={styles.backToKitsButton}
          onPress={() => router.replace("/(tabs)/kits")}
          activeOpacity={0.7}
        >
          <Text style={styles.backToKitsText}>{"‹ Kits"}</Text>
        </TouchableOpacity>
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
          coverId={coverId}
          onClose={() => setViewerOpen(false)}
          onSetCover={handleSetViewerCover}
          onNavigate={setViewerIndex}
          onAssetCached={refreshRemoteAssetCaches}
        />
      ) : null}

      <Modal
        visible={!!photoDraft}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetPhotoDraft}
      >
        <SafeAreaView style={styles.captureModalSafe}>
          <ScrollView
            style={styles.captureModalScroll}
            contentContainerStyle={styles.captureModalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.captureModalHeader}>
              <Text style={styles.captureModalTitle}>Save Photo</Text>
              <TouchableOpacity
                onPress={resetPhotoDraft}
                activeOpacity={0.7}
                disabled={assetUploading}
              >
                <Text style={styles.editLink}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {assetUploadError ? <ErrorBanner message={assetUploadError} /> : null}

            {photoDraft ? (
              <Image
                source={{ uri: photoDraft.uri }}
                style={styles.capturePreview}
                resizeMode="cover"
              />
            ) : null}

            <Text style={styles.fieldHint}>Asset Type</Text>
            <View style={styles.captureTypeGrid}>
              {LOCAL_IMAGE_ASSET_TYPES.map((type) => {
                const active = assetUploadType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.captureTypeChip,
                      active && styles.captureTypeChipActive,
                    ]}
                    onPress={() => setAssetUploadType(type)}
                    activeOpacity={0.7}
                    disabled={assetUploading}
                  >
                    <Text
                      style={[
                        styles.captureTypeChipText,
                        active && styles.captureTypeChipTextActive,
                      ]}
                    >
                      {ASSET_TYPE_LABELS[type] || type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldHint}>Description</Text>
            <TextInput
              style={[styles.inlineInput, styles.captureDescriptionInput]}
              value={assetUploadDescription}
              onChangeText={setAssetUploadDescription}
              placeholder="Optional note for this photo"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              editable={!assetUploading}
            />

            <TouchableOpacity
              style={[
                styles.captureCoverToggle,
                assetSetCover && styles.captureCoverToggleActive,
              ]}
              onPress={() => setAssetSetCover((prev) => !prev)}
              activeOpacity={0.7}
              disabled={assetUploading}
            >
              <View
                style={[
                  styles.captureCoverMark,
                  assetSetCover && styles.captureCoverMarkActive,
                ]}
              />
              <Text style={styles.captureCoverText}>Set as kit cover</Text>
            </TouchableOpacity>

            <View style={styles.captureActions}>
              <Button
                title="Retake"
                variant="ghost"
                onPress={async () => {
                  const asset = await takeAssetPhoto();
                  if (asset) setPhotoDraft(asset);
                }}
                disabled={assetUploading}
              />
              <Button
                title="Save Photo"
                onPress={handleSavePhotoDraft}
                loading={assetUploading}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
  backToKitsButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
    marginBottom: 4,
  } as ViewStyle,
  backToKitsText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  } as TextStyle,
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
  inlineInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
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
  coverBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    marginTop: 3,
  } as TextStyle,
  localAssetBadge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "700",
    color: "#2a5c8d",
    backgroundColor: "#e4eef8",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
    overflow: "hidden",
  } as TextStyle,
  localAssetBadgeFailed: {
    color: colors.danger,
    backgroundColor: "#ffe7e7",
  } as TextStyle,
  localAssetActions: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  } as ViewStyle,
  localAssetRemoveText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  } as TextStyle,
  localAssetRetryText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  } as TextStyle,
  localAssetError: {
    marginTop: 4,
    fontSize: 11,
    color: colors.danger,
    lineHeight: 15,
  } as TextStyle,
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
  assetImportPanel: {
    marginBottom: 18,
  } as ViewStyle,
  serviceStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  } as ViewStyle,
  serviceStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  } as TextStyle,
  serviceStatusAction: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  } as TextStyle,
  syncSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  } as ViewStyle,
  syncSummaryItem: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 74,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: "#fffdf8",
  } as ViewStyle,
  syncSummaryItemWarning: {
    borderColor: "#e1b7b7",
    backgroundColor: "#fff1f1",
  } as ViewStyle,
  syncSummaryValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  } as TextStyle,
  syncSummaryValueWarning: {
    color: colors.danger,
  } as TextStyle,
  syncSummaryLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  } as TextStyle,
  assetImportRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  } as ViewStyle,
  assetImportButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf8f5",
  } as ViewStyle,
  assetImportButtonPrimary: {
    borderColor: colors.accent,
    backgroundColor: "rgba(197,103,42,0.08)",
  } as ViewStyle,
  assetImportButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  } as TextStyle,
  assetImportButtonPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  } as TextStyle,

  // Summary items (links & timeline)
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  } as ViewStyle,
  summaryText: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  summaryLinkThumbnail: {
    width: 68,
    height: 46,
    borderRadius: 7,
    backgroundColor: "#eee8df",
  } as ImageStyle,
  summarySourceBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(197,103,42,0.12)",
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  } as TextStyle,
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
  linkSourcePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
  } as ViewStyle,
  linkThumbnailPreview: {
    width: 96,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#eee8df",
  } as ImageStyle,
  linkThumbnail: {
    width: 82,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#eee8df",
    marginRight: 12,
  } as ImageStyle,
  linkSourceBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(197,103,42,0.12)",
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 5,
  } as TextStyle,
  listCardBody: {
    flex: 1,
    marginRight: 12,
  } as ViewStyle,
  linkActions: {
    alignItems: "flex-end",
    gap: 10,
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

  // Capture modal
  captureModalSafe: {
    flex: 1,
    backgroundColor: colors.bg,
  } as ViewStyle,
  captureModalScroll: {
    flex: 1,
  } as ViewStyle,
  captureModalContent: {
    padding: 20,
    paddingBottom: 36,
  } as ViewStyle,
  captureModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  } as ViewStyle,
  captureModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
  } as TextStyle,
  capturePreview: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#ece3d7",
    marginBottom: 18,
  } as ImageStyle,
  captureTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  } as ViewStyle,
  captureTypeChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  } as ViewStyle,
  captureTypeChipActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(197,103,42,0.1)",
  } as ViewStyle,
  captureTypeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  } as TextStyle,
  captureTypeChipTextActive: {
    color: colors.accent,
  } as TextStyle,
  captureDescriptionInput: {
    minHeight: 84,
    paddingTop: 12,
    marginBottom: 14,
  } as TextStyle,
  captureCoverToggle: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
  } as ViewStyle,
  captureCoverToggleActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(197,103,42,0.08)",
  } as ViewStyle,
  captureCoverMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  } as ViewStyle,
  captureCoverMarkActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  } as ViewStyle,
  captureCoverText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  } as TextStyle,
  captureActions: {
    flexDirection: "row",
    gap: 10,
  } as ViewStyle,

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
