import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { api, loadTokenFromStorage, setAuthToken } from "./api/client";

import { PAGE_SIZE, THUMBNAIL_PREF_STORAGE_KEY, CUSTOM_FACET_STORAGE_KEY, EMPTY_KIT_FILTERS } from "./constants";
import { caseFold, buildCaseInsensitiveFacetOptions, toUserMessage } from "./utils";
import TopNav from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import KitsPage from "./pages/KitsPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import NewKitPage from "./pages/NewKitPage";
import KitWorkspacePage from "./pages/KitWorkspacePage";
import FilterManagementPage from "./pages/FilterManagementPage";

export default function App() {
  const location = useLocation();
  const [token, setToken] = useState(() => loadTokenFromStorage());
  const [kits, setKits] = useState([]);
  const [kitPreviewMap, setKitPreviewMap] = useState({});
  const [preferredThumbnailAssetMap, setPreferredThumbnailAssetMap] = useState(() => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(THUMBNAIL_PREF_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [customFacetValues, setCustomFacetValues] = useState(() => {
    if (typeof window === "undefined") return { brand: [], series: [], scale: [] };
    const raw = window.localStorage.getItem(CUSTOM_FACET_STORAGE_KEY);
    if (!raw) return { brand: [], series: [], scale: [] };
    try {
      const parsed = JSON.parse(raw);
      return {
        brand: Array.isArray(parsed?.brand) ? parsed.brand : [],
        series: Array.isArray(parsed?.series) ? parsed.series : [],
        scale: Array.isArray(parsed?.scale) ? parsed.scale : [],
      };
    } catch {
      return { brand: [], series: [], scale: [] };
    }
  });
  const [tags, setTags] = useState([]);
  const [kitFacetOptions, setKitFacetOptions] = useState({ brand: [], series: [], scale: [] });
  const [stats, setStats] = useState(null);
  const [kitFilters, setKitFilters] = useState(EMPTY_KIT_FILTERS);
  const [kitPage, setKitPage] = useState(1);
  const [kitTotal, setKitTotal] = useState(0);
  const [kitsLoadingMore, setKitsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReferenceData() {
    setLoading(true);
    setError("");
    try {
      const [tagRes, statsRes, kitRes] = await Promise.all([
        api.getTags(),
        api.getStats(),
        api.getKits({ skip: 0, limit: 100 }),
      ]);
      setTags(tagRes || []);
      setStats(statsRes);
      const rows = kitRes.items || [];
      setKitFacetOptions(buildCaseInsensitiveFacetOptions(rows, customFacetValues));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadKits({ nextPage = 1, nextFilters = kitFilters, append = false } = {}) {
    setError("");
    if (append) setKitsLoadingMore(true);
    const skip = Math.max(0, (nextPage - 1) * PAGE_SIZE);
    try {
      const payload = Object.values(nextFilters).some((value) => String(value).trim().length > 0)
        ? await api.searchKits({ ...nextFilters, skip, limit: PAGE_SIZE })
        : await api.getKits({ skip, limit: PAGE_SIZE });
      if (append) {
        setKits((prev) => {
          const merged = [...prev, ...(payload.items || [])];
          const byId = new Map(merged.map((item) => [item.id, item]));
          return Array.from(byId.values());
        });
      } else {
        setKits(payload.items || []);
      }
      setKitTotal(payload.total || 0);
      setKitPage(nextPage);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      if (append) setKitsLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadReferenceData();
  }, [token, customFacetValues]);

  useEffect(() => {
    void loadKits({ nextPage: 1, nextFilters: kitFilters, append: false });
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const onAuthExpired = () => {
      setToken(null);
      setError("Session expired. Please log in again.");
    };
    window.addEventListener("artifactory-auth-expired", onAuthExpired);
    return () => window.removeEventListener("artifactory-auth-expired", onAuthExpired);
  }, []);

  useEffect(() => {
    if (kits.length === 0) {
      setKitPreviewMap({});
      return;
    }
    let active = true;

    async function loadKitPreviews() {
      const rows = await Promise.all(
        kits.map(async (kit) => {
          try {
            const payload = await api.getAssets({ kitId: kit.id, skip: 0, limit: 30 });
            const images = (payload.items || []).filter((item) => item.mime_type?.startsWith("image/"));
            const preferredId = kit.thumbnail_asset_id || preferredThumbnailAssetMap[String(kit.id)];
            const image = images.find((item) => item.id === preferredId) || images[0] || null;
            return [kit.id, image ? api.assetFileUrl(image.id) : null];
          } catch (_) {
            return [kit.id, null];
          }
        })
      );

      if (!active) return;
      const next = {};
      rows.forEach(([id, src]) => {
        next[id] = src;
      });
      setKitPreviewMap(next);
    }

    void loadKitPreviews();
    return () => {
      active = false;
    };
  }, [kits, preferredThumbnailAssetMap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THUMBNAIL_PREF_STORAGE_KEY, JSON.stringify(preferredThumbnailAssetMap));
  }, [preferredThumbnailAssetMap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_FACET_STORAGE_KEY, JSON.stringify(customFacetValues));
  }, [customFacetValues]);

  async function handleCreateKit(_createdKit) {
    try {
      await Promise.all([
        loadKits({ nextPage: 1, nextFilters: kitFilters, append: false }),
        loadReferenceData(),
      ]);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function handleLogin(username, password) {
    setError("");
    try {
      const result = await api.login(username, password);
      setAuthToken(result.access_token);
      setToken(result.access_token);
      if (result.refresh_token) {
        window.localStorage.setItem("artifactory_refresh_token", result.refresh_token);
      }
      return true;
    } catch (err) {
      setError(toUserMessage(err));
      return false;
    }
  }

  async function handleLogout() {
    try {
      const refreshToken = window.localStorage.getItem("artifactory_refresh_token");
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch (_) {
      // Proceed even if logout API fails
    }
    window.localStorage.removeItem("artifactory_refresh_token");
    setAuthToken(null);
    setToken(null);
    setError("");
  }

  function updateKitFilters(updater) {
    setKitFilters((prev) => {
      const next =
        typeof updater === "function"
          ? updater(prev)
          : {
              ...prev,
              ...updater,
            };
      void loadKits({ nextPage: 1, nextFilters: next, append: false });
      return next;
    });
  }

  function clearFilters() {
    setKitFilters(EMPTY_KIT_FILTERS);
    void loadKits({ nextPage: 1, nextFilters: EMPTY_KIT_FILTERS, append: false });
  }

  async function handleKitMutation() {
    await Promise.all([
      loadKits({ nextPage: 1, nextFilters: kitFilters, append: false }),
      loadReferenceData(),
    ]);
  }

  async function handleKitDeletion() {
    await Promise.all([
      loadKits({ nextPage: 1, nextFilters: kitFilters, append: false }),
      loadReferenceData(),
    ]);
  }

  async function loadMoreKits() {
    if (kitsLoadingMore) return;
    if (kits.length >= kitTotal) return;
    await loadKits({ nextPage: kitPage + 1, nextFilters: kitFilters, append: true });
  }

  async function setKitThumbnailSource(kitId, assetId) {
    try {
      await api.updateKit(kitId, { thumbnail_asset_id: assetId || null });
    } catch (_) {
      // Proceed even if API call fails — localStorage is the fallback.
    }
    setPreferredThumbnailAssetMap((prev) => {
      const next = { ...prev };
      if (assetId === null || assetId === undefined) {
        delete next[String(kitId)];
      } else {
        next[String(kitId)] = assetId;
      }
      return next;
    });
  }

  function createCustomFacetValue(field, value) {
    if (!["brand", "series", "scale"].includes(field)) return;
    const raw = String(value || "").trim();
    if (!raw) return;
    setCustomFacetValues((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      const exists = current.some((item) => caseFold(item) === caseFold(raw));
      if (exists) return prev;
      return {
        ...prev,
        [field]: [...current, raw].sort((a, b) => a.localeCompare(b)),
      };
    });
  }

  function renameCustomFacetValue(field, fromValue, toValue) {
    if (!["brand", "series", "scale"].includes(field)) return;
    const fromKey = caseFold(fromValue);
    const toRaw = String(toValue || "").trim();
    if (!fromKey || !toRaw) return;
    setCustomFacetValues((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      const nextMap = new Map();
      for (const item of current) {
        const raw = String(item || "").trim();
        if (!raw) continue;
        const key = caseFold(raw);
        if (key === fromKey) {
          nextMap.set(caseFold(toRaw), toRaw);
        } else if (!nextMap.has(key)) {
          nextMap.set(key, raw);
        }
      }
      if (!nextMap.has(caseFold(toRaw))) {
        nextMap.set(caseFold(toRaw), toRaw);
      }
      return {
        ...prev,
        [field]: Array.from(nextMap.values()).sort((a, b) => a.localeCompare(b)),
      };
    });
  }

  const isLoginRoute = location.pathname === "/login";

  if (isLoginRoute) {
    return <LoginPage onLogin={handleLogin} error={error} />;
  }

  return (
    <main className="app-shell">
      <TopNav token={token} onLogout={handleLogout} />
      <section className="content-shell">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage kits={kits} kitPreviewMap={kitPreviewMap} stats={stats} />} />
          <Route
            path="/kits"
            element={
              <KitsPage
                kits={kits}
                kitPreviewMap={kitPreviewMap}
                tags={tags}
                facetOptions={kitFacetOptions}
                total={kitTotal}
                filters={kitFilters}
                onFilterChange={(field, value) =>
                  updateKitFilters((prev) => ({
                    ...prev,
                    [field]: value,
                  }))
                }
                onToggleFilterValue={(field, value) =>
                  updateKitFilters((prev) => {
                    const current = Array.isArray(prev[field]) ? prev[field] : [];
                    return {
                      ...prev,
                      [field]: current.includes(value)
                        ? current.filter((item) => item !== value)
                        : [...current, value],
                    };
                  })
                }
                onClearFilters={clearFilters}
                onLoadMore={loadMoreKits}
                hasMore={kits.length < kitTotal}
                loadingMore={kitsLoadingMore}
              />
            }
          />
          <Route path="/kits/new" element={<NewKitPage tags={tags} onCreate={handleCreateKit} />} />
          <Route
            path="/kits/:kitId"
            element={
              <KitWorkspacePage
                token={token}
                allTags={tags}
                thumbnailAssetMap={preferredThumbnailAssetMap}
                onSetThumbnailAsset={setKitThumbnailSource}
                onKitMutated={handleKitMutation}
                onKitDeleted={handleKitDeletion}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage token={token} />} />
          <Route
            path="/settings/filters"
            element={
              token ? (
                <FilterManagementPage
                  token={token}
                  customFacetValues={customFacetValues}
                  onCreateCustomFacetValue={createCustomFacetValue}
                  onRenameCustomFacetValue={renameCustomFacetValue}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </section>
    </main>
  );
}
