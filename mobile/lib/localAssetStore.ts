import * as SQLite from "expo-sqlite";

export type LocalAssetSyncStatus =
  | "local"
  | "queued"
  | "uploading"
  | "synced"
  | "failed";

export interface LocalAsset {
  localId: string;
  kitId: number;
  type: string;
  originalFilename: string;
  originalLocalUri: string;
  displayLocalUri: string;
  thumbnailLocalUri: string;
  mimeType: string;
  description: string | null;
  setAsCover: boolean;
  syncStatus: LocalAssetSyncStatus;
  remoteAssetId: number | null;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
  error: string | null;
}

export interface UploadJob {
  id: string;
  localAssetId: string;
  status: "queued" | "uploading" | "failed" | "done";
  attemptCount: number;
  lockedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteAssetCache {
  remoteAssetId: number;
  displayLocalUri: string;
  thumbnailLocalUri: string;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function boolToInt(value: boolean) {
  return value ? 1 : 0;
}

function rowToLocalAsset(row: any): LocalAsset {
  return {
    localId: row.local_id,
    kitId: row.kit_id,
    type: row.type,
    originalFilename: row.original_filename,
    originalLocalUri: row.original_local_uri,
    displayLocalUri: row.display_local_uri,
    thumbnailLocalUri: row.thumbnail_local_uri,
    mimeType: row.mime_type,
    description: row.description,
    setAsCover: Boolean(row.set_as_cover),
    syncStatus: row.sync_status,
    remoteAssetId: row.remote_asset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAttemptAt: row.last_attempt_at,
    error: row.error,
  };
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("artifactory_mobile.db");
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS local_assets (
          local_id TEXT PRIMARY KEY NOT NULL,
          kit_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          original_local_uri TEXT NOT NULL,
          display_local_uri TEXT NOT NULL,
          thumbnail_local_uri TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          description TEXT,
          set_as_cover INTEGER NOT NULL DEFAULT 0,
          sync_status TEXT NOT NULL,
          remote_asset_id INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_attempt_at TEXT,
          error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_local_assets_kit_id ON local_assets(kit_id);
        CREATE INDEX IF NOT EXISTS idx_local_assets_sync_status ON local_assets(sync_status);
        CREATE TABLE IF NOT EXISTS upload_jobs (
          id TEXT PRIMARY KEY NOT NULL,
          local_asset_id TEXT NOT NULL,
          status TEXT NOT NULL,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          locked_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(status);
        CREATE TABLE IF NOT EXISTS remote_asset_caches (
          remote_asset_id INTEGER PRIMARY KEY NOT NULL,
          display_local_uri TEXT NOT NULL,
          thumbnail_local_uri TEXT NOT NULL,
          byte_size INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_accessed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_remote_asset_caches_last_accessed
          ON remote_asset_caches(last_accessed_at);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function initLocalAssetStore() {
  await getDb();
}

export async function insertLocalAsset(asset: LocalAsset) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO local_assets (
      local_id, kit_id, type, original_filename, original_local_uri,
      display_local_uri, thumbnail_local_uri, mime_type, description,
      set_as_cover, sync_status, remote_asset_id, created_at, updated_at,
      last_attempt_at, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    asset.localId,
    asset.kitId,
    asset.type,
    asset.originalFilename,
    asset.originalLocalUri,
    asset.displayLocalUri,
    asset.thumbnailLocalUri,
    asset.mimeType,
    asset.description,
    boolToInt(asset.setAsCover),
    asset.syncStatus,
    asset.remoteAssetId,
    asset.createdAt,
    asset.updatedAt,
    asset.lastAttemptAt,
    asset.error
  );
}

export async function enqueueUploadJob(localAssetId: string) {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO upload_jobs (
      id, local_asset_id, status, attempt_count, locked_at, last_error,
      created_at, updated_at
    ) VALUES (?, ?, 'queued', 0, NULL, NULL, ?, ?)`,
    `job_${localAssetId}`,
    localAssetId,
    timestamp,
    timestamp
  );
  await updateLocalAssetSync(localAssetId, { syncStatus: "queued", error: null });
}

export async function requeueUploadJob(localAssetId: string) {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO upload_jobs (
      id, local_asset_id, status, attempt_count, locked_at, last_error,
      created_at, updated_at
    ) VALUES (?, ?, 'queued', 0, NULL, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = 'queued',
      locked_at = NULL,
      last_error = NULL,
      updated_at = excluded.updated_at`,
    `job_${localAssetId}`,
    localAssetId,
    timestamp,
    timestamp
  );
  await updateLocalAssetSync(localAssetId, { syncStatus: "queued", error: null });
}

export async function listLocalAssetsForKit(kitId: number): Promise<LocalAsset[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM local_assets WHERE kit_id = ? ORDER BY created_at DESC`,
    kitId
  );
  return rows.map(rowToLocalAsset);
}

export async function listSyncableJobs(): Promise<
  { job: UploadJob; asset: LocalAsset }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT
      j.id AS job_id, j.local_asset_id, j.status AS job_status,
      j.attempt_count, j.locked_at, j.last_error, j.created_at AS job_created_at,
      j.updated_at AS job_updated_at, a.*
    FROM upload_jobs j
    JOIN local_assets a ON a.local_id = j.local_asset_id
    WHERE j.status IN ('queued', 'failed')
      AND a.sync_status IN ('local', 'queued', 'failed')
    ORDER BY j.created_at ASC`
  );

  return rows.map((row) => ({
    job: {
      id: row.job_id,
      localAssetId: row.local_asset_id,
      status: row.job_status,
      attemptCount: row.attempt_count,
      lockedAt: row.locked_at,
      lastError: row.last_error,
      createdAt: row.job_created_at,
      updatedAt: row.job_updated_at,
    },
    asset: rowToLocalAsset(row),
  }));
}

export async function resetStaleUploadingJobs() {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `UPDATE upload_jobs
     SET status = 'queued', locked_at = NULL, updated_at = ?
     WHERE status = 'uploading'`,
    timestamp
  );
  await db.runAsync(
    `UPDATE local_assets
     SET sync_status = 'queued', updated_at = ?
     WHERE sync_status = 'uploading'`,
    timestamp
  );
}

export async function markJobUploading(jobId: string, localAssetId: string) {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `UPDATE upload_jobs
     SET status = 'uploading', attempt_count = attempt_count + 1,
         locked_at = ?, updated_at = ?
     WHERE id = ?`,
    timestamp,
    timestamp,
    jobId
  );
  await updateLocalAssetSync(localAssetId, {
    syncStatus: "uploading",
    lastAttemptAt: timestamp,
    error: null,
  });
}

export async function markJobDone(
  jobId: string,
  localAssetId: string,
  remoteAssetId: number
) {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `UPDATE upload_jobs
     SET status = 'done', locked_at = NULL, updated_at = ?
     WHERE id = ?`,
    timestamp,
    jobId
  );
  await updateLocalAssetSync(localAssetId, {
    syncStatus: "synced",
    remoteAssetId,
    error: null,
  });
}

