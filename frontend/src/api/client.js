const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
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

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await parseBody(response);
  if (!response.ok) {
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
  getKits: () => request("/kits"),
  createKit: (payload) => request("/kits", { method: "POST", body: JSON.stringify(payload) }),
  getTags: () => request("/tags"),
  createTag: (payload) => request("/tags", { method: "POST", body: JSON.stringify(payload) }),
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
