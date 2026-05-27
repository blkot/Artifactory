import { API_BASE_URL } from "./api/client";
import { BACKEND_READY_TIMEOUT_MS } from "./config";

export type BackendStatus = "unknown" | "online" | "offline";

function backendRootUrl() {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, "");
}

export async function checkBackendReady(
  timeoutMs = BACKEND_READY_TIMEOUT_MS
): Promise<BackendStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${backendRootUrl()}/health/ready`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok ? "online" : "offline";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timeout);
  }
}
