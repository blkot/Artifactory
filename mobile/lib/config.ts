function numberFromEnv(
  name: string,
  fallback: number,
  { min, max }: { min?: number; max?: number } = {}
) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  if (min !== undefined && value < min) return fallback;
  if (max !== undefined && value > max) return fallback;
  return value;
}

function intFromEnv(
  name: string,
  fallback: number,
  bounds: { min?: number; max?: number } = {}
) {
  return Math.round(numberFromEnv(name, fallback, bounds));
}

export const IMAGE_CACHE_CONFIG = {
  displayMaxEdge: intFromEnv("EXPO_PUBLIC_IMAGE_DISPLAY_MAX_EDGE", 1600, {
    min: 320,
  }),
  thumbnailMaxEdge: intFromEnv("EXPO_PUBLIC_IMAGE_THUMB_MAX_EDGE", 300, {
    min: 96,
  }),
  displayQuality: numberFromEnv("EXPO_PUBLIC_IMAGE_DISPLAY_QUALITY", 0.82, {
    min: 0.1,
    max: 1,
  }),
  thumbnailQuality: numberFromEnv("EXPO_PUBLIC_IMAGE_THUMB_QUALITY", 0.75, {
    min: 0.1,
    max: 1,
  }),
  maxBytes:
    intFromEnv("EXPO_PUBLIC_IMAGE_CACHE_LIMIT_MB", 500, { min: 16 }) *
    1024 *
    1024,
};

export const BACKEND_READY_TIMEOUT_MS = intFromEnv(
  "EXPO_PUBLIC_BACKEND_READY_TIMEOUT_MS",
  3000,
  { min: 500 }
);

export const SYNC_MAX_JOBS_PER_RUN = intFromEnv(
  "EXPO_PUBLIC_SYNC_MAX_JOBS_PER_RUN",
  0,
  { min: 0 }
);
