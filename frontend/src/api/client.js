const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.detail || "Request failed");
  }
  return data;
}

export const api = {
  getKits: () => request("/kits"),
  createKit: (payload) => request("/kits", { method: "POST", body: JSON.stringify(payload) }),
  getTags: () => request("/tags"),
  createTag: (payload) => request("/tags", { method: "POST", body: JSON.stringify(payload) }),
  getStats: () => request("/stats"),
};
