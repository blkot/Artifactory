export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const TOKEN_STORAGE_KEY = "artifactory_access_token";
let authToken = null;
const REFRESH_TOKEN_STORAGE_KEY = "artifactory_refresh_token";
let refreshPromise = null;

export class ApiError extends Error {
  constructor(message, status = 0, details = null, retryAfter = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export function loadTokenFromStorage() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  authToken = stored || null;
  return authToken;
}

export function setAuthToken(token) {
  authToken = token || null;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
}

function parseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return response.json().catch(() => null);
}

export async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  if (!headers["Content-Type"] && options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (!headers.Authorization && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await parseBody(response);
  if (!response.ok) {
    if (response.status === 401) {
      // Skip refresh for the refresh endpoint itself (no infinite loop).
      if (!path.startsWith("/auth/refresh")) {
        const refreshToken = typeof window !== "undefined"
          ? window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
          : null;
        if (refreshToken) {
          try {
            // Acquire the refresh lock: if another request is already refreshing,
            // wait for it instead of firing a duplicate call.
            if (!refreshPromise) {
              refreshPromise = (async () => {
                try {
                  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: refreshToken }),
                  });
                  if (!res.ok) {
                    throw new Error("refresh failed");
                  }
                  const payload = await res.json();
                  setAuthToken(payload.access_token);
                  return payload.access_token;
                } finally {
                  refreshPromise = null;
                }
              })();
            }
            const newToken = await refreshPromise;
            // Retry the original request with the new access token.
            const retryHeaders = { ...(options.headers || {}) };
            if (!retryHeaders.Authorization) {
              retryHeaders.Authorization = `Bearer ${newToken}`;
            }
            if (!retryHeaders["Content-Type"] && options.body && !(options.body instanceof FormData)) {
              retryHeaders["Content-Type"] = "application/json";
            }
            const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
              ...options,
              headers: retryHeaders,
            });
            if (retryResponse.status === 204) {
              return null;
            }
            const retryData = await parseBody(retryResponse);
            if (!retryResponse.ok) {
              const retryRetryAfter = retryResponse.headers.get("Retry-After");
              throw new ApiError(
                retryData?.message || retryData?.detail || "Request failed",
                retryResponse.status,
                retryData?.details || null,
                retryRetryAfter ? Number(retryRetryAfter) : null,
              );
            }
            return retryData;
          } catch (_) {
            // Refresh or retry failed — fall through to logout below.
          }
        }
      }
      // Refresh not possible: clear auth and notify UI.
      setAuthToken(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        window.dispatchEvent(new Event("artifactory-auth-expired"));
      }
    }
    const retryAfter = response.headers.get("Retry-After");
    throw new ApiError(
      data?.message || data?.detail || "Request failed",
      response.status,
      data?.details || null,
      retryAfter ? Number(retryAfter) : null
    );
  }
  return data;
}

export const api = {
  getKits: ({ skip = 0, limit = 20, sort = "activity_at", order = "desc" } = {}) => {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    params.set("sort", sort);
    params.set("order", order);
    return request(`/kits?${params.toString()}`);
  },
  searchKits: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        if (Array.isArray(value)) {
          value
            .map((item) => String(item).trim())
            .filter(Boolean)
            .forEach((item) => params.append(key, item));
        } else if (["brand", "series", "scale", "tag"].includes(key)) {
          String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .forEach((item) => params.append(key, item));
        } else {
          params.set(key, String(value));
        }
      }
    });
    return request(`/kits/search?${params.toString()}`);
  },
  createKit: (payload) => request("/kits", { method: "POST", body: JSON.stringify(payload) }),
  getKit: (id) => request(`/kits/${id}`),
  updateKit: (id, payload) => request(`/kits/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteKit: (id) => request(`/kits/${id}`, { method: "DELETE" }),
  getAssets: ({ kitId = null, skip = 0, limit = 20 } = {}) => {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    if (kitId !== null && kitId !== undefined) {
      params.set("kit_id", String(kitId));
    }
    return request(`/assets?${params.toString()}`);
  },
  uploadAsset: (formData) => request("/assets", { method: "POST", body: formData }),
  deleteAsset: (id) => request(`/assets/${id}`, { method: "DELETE" }),
  assetFileUrl: (id) => `${API_BASE_URL}/assets/${id}/file`,
  getTags: () => request("/tags"),
  createTag: (payload) => request("/tags", { method: "POST", body: JSON.stringify(payload) }),
  updateTag: (id, payload) => request(`/tags/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  getStats: () => request("/stats"),
  getLinks: (kitId = null) => {
    const params = new URLSearchParams();
    if (kitId !== null) {
      params.set("kit_id", String(kitId));
      return request(`/links?${params.toString()}`);
    }
    return request("/links");
  },
  createLink: (payload) => request("/links", { method: "POST", body: JSON.stringify(payload) }),
  deleteLink: (id) => request(`/links/${id}`, { method: "DELETE" }),
  getTimeline: (kitId) => request(`/kits/${kitId}/timeline`),
  createTimeline: (kitId, payload) =>
    request(`/kits/${kitId}/timeline`, { method: "POST", body: JSON.stringify(payload) }),
  login: async (username, password) => {
    const body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    return request("/auth/login", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  logout: (refreshToken) => {
    if (!refreshToken) return Promise.resolve();
    return request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },
  getFilterValues: (field) => request(`/filters/${field}`),
  createFilterValue: (field, value) =>
    request(`/filters/${field}`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),
  deleteFilterValue: (field, value) =>
    request(`/filters/${field}/${encodeURIComponent(value)}`, {
      method: "DELETE",
    }),
  getImmichTags: () => request("/immich/tags"),
  searchImmichAssets: (tagIds, page = 1, size = 60) =>
    request("/immich/search", {
      method: "POST",
      body: JSON.stringify({ tagIds, page, size }),
    }),
  getImmichThumbUrl: (assetId) => `${API_BASE_URL}/immich/assets/${assetId}/thumbnail`,
  getImmichOriginalUrl: (assetId) => `${API_BASE_URL}/immich/assets/${assetId}/original`,
};
