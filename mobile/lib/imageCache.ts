import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { getAuthHeaders } from "./api/client";
import { IMAGE_CACHE_CONFIG } from "./config";
import {
  deleteRemoteAssetCache,
  getRemoteAssetCacheStats,
  listRemoteAssetCachesByAge,
  upsertRemoteAssetCache,
  type LocalAsset,
} from "./localAssetStore";

const CACHE_ROOT = `${FileSystem.documentDirectory}artifactory-assets/`;
const ORIGINALS_DIR = `${CACHE_ROOT}originals/`;
const DISPLAY_DIR = `${CACHE_ROOT}display/`;
const THUMBS_DIR = `${CACHE_ROOT}thumbs/`;
const TEMP_DIR = `${CACHE_ROOT}tmp/`;

function nowIso() {
  return new Date().toISOString();
}

function localId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function extensionForAsset(asset: ImagePickerAsset) {
  const filenameExtension = asset.fileName?.split(".").pop();
  if (filenameExtension && filenameExtension.length <= 5) {
    return filenameExtension.toLowerCase();
  }
  const mimeExtension = asset.mimeType?.split("/")[1];
  return mimeExtension || "jpg";
}

async function ensureCacheDirs() {
  for (const dir of [CACHE_ROOT, ORIGINALS_DIR, DISPLAY_DIR, THUMBS_DIR, TEMP_DIR]) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
      () => {}
    );
  }
}

function resizeAction(asset: ImagePickerAsset, maxEdge: number) {
  const width = asset.width || 0;
  const height = asset.height || 0;
  if (!width || !height) return { resize: { width: maxEdge } };
  if (Math.max(width, height) <= maxEdge) return null;
  return width >= height
    ? { resize: { width: maxEdge } }
    : { resize: { height: maxEdge } };
}

async function makeDerivative(
  asset: Pick<ImagePickerAsset, "uri" | "width" | "height">,
  maxEdge: number,
  compress: number,
  destination: string
) {
  const action = resizeAction(asset, maxEdge);
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    action ? [action] : [],
    {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  await FileSystem.copyAsync({ from: result.uri, to: destination });
  await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
}

async function fileSize(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === "number" ? info.size : 0;
}

export async function createCachedLocalAsset({
  kitId,
  type,
  asset,
  description,
  setAsCover,
}: {
  kitId: number;
  type: string;
  asset: ImagePickerAsset;
  description?: string;
  setAsCover?: boolean;
}): Promise<LocalAsset> {
  await ensureCacheDirs();
  const id = localId();
  const extension = extensionForAsset(asset);
  const originalUri = `${ORIGINALS_DIR}${id}.${extension}`;
  const displayUri = `${DISPLAY_DIR}${id}.jpg`;
  const thumbnailUri = `${THUMBS_DIR}${id}.jpg`;

  await FileSystem.copyAsync({ from: asset.uri, to: originalUri });
  await makeDerivative(
    asset,
    IMAGE_CACHE_CONFIG.displayMaxEdge,
    IMAGE_CACHE_CONFIG.displayQuality,
    displayUri
  );
  await makeDerivative(
    asset,
    IMAGE_CACHE_CONFIG.thumbnailMaxEdge,
    IMAGE_CACHE_CONFIG.thumbnailQuality,
    thumbnailUri
  );

  const timestamp = nowIso();
  return {
    localId: id,
    kitId,
    type,
    originalFilename: asset.fileName || `${id}.${extension}`,
    originalLocalUri: originalUri,
    displayLocalUri: displayUri,
    thumbnailLocalUri: thumbnailUri,
    mimeType: asset.mimeType || "image/jpeg",
    description: description?.trim() || null,
    setAsCover: Boolean(setAsCover),
    syncStatus: "local",
    remoteAssetId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastAttemptAt: null,
    error: null,
  };
}

export async function deleteCachedLocalAssetFiles(asset: LocalAsset) {
  for (const uri of [
    asset.originalLocalUri,
    asset.displayLocalUri,
    asset.thumbnailLocalUri,
  ]) {
    if (uri) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
}

export async function cacheRemoteAssetDerivatives({
  remoteAssetId,
  sourceUri,
}: {
  remoteAssetId: number;
  sourceUri: string;
}) {
  if (!remoteAssetId || !sourceUri || sourceUri.startsWith("file://")) return;
  await ensureCacheDirs();

  const tempUri = `${TEMP_DIR}remote-${remoteAssetId}-${Date.now()}.jpg`;
  const displayUri = `${DISPLAY_DIR}remote-${remoteAssetId}.jpg`;
  const thumbnailUri = `${THUMBS_DIR}remote-${remoteAssetId}.jpg`;

  try {
    await FileSystem.downloadAsync(sourceUri, tempUri, {
      headers: getAuthHeaders(),
    });
    const source = { uri: tempUri, width: 0, height: 0 };
    await makeDerivative(
      source,
      IMAGE_CACHE_CONFIG.displayMaxEdge,
      IMAGE_CACHE_CONFIG.displayQuality,
      displayUri
    );
    await makeDerivative(
      source,
      IMAGE_CACHE_CONFIG.thumbnailMaxEdge,
      IMAGE_CACHE_CONFIG.thumbnailQuality,
      thumbnailUri
    );
    const byteSize = (await fileSize(displayUri)) + (await fileSize(thumbnailUri));
    await upsertRemoteAssetCache({
      remoteAssetId,
      displayLocalUri: displayUri,
      thumbnailLocalUri: thumbnailUri,
      byteSize,
    });
    await enforceImageCacheLimit();
  } finally {
    await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
  }
}

export async function enforceImageCacheLimit(
  maxBytes = IMAGE_CACHE_CONFIG.maxBytes
) {
  const caches = await listRemoteAssetCachesByAge();
  let total = caches.reduce((sum, cache) => sum + cache.byteSize, 0);
  for (const cache of caches) {
    if (total <= maxBytes) break;
    await FileSystem.deleteAsync(cache.displayLocalUri, { idempotent: true }).catch(
      () => {}
    );
    await FileSystem.deleteAsync(cache.thumbnailLocalUri, {
      idempotent: true,
    }).catch(() => {});
    await deleteRemoteAssetCache(cache.remoteAssetId);
    total -= cache.byteSize;
  }
}

export async function getImageCacheStats() {
  return getRemoteAssetCacheStats();
}

export async function clearRemoteImageCache() {
  const caches = await listRemoteAssetCachesByAge();
  for (const cache of caches) {
    await FileSystem.deleteAsync(cache.displayLocalUri, { idempotent: true }).catch(
      () => {}
    );
    await FileSystem.deleteAsync(cache.thumbnailLocalUri, {
      idempotent: true,
    }).catch(() => {});
    await deleteRemoteAssetCache(cache.remoteAssetId);
  }
  return caches.length;
}
