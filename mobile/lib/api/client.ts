import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
const API_ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

const TOKEN_STORAGE_KEY = "artifactory_access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "artifactory_refresh_token";

let authToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export class ApiError extends Error {
  status: number;
  details: any;
  retryAfter: number | null;
  constructor(
    message: string,
    status = 0,
    details: any = null,
    retryAfter: number | null = null
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export async function loadTokenFromStorage() {
  const stored = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  authToken = stored || null;
  return authToken;
}

export async function setAuthToken(token: string | null) {
  authToken = token || null;
  if (token) {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
  }
}

export async function setRefreshToken(token: string | null) {
  if (token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
  }
}

export function getAuthHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

export function authenticatedImageSource(uri: string) {
  const headers = getAuthHeaders();
  return Object.keys(headers).length > 0 ? { uri, headers } : { uri };
}

async function parseBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return response.json().catch(() => null);
}

function headersToRecord(headersInit: HeadersInit | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headersInit) return headers;

  if (typeof Headers !== "undefined" && headersInit instanceof Headers) {
    headersInit.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  if (Array.isArray(headersInit)) {
    headersInit.forEach(([key, value]) => {
      headers[key] = value;
    });
    return headers;
  }

  return { ...(headersInit as Record<string, string>) };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

function buildHeaders(options: RequestInit, token: string | null = authToken) {
  const headers = headersToRecord(options.headers);

  if (
    !hasHeader(headers, "Content-Type") &&
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] = "application/json";
  }
  if (!hasHeader(headers, "Authorization") && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function apiErrorFromResponse(response: Response) {
  const data = await parseBody(response);
  const retryAfter = response.headers.get("Retry-After");
  return new ApiError(
    data?.message || data?.detail || "Request failed",
    response.status,
    data?.details || null,
    retryAfter ? Number(retryAfter) : null
  );
}

async function refreshAccessToken(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) throw await apiErrorFromResponse(res);
        const payload = await res.json();
        await setAuthToken(payload.access_token);
        return payload.access_token;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function request(path: string, options: RequestInit = {}) {
  const headers = buildHeaders(options);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      const refreshToken = await SecureStore.getItemAsync(
        REFRESH_TOKEN_STORAGE_KEY
      );
      if (refreshToken) {
        try {
          const newToken = await refreshAccessToken(refreshToken);
          const retryHeaders = buildHeaders(options, newToken);
          const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: retryHeaders,
          });
          if (retryResponse.status === 204) return null;
          if (!retryResponse.ok) {
            throw await apiErrorFromResponse(retryResponse);
          }
          const retryData = await parseBody(retryResponse);
          return retryData;
        } catch (err: any) {
          if (err instanceof ApiError && err.status !== 401) {
            throw err;
          }
        }
      }

      await setAuthToken(null);
      await setRefreshToken(null);
    }

    throw await apiErrorFromResponse(response);
  }
  return parseBody(response);
}

export const api = {
  checkBackendReady: async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${API_ROOT_URL}/health/ready`, {
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  },

  getKits: ({
    skip = 0,
    limit = 20,
    sort = "activity_at",
    order = "desc",
  } = {}) => {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    params.set("sort", sort);
    params.set("order", order);
    return request(`/kits?${params.toString()}`);
  },

  searchKits: (filters: Record<string, any> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        if (Array.isArray(value)) {
          value
            .map((item: any) => String(item).trim())
            .filter(Boolean)
            .forEach((item: string) => params.append(key, item));
        } else if (["brand", "series", "scale", "tag"].includes(key)) {
          String(value)
            .split(",")
            .map((item: string) => item.trim())
            .filter(Boolean)
            .forEach((item: string) => params.append(key, item));
        } else {
          params.set(key, String(value));
        }
      }
    });
    return request(`/kits/search?${params.toString()}`);
  },

  createKit: (payload: any) =>
    request("/kits", { method: "POST", body: JSON.stringify(payload) }),
  getKit: (id: number) => request(`/kits/${id}`),
  updateKit: (id: number, payload: any) =>
    request(`/kits/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteKit: (id: number) => request(`/kits/${id}`, { method: "DELETE" }),

  getAssets: ({
    kitId = null,
    skip = 0,
    limit = 20,
  }: {
    kitId?: number | null;
    skip?: number;
    limit?: number;
  } = {}) => {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    if (kitId !== null && kitId !== undefined) {
      params.set("kit_id", String(kitId));
    }
    return request(`/assets?${params.toString()}`);
  },

  uploadAsset: (formData: FormData) =>
    request("/assets", { method: "POST", body: formData }),
  deleteAsset: (id: number) => request(`/assets/${id}`, { method: "DELETE" }),
  assetFileUrl: (id: number) => `${API_BASE_URL}/assets/${id}/file`,

  getTags: () => request("/tags"),
  createTag: (payload: any) =>
    request("/tags", { method: "POST", body: JSON.stringify(payload) }),
  updateTag: (id: number, payload: any) =>
    request(`/tags/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  getStats: () => request("/stats"),

  getLinks: (kitId: number | null = null) => {
    const params = new URLSearchParams();
    if (kitId !== null) params.set("kit_id", String(kitId));
    return request(`/links?${params.toString()}`);
  },
  createLink: (payload: any) =>
    request("/links", { method: "POST", body: JSON.stringify(payload) }),
  uploadLinkThumbnail: (id: number, formData: FormData) =>
    request(`/links/${id}/thumbnail`, { method: "POST", body: formData }),
  linkThumbnailUrl: (id: number) => `${API_BASE_URL}/links/${id}/thumbnail`,
  deleteLink: (id: number) => request(`/links/${id}`, { method: "DELETE" }),

  getTimeline: (kitId: number) => request(`/kits/${kitId}/timeline`),
  createTimeline: (kitId: number, payload: any) =>
    request(`/kits/${kitId}/timeline`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: async (username: string, password: string) => {
    const body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    return request("/auth/login", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },

  logout: (refreshToken: string | null) => {
    if (!refreshToken) return Promise.resolve();
    return request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  // Immich
  getImmichTags: () => request("/immich/tags"),
  searchImmichAssets: (
    tagIds: string[],
    page = 1,
    size = 60
  ) =>
    request("/immich/search", {
      method: "POST",
      body: JSON.stringify({ tagIds, page, size }),
    }),
  getImmichThumbUrl: (assetId: string) =>
    `${API_BASE_URL}/immich/assets/${assetId}/thumbnail`,
  getImmichOriginalUrl: (assetId: string) =>
    `${API_BASE_URL}/immich/assets/${assetId}/original`,
  getImmichHealth: () => request("/immich/health"),

  // Filters
  getFilterValues: (field: string) => request(`/filters/${field}`),
  createFilterValue: (field: string, value: string) =>
    request(`/filters/${field}`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),
  deleteFilterValue: (field: string, value: string) =>
    request(`/filters/${field}/${encodeURIComponent(value)}`, {
      method: "DELETE",
    }),
};
