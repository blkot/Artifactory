import { ApiError } from "./api/client";

export function caseFold(value: any): string {
  return String(value || "").trim().toLowerCase();
}

export function buildCaseInsensitiveFacetOptions(
  rows: Record<string, any>[],
  customValues: Record<string, string[]> = {}
): Record<string, string[]> {
  const fields = ["brand", "series", "scale"];
  const options: Record<string, string[]> = { brand: [], series: [], scale: [] };

  for (const field of fields) {
    const map = new Map<string, string>();
    for (const rawCustom of (customValues[field] || [])) {
      const raw = String(rawCustom || "").trim();
      if (!raw) continue;
      const key = caseFold(raw);
      if (!map.has(key)) {
        map.set(key, raw);
      }
    }
    for (const row of rows) {
      const raw = String(row[field] || "").trim();
      if (!raw) continue;
      const key = caseFold(raw);
      if (!map.has(key)) {
        map.set(key, raw);
      }
    }
    options[field] = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }

  return options;
}

interface KitLike {
  name?: string; grade?: string; series?: string; brand?: string;
  scale?: string; kit_number?: string; purchase_date?: string;
  purchase_price?: any; purchase_shop?: string; build_status?: string;
}

export function buildKitEditForm(kit: KitLike) {
  return {
    name: kit.name || "",
    grade: kit.grade || "HG",
    series: kit.series || "",
    brand: kit.brand || "",
    scale: kit.scale || "",
    kit_number: kit.kit_number || "",
    purchase_date: kit.purchase_date || "",
    purchase_price: kit.purchase_price ?? "",
    purchase_shop: kit.purchase_shop || "",
    build_status: String(kit.build_status || "NEW").replace("BuildStatus.", ""),
  };
}

export function toUserMessage(err: any): string {
  if (err instanceof ApiError && err.status === 429) {
    return err.retryAfter
      ? `Rate limit exceeded. Retry after ${err.retryAfter}s.`
      : "Rate limit exceeded.";
  }
  return err?.message || "Request failed";
}
