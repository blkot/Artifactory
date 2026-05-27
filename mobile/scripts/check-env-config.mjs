#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL(".", import.meta.url).pathname, "..");
const envExample = readFileSync(resolve(root, ".env.example"), "utf8");

const expectedKeys = new Set([
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_BACKEND_READY_TIMEOUT_MS",
  "EXPO_PUBLIC_IMAGE_DISPLAY_MAX_EDGE",
  "EXPO_PUBLIC_IMAGE_DISPLAY_QUALITY",
  "EXPO_PUBLIC_IMAGE_THUMB_MAX_EDGE",
  "EXPO_PUBLIC_IMAGE_THUMB_QUALITY",
  "EXPO_PUBLIC_IMAGE_CACHE_LIMIT_MB",
  "EXPO_PUBLIC_SYNC_MAX_JOBS_PER_RUN",
]);

const values = new Map();
for (const line of envExample.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index === -1) continue;
  values.set(trimmed.slice(0, index), trimmed.slice(index + 1));
}

const missing = [...expectedKeys].filter((key) => !values.has(key));
if (missing.length > 0) {
  throw new Error(`Missing env example keys: ${missing.join(", ")}`);
}

function numberValue(key, { min, max }) {
  const value = Number(values.get(key));
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${key} must be a number between ${min} and ${max}`);
  }
}

numberValue("EXPO_PUBLIC_BACKEND_READY_TIMEOUT_MS", { min: 500, max: 60000 });
numberValue("EXPO_PUBLIC_IMAGE_DISPLAY_MAX_EDGE", { min: 320, max: 10000 });
numberValue("EXPO_PUBLIC_IMAGE_DISPLAY_QUALITY", { min: 0.1, max: 1 });
numberValue("EXPO_PUBLIC_IMAGE_THUMB_MAX_EDGE", { min: 96, max: 2000 });
numberValue("EXPO_PUBLIC_IMAGE_THUMB_QUALITY", { min: 0.1, max: 1 });
numberValue("EXPO_PUBLIC_IMAGE_CACHE_LIMIT_MB", { min: 16, max: 100000 });
numberValue("EXPO_PUBLIC_SYNC_MAX_JOBS_PER_RUN", { min: 0, max: 10000 });

if (!String(values.get("EXPO_PUBLIC_API_BASE_URL")).endsWith("/api/v1")) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL should point at the /api/v1 root");
}

console.log("[mobile-check] Env config OK");
