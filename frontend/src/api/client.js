export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const TOKEN_STORAGE_KEY = "artifactory_access_token";
let authToken = null;

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
      // Expired/invalid token: clear local auth state and notify UI.
      setAuthToken(null);
      if (typeof window !== "undefined") {
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
  getKits: ({ skip = 0, limit = 20 } = {}) => {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("limit", String(limit));
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
  getLinks: () => request("/links"),
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
};
