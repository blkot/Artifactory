import { api } from "./api/client";
import { SYNC_MAX_JOBS_PER_RUN } from "./config";
import {
  listSyncableJobs,
  markJobDone,
  markJobFailed,
  markJobUploading,
  resetStaleUploadingJobs,
  type LocalAsset,
} from "./localAssetStore";

let syncRunning = false;

function formDataForLocalAsset(asset: LocalAsset) {
  const formData = new FormData();
  formData.append("kit_id", String(asset.kitId));
  formData.append("type", asset.type);
  if (asset.description?.trim()) {
    formData.append("description", asset.description.trim());
  }
  formData.append("file", {
    uri: asset.originalLocalUri,
    name: asset.originalFilename || `${asset.localId}.jpg`,
    type: asset.mimeType || "image/jpeg",
  } as any);
  return formData;
}

export async function prepareSyncQueue() {
  await resetStaleUploadingJobs();
}

export async function syncPendingAssets({
  onAssetUpdated,
}: {
  onAssetUpdated?: () => void;
} = {}) {
  if (syncRunning) return;
  syncRunning = true;
  try {
    const syncableEntries = await listSyncableJobs();
    const entries =
      SYNC_MAX_JOBS_PER_RUN > 0
        ? syncableEntries.slice(0, SYNC_MAX_JOBS_PER_RUN)
        : syncableEntries;
    for (const { job, asset } of entries) {
      await markJobUploading(job.id, asset.localId);
      onAssetUpdated?.();
      try {
        const created = (await api.uploadAsset(formDataForLocalAsset(asset))) as any;
        if (!created?.id) throw new Error("Backend did not return an asset id");
        if (asset.setAsCover) {
          await api.updateKit(asset.kitId, {
            thumbnail_asset_id: created.id,
          });
        }
        await markJobDone(job.id, asset.localId, created.id);
        onAssetUpdated?.();
      } catch (err: any) {
        await markJobFailed(
          job.id,
          asset.localId,
          err?.message || "Upload failed"
        );
        onAssetUpdated?.();
      }
    }
  } finally {
    syncRunning = false;
  }
}