export async function markJobFailed(
  jobId: string,
  localAssetId: string,
  error: string
) {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `UPDATE upload_jobs
     SET status = 'failed', locked_at = NULL, last_error = ?, updated_at = ?
     WHERE id = ?`,
    error,
    timestamp,
    jobId
  );
  await updateLocalAssetSync(localAssetId, {
    syncStatus: "failed",
    error,
  });
}

export async function updateLocalAssetSync(
  localAssetId: string,
  patch: Partial<
    Pick<
      LocalAsset,
      "syncStatus" | "remoteAssetId" | "lastAttemptAt" | "error" | "setAsCover"
    >
  >
) {
  const db = await getDb();
  const current = await getLocalAsset(localAssetId);
  if (!current) return;
  await db.runAsync(
    `UPDATE local_assets
     SET sync_status = ?, remote_asset_id = ?, last_attempt_at = ?,
         error = ?, set_as_cover = ?, updated_at = ?
     WHERE local_id = ?`,
    patch.syncStatus ?? current.syncStatus,
    patch.remoteAssetId ?? current.remoteAssetId,
    patch.lastAttemptAt ?? current.lastAttemptAt,
    patch.error === undefined ? current.error : patch.error,
    boolToInt(patch.setAsCover ?? current.setAsCover),
    nowIso(),
    localAssetId
  );
}

export async function getLocalAsset(localAssetId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM local_assets WHERE local_id = ?`,
    localAssetId
  );
  return row ? rowToLocalAsset(row) : null;
}

export async function deleteLocalAsset(localAssetId: string) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM upload_jobs WHERE local_asset_id = ?`, localAssetId);
  await db.runAsync(`DELETE FROM local_assets WHERE local_id = ?`, localAssetId);
}

function rowToRemoteAssetCache(row: any): RemoteAssetCache {
  return {
    remoteAssetId: row.remote_asset_id,
    displayLocalUri: row.display_local_uri,
    thumbnailLocalUri: row.thumbnail_local_uri,
    byteSize: row.byte_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

export async function upsertRemoteAssetCache(cache: {
  remoteAssetId: number;
  displayLocalUri: string;
  thumbnailLocalUri: string;
  byteSize: number;
}) {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO remote_asset_caches (
      remote_asset_id, display_local_uri, thumbnail_local_uri, byte_size,
      created_at, updated_at, last_accessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(remote_asset_id) DO UPDATE SET
      display_local_uri = excluded.display_local_uri,
      thumbnail_local_uri = excluded.thumbnail_local_uri,
      byte_size = excluded.byte_size,
      updated_at = excluded.updated_at,
      last_accessed_at = excluded.last_accessed_at`,
    cache.remoteAssetId,
    cache.displayLocalUri,
    cache.thumbnailLocalUri,
    cache.byteSize,
    timestamp,
    timestamp,
    timestamp
  );
}

export async function listRemoteAssetCachesForAssetIds(
  remoteAssetIds: number[]
): Promise<RemoteAssetCache[]> {
  if (remoteAssetIds.length === 0) return [];
  const db = await getDb();
  const placeholders = remoteAssetIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM remote_asset_caches WHERE remote_asset_id IN (${placeholders})`,
    ...remoteAssetIds
  );
  return rows.map(rowToRemoteAssetCache);
}

export async function listRemoteAssetCachesByAge(): Promise<RemoteAssetCache[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM remote_asset_caches ORDER BY last_accessed_at ASC`
  );
  return rows.map(rowToRemoteAssetCache);
}

export async function touchRemoteAssetCache(remoteAssetId: number) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE remote_asset_caches
     SET last_accessed_at = ?
     WHERE remote_asset_id = ?`,
    nowIso(),
    remoteAssetId
  );
}

export async function getRemoteAssetCacheStats() {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(byte_size), 0) AS byte_size
     FROM remote_asset_caches`
  );
  return {
    count: Number(row?.count || 0),
    byteSize: Number(row?.byte_size || 0),
  };
}

export async function deleteRemoteAssetCache(remoteAssetId: number) {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM remote_asset_caches WHERE remote_asset_id = ?`,
    remoteAssetId
  );
}
