import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { appLanguage } from "../i18n/localizedData";
import { fetchRecord } from "../data/directusClient";
import { STYLE_URL, geometryBounds, transformTileRequest } from "./mapClient";
import {
  INITIAL_PROJECT_CATEGORY_VISIBILITY,
  PROJECT_CATEGORIES,
  projectBorderLayerId,
  projectFillLayerId,
  projectIconId,
  projectSourceId,
  projectSymbolLayerId,
} from "./projectLayers";
import {
  loadMapRegistry,
  mvtFillLayerId,
  mvtLineLayerId,
  mvtPointHaloLayerId,
  mvtPointLayerId,
  mvtSourceId,
  type MapRegistrySnapshot,
  type SelectedMvtFeature,
  type DynamicMapLayerConfig,
} from "./layerRegistry";
import type {
  ProjectCategory,
  ProjectCategoryId,
  ProjectFeatureCollection,
  ProjectProperties,
  ProjectSearchItem,
  SelectedProject,
  Ward,
  WardFeatureCollection,
  WardProperties,
} from "./types";

const GEOJSON_URL = "https://ioc-canhbao.hue.gov.vn/uploadfiles/40xaphuong_TPHue.json";
const CITY_GEOJSON_URL = "https://ioc-canhbao.hue.gov.vn/uploadfiles/thanhphohuegeo.json";
const CITY_SOURCE_ID = "thanhphohue_source";
const CITY_FILL_LAYER = "thanhphohue_fill";
const CITY_BORDER_LAYER = "thanhphohue_border";
const SOURCE_ID = "xaphuong_source";
const FILL_LAYER = "xaphuong_fill";
const BORDER_LAYER = "xaphuong_border";
const HIGHLIGHT_LAYER = "xaphuong_highlight";
const LABEL_LAYER = "xaphuong_labels";
const WARD_COLORS: Record<string, string> = {
  "1": "#F4E390",
  "2": "#99D1E6",
  "3": "#ABD1AE",
  "4": "#F1A992",
};

function text(value: unknown): string {
  return value === null || value === undefined || String(value).trim().toLowerCase() === "null"
    ? ""
    : String(value).trim();
}

function code(props: WardProperties): string {
  return text(props.maDonViHanhChinh ?? props.madonvihanhchinh ?? props.ward_id ?? props.ma_xa ?? props.maxa);
}

function number(value: unknown): number | null {
  const result = Number(text(value).replace(",", "."));
  return Number.isFinite(result) ? result : null;
}

function normalizeWard(props: WardProperties): Ward {
  const wardCode = code(props);
  const name = text(props.diaDanh ?? props.nhan ?? props.Nhan ?? props.nhanBanDo);
  const label = text(props.nhanBanDo ?? props.nhan ?? props.Nhan ?? props.diaDanh);
  return {
    id: text(props.publicWardId) || wardCode || label || name,
    code: wardCode,
    name,
    label,
    type: text(props.danhTuChung ?? props.danhTuChun),
    area: number(props.dienTich ?? props.dientich),
    population: text(props.quyMoDanSo),
    geographicDescription: text(props.viTriDiaLy),
    committeeAddress: text(props.diaChiUB),
    note: text(props.GhiChu),
    properties: props,
  };
}

function normalizeProject(category: ProjectCategory, properties: ProjectProperties): SelectedProject {
  return {
    id: text(properties.OBJECTID) || `${category.id}-${text(properties.tenDuAn ?? properties.name)}`,
    categoryId: category.id,
    categoryAlias: category.alias,
    color: category.color,
    properties,
  };
}

const projectGeojsonCache = new Map<string, Promise<ProjectFeatureCollection>>();

function fetchProjectGeojson(category: ProjectCategory): Promise<ProjectFeatureCollection> {
  let promise = projectGeojsonCache.get(category.sourceUrl);
  if (!promise) {
    promise = fetch(category.sourceUrl).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<ProjectFeatureCollection>;
    });
    promise.catch(() => projectGeojsonCache.delete(category.sourceUrl));
    projectGeojsonCache.set(category.sourceUrl, promise);
  }
  return promise;
}

// Zoom đích lý tưởng để xem rõ 1 đối tượng (17 cho điểm, 16 cho vùng/đường) có
// thể vượt quá maxZoom mà layer đó được publish (vd trạm quan trắc chỉ hiện tới
// z12) — zoom quá maxZoom sẽ khiến MapLibre tự ẩn layer, marker "biến mất" ngay
// sau khi bay tới. Giới hạn lại theo maxZoom thực tế của layer nếu có.
function focusZoomFor(config: Pick<DynamicMapLayerConfig, "geometryTypes" | "maxZoom">): number {
  const ideal = config.geometryTypes.includes("Point") ? 17 : 16;
  return config.maxZoom !== undefined ? Math.min(ideal, config.maxZoom - 0.5) : ideal;
}

function focusBounds(
  map: maplibregl.Map,
  bounds: [[number, number], [number, number]],
  maxZoom: number,
): void {
  const wideMap = map.getContainer().clientWidth >= 900;
  map.fitBounds(bounds, {
    padding: {
      top: 72,
      bottom: 72,
      left: 72,
      right: wideMap ? 380 : 72,
    },
    maxZoom,
    duration: 900,
  });
}

function loadSvgIcon(map: maplibregl.Map, category: ProjectCategory): Promise<void> {
  const id = projectIconId(category.id);
  if (map.hasImage(id)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const image = new Image(36, 46);
    image.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, image);
      resolve();
    };
    image.onerror = () => reject(new Error(`${i18n.t("map.loadError")}: ${category.alias}`));
    image.src = category.iconUrl;
  });
}

function mvtIconSvg(config: DynamicMapLayerConfig): string {
  const glyphs: Record<string, string> = {
    settings_input_antenna: '<path d="M24 11v19M17 14l7-3 7 3M14 36h20M19 31h10"/><circle cx="24" cy="7" r="2"/>',
    rainy: '<path d="M15 25h18a6 6 0 0 0 0-12 9 9 0 0 0-17-1 6.5 6.5 0 0 0-1 13Z"/><path d="M18 31l-2 5M25 31l-2 5M32 31l-2 5"/>',
    water: '<path d="M10 22c4 0 4 4 8 4s4-4 8-4 4 4 8 4 4-4 8-4M10 31c4 0 4 4 8 4s4-4 8-4 4 4 8 4 4-4 8-4"/>',
    air: '<path d="M10 19h20c5 0 5-7 0-7-2 0-3 1-4 3M10 25h27c4 0 4 6 0 6-2 0-3-1-4-3M10 31h13"/>',
    map: '<path d="m12 14 8-4 8 4 8-4v24l-8 4-8-4-8 4V14Z"/><path d="M20 10v24M28 14v24"/>',
  };
  const glyph = glyphs[config.icon] ?? glyphs.map;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="${config.color}" stroke="#fff" stroke-width="2"/><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
}

function loadMvtIcon(map: maplibregl.Map, config: DynamicMapLayerConfig): Promise<void> {
  const id = `mvt-${config.collectionKey}-icon`;
  if (map.hasImage(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 48;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error(`Không thể tạo icon cho ${config.label}`));
        return;
      }
      context.drawImage(image, 0, 0, 48, 48);
      if (!map.hasImage(id)) map.addImage(id, context.getImageData(0, 0, 48, 48));
      resolve();
    };
    image.onerror = () => reject(new Error(`Không thể tải icon cho ${config.label}`));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mvtIconSvg(config))}`;
  });
}

export function useAdministrativeMap(containerRef: React.RefObject<HTMLDivElement | null>) {
  const { i18n: translationEngine } = useTranslation();
  const currentLanguage = translationEngine.resolvedLanguage ?? translationEngine.language;
  const mapRef = useRef<maplibregl.Map | null>(null);
  const dataRef = useRef<WardFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [cityVisible, setCityVisible] = useState(true);
  const [citySelected, setCitySelected] = useState(false);
  const [hiddenWardIds, setHiddenWardIds] = useState<Set<string>>(() => new Set());
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [projectLayerVisible, setProjectLayerVisible] = useState(false);
  const [projectCategoryVisibility, setProjectCategoryVisibility] = useState<Record<ProjectCategoryId, boolean>>(
    () => ({ ...INITIAL_PROJECT_CATEGORY_VISIBILITY }),
  );
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [projects, setProjects] = useState<ProjectSearchItem[]>([]);
  const [registry, setRegistry] = useState<MapRegistrySnapshot | null>(null);
  const [visibleMvtCollections, setVisibleMvtCollections] = useState<Set<string>>(() => new Set());
  const [selectedMvtFeature, setSelectedMvtFeature] = useState<SelectedMvtFeature | null>(null);
  const selectedMvtRef = useRef<SelectedMvtFeature | null>(null);

  const hiddenRef = useRef<ReadonlySet<string>>(new Set());
  const selectedRef = useRef<string | null>(null);
  const cityVisibleRef = useRef(true);
  const projectVisibleRef = useRef(false);
  const projectCategoryVisibilityRef = useRef(projectCategoryVisibility);
  const visibleMvtCollectionsRef = useRef<ReadonlySet<string>>(new Set());
  hiddenRef.current = hiddenWardIds;
  selectedRef.current = selectedWard?.id ?? null;
  cityVisibleRef.current = cityVisible;
  projectVisibleRef.current = projectLayerVisible;
  projectCategoryVisibilityRef.current = projectCategoryVisibility;
  visibleMvtCollectionsRef.current = visibleMvtCollections;
  selectedMvtRef.current = selectedMvtFeature;

  useEffect(() => {
    let disposed = false;
    void loadMapRegistry()
      .then((snapshot) => {
        if (!disposed) setRegistry(snapshot);
      })
      .catch((reason) => {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : "Không thể tải cấu hình bản đồ.");
          setLoading(false);
        }
      });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadProjectsForSearch = async () => {
      try {
        const categoryProjects = await Promise.all(
          PROJECT_CATEGORIES.map(async (category) => {
            const data = await fetchProjectGeojson(category);
            return (data.features ?? []).flatMap((feature) => {
              if (!feature.properties) return [];
              const project = normalizeProject(category, feature.properties);
              return [{
                ...project,
                name: text(feature.properties.tenDuAn ?? feature.properties.name) || i18n.t("map.unnamedProject"),
                location: text(feature.properties.diaDiem),
                investor: text(feature.properties.nhaDauTu ?? feature.properties.chuDauTu),
                bounds: geometryBounds(feature.geometry),
              }];
            });
          }),
        );
        if (!disposed) setProjects(categoryProjects.flat());
      } catch {
        if (!disposed) setProjects([]);
      }
    };
    void loadProjectsForSearch();
    return () => { disposed = true; };
  }, []);

  const applyState = useCallback((
    map: maplibregl.Map,
    selectedId: string | null,
    hidden: ReadonlySet<string>,
    showCity: boolean,
    showProjects: boolean,
    categoryVisibility: Record<ProjectCategoryId, boolean>,
  ) => {
    [CITY_FILL_LAYER, CITY_BORDER_LAYER].forEach((layer) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", showCity ? "visible" : "none");
    });

    PROJECT_CATEGORIES.forEach((category) => {
      const visibility = showProjects && categoryVisibility[category.id] ? "visible" : "none";
      [projectFillLayerId(category.id), projectBorderLayerId(category.id), projectSymbolLayerId(category.id)].forEach((layer) => {
        if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visibility);
      });
    });

    if (!map.getLayer(FILL_LAYER)) return;
    const ids = [...hidden];
    const filter: maplibregl.FilterSpecification | null = ids.length
      ? ["!", ["in", ["get", "publicWardId"], ["literal", ids]]]
      : null;
    [FILL_LAYER, BORDER_LAYER, LABEL_LAYER].forEach((layer) => map.setFilter(layer, filter));
    if (map.getLayer(HIGHLIGHT_LAYER)) {
      map.setLayoutProperty(
        HIGHLIGHT_LAYER,
        "visibility",
        selectedId && !hidden.has(selectedId) ? "visible" : "none",
      );
      if (selectedId) map.setFilter(HIGHLIGHT_LAYER, ["==", ["get", "publicWardId"], selectedId]);
    }
  }, []);

  const clearMvtFeature = useCallback(() => {
    const selected = selectedMvtRef.current;
    if (selected?.featureId !== null && selected?.featureId !== undefined && mapRef.current) {
      mapRef.current.removeFeatureState({
        source: mvtSourceId(selected.config.collectionKey),
        sourceLayer: selected.config.sourceLayer,
        id: selected.featureId,
      });
    }
    setSelectedMvtFeature(null);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !registry) return;
    let disposed = false;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [107.5991, 16.4637],
      zoom: 10,
      attributionControl: false,
      transformRequest: transformTileRequest,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    const load = async () => {
      setLoading(true);
      try {
        let data = dataRef.current;
        if (!data) {
          const response = await fetch(GEOJSON_URL);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.json() as WardFeatureCollection;
          if (disposed) return;
          data.features.forEach((feature, index) => {
            const props = feature.properties;
            const wardCode = code(props);
            const name = text(props.nhanBanDo ?? props.diaDanh ?? props.Nhan);
            props.publicWardId = wardCode || name || String(index);
            props.publicFillColor = WARD_COLORS[text(props.fColor)] ?? "#D1D5DB";
          });
          dataRef.current = data;
          setWards(
            data.features
              .map((feature) => normalizeWard(feature.properties))
              .filter((ward) => ward.code || ward.name)
              .sort((a, b) => a.name.localeCompare(b.name, "vi")),
          );
        }

        if (!map.getSource(CITY_SOURCE_ID)) {
          map.addSource(CITY_SOURCE_ID, { type: "geojson", data: CITY_GEOJSON_URL });
        }
        if (!map.getLayer(CITY_FILL_LAYER)) {
          map.addLayer({
            id: CITY_FILL_LAYER,
            type: "fill",
            source: CITY_SOURCE_ID,
            paint: { "fill-color": "#0878bd", "fill-opacity": 0.08 },
          });
        }
        if (!map.getLayer(CITY_BORDER_LAYER)) {
          map.addLayer({
            id: CITY_BORDER_LAYER,
            type: "line",
            source: CITY_SOURCE_ID,
            paint: { "line-color": "#075a9b", "line-width": 2.5 },
          });
        }
        if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: "geojson", data });
        if (!map.getLayer(FILL_LAYER)) {
          map.addLayer({
            id: FILL_LAYER,
            type: "fill",
            source: SOURCE_ID,
            paint: {
              "fill-color": ["coalesce", ["get", "publicFillColor"], "#1e6aa8"],
              "fill-opacity": 0.85,
            },
          });
        }
        if (!map.getLayer(BORDER_LAYER)) {
          map.addLayer({
            id: BORDER_LAYER,
            type: "line",
            source: SOURCE_ID,
            paint: { "line-color": "#68778a", "line-width": 1.25 },
          });
        }
        if (!map.getLayer(HIGHLIGHT_LAYER)) {
          map.addLayer({
            id: HIGHLIGHT_LAYER,
            type: "line",
            source: SOURCE_ID,
            paint: { "line-color": "#d71920", "line-width": 4 },
            layout: { visibility: "none" },
          });
        }
        if (!map.getLayer(LABEL_LAYER)) {
          map.addLayer({
            id: LABEL_LAYER,
            type: "symbol",
            source: SOURCE_ID,
            layout: {
              "text-field": ["coalesce", ["get", `nhanBanDo_${appLanguage(i18n.language)}`], ["get", "nhanBanDo"], ["get", "diaDanh"], ["get", "nhan"], ""],
              "text-size": 11,
              "text-anchor": "center",
              "text-max-width": 8,
            },
            paint: { "text-color": "#17263c", "text-halo-color": "#ffffff", "text-halo-width": 2 },
          });
        }

        await Promise.all(registry.layers
          .filter((config) => config.geometryTypes.includes("Point"))
          .map((config) => loadMvtIcon(map, config)));

        registry.layers.forEach((config) => {
          const sourceId = mvtSourceId(config.collectionKey);
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: "vector",
              tiles: [config.tileUrl],
              promoteId: config.featureIdField,
              minzoom: 0,
              maxzoom: 22,
            });
          }
          const common = {
            source: sourceId,
            "source-layer": config.sourceLayer,
            minzoom: config.minZoom,
            ...(config.maxZoom === undefined ? {} : { maxzoom: config.maxZoom }),
            layout: { visibility: "none" as const },
          };
          if (config.geometryTypes.includes("Point")) {
            if (!map.getLayer(mvtPointHaloLayerId(config.collectionKey))) map.addLayer({
              id: mvtPointHaloLayerId(config.collectionKey), type: "circle", ...common,
              paint: {
                // Icon rộng ~40px (48px svg * icon-size 0.85), bán kính vòng tròn bên
                // trong ~18px — halo phải lớn hơn để thấy viền nhô ra ngoài icon.
                "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 24, 0],
                "circle-color": "#d71920",
                "circle-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.28, 0],
                "circle-stroke-color": "#d71920",
                "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 0],
              },
            });
            if (!map.getLayer(mvtPointLayerId(config.collectionKey))) map.addLayer({
              id: mvtPointLayerId(config.collectionKey), type: "symbol", ...common,
              layout: {
                ...common.layout,
                "icon-image": `mvt-${config.collectionKey}-icon`,
                "icon-size": 0.85,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
              paint: { "icon-opacity": 1 },
            });
          } else if (config.geometryTypes.includes("LineString")) {
            if (!map.getLayer(mvtLineLayerId(config.collectionKey))) map.addLayer({
              id: mvtLineLayerId(config.collectionKey), type: "line", ...common,
              paint: {
                "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#d71920", config.color],
                "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 5, 3],
                "line-opacity": 0.9,
              },
            });
          } else if (config.geometryTypes.includes("Polygon")) {
            if (!map.getLayer(mvtFillLayerId(config.collectionKey))) map.addLayer({
              id: mvtFillLayerId(config.collectionKey), type: "fill", ...common,
              paint: {
                "fill-color": config.color,
                "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.55, 0.35],
              },
            });
            if (!map.getLayer(mvtLineLayerId(config.collectionKey))) map.addLayer({
              id: mvtLineLayerId(config.collectionKey), type: "line", ...common,
              paint: {
                "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#d71920", config.color],
                "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 2],
              },
            });
          }
        });

        // Layer vừa tạo luôn có visibility "none"; nếu người dùng đã tick checkbox
        // trước khi bước tạo layer này chạy xong (map còn đang load), effect theo dõi
        // visibleMvtCollections sẽ không chạy lại vì state không đổi thêm lần nào nữa
        // -> layer mãi mãi ẩn dù checkbox đã bật. Đồng bộ lại ngay tại đây để tránh race.
        registry.layers.forEach((config) => {
          const visibility = visibleMvtCollectionsRef.current.has(config.collectionKey) ? "visible" : "none";
          [mvtPointLayerId(config.collectionKey), mvtPointHaloLayerId(config.collectionKey), mvtFillLayerId(config.collectionKey), mvtLineLayerId(config.collectionKey)].forEach((layerId) => {
            if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
          });
        });

        registry.layers.forEach((config) => {
          const layerIds = [
            mvtPointLayerId(config.collectionKey),
            mvtLineLayerId(config.collectionKey),
            mvtFillLayerId(config.collectionKey),
          ];
          layerIds.forEach((layerId) => {
            if (!map.getLayer(layerId)) return;
            map.on("click", layerId, (event) => {
              const feature = event.features?.[0];
              if (!feature) return;
              const rawId = feature.id ?? feature.properties?.[config.featureIdField];
              const featureId = typeof rawId === "string" || typeof rawId === "number" ? rawId : null;
              const previous = selectedMvtRef.current;
              if (previous?.featureId !== null && previous?.featureId !== undefined) {
                map.removeFeatureState({
                  source: mvtSourceId(previous.config.collectionKey),
                  sourceLayer: previous.config.sourceLayer,
                  id: previous.featureId,
                });
              }
              if (featureId !== null) {
                map.setFeatureState(
                  { source: mvtSourceId(config.collectionKey), sourceLayer: config.sourceLayer, id: featureId },
                  { selected: true },
                );
              }
              setSelectedMvtFeature({
                config,
                featureId,
                properties: (feature.properties ?? {}) as Record<string, unknown>,
              });
              setCitySelected(false);
              setSelectedWard(null);
              setSelectedProject(null);
              const bounds = geometryBounds(feature.geometry);
              if (bounds) focusBounds(map, bounds, focusZoomFor(config));
            });
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
          });
        });

        // Nút "Định vị trên bản đồ" ở /statics điều hướng về đây kèm
        // ?focus=collectionKey:id — bật lớp tương ứng, chọn đúng đối tượng và bay tới.
        const focusParam = new URLSearchParams(window.location.search).get("focus");
        if (focusParam) {
          const separatorIndex = focusParam.indexOf(":");
          const focusCollection = separatorIndex === -1 ? focusParam : focusParam.slice(0, separatorIndex);
          const focusId = separatorIndex === -1 ? "" : focusParam.slice(separatorIndex + 1);
          const focusConfig = registry.layers.find((item) => item.collectionKey === focusCollection);
          if (focusConfig && focusId) {
            void fetchRecord(focusConfig.directusCollection, focusId).then((record) => {
              if (!record || disposed) return;
              setVisibleMvtCollections((current) => new Set(current).add(focusConfig.collectionKey));
              const resolvedFeatureId = record.id ?? focusId;
              if (resolvedFeatureId !== null && resolvedFeatureId !== undefined) {
                map.setFeatureState(
                  { source: mvtSourceId(focusConfig.collectionKey), sourceLayer: focusConfig.sourceLayer, id: resolvedFeatureId },
                  { selected: true },
                );
              }
              setSelectedMvtFeature({ config: focusConfig, featureId: resolvedFeatureId, properties: record });
              setCitySelected(false);
              setSelectedWard(null);
              setSelectedProject(null);
              const bounds = geometryBounds(record[focusConfig.geometryField]);
              if (bounds) focusBounds(map, bounds, focusZoomFor(focusConfig));
            });
          }
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("focus");
          window.history.replaceState({}, "", cleanUrl);
        }

        const [, projectGeojson] = await Promise.all([
          Promise.all(PROJECT_CATEGORIES.map((category) => loadSvgIcon(map, category))),
          Promise.all(PROJECT_CATEGORIES.map((category) => fetchProjectGeojson(category))),
        ]);
        PROJECT_CATEGORIES.forEach((category, index) => {
          const sourceId = projectSourceId(category.id);
          const visibility = projectVisibleRef.current && projectCategoryVisibilityRef.current[category.id]
            ? "visible"
            : "none";
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: "geojson", data: projectGeojson[index] });
          }
          if (!map.getLayer(projectFillLayerId(category.id))) {
            map.addLayer({
              id: projectFillLayerId(category.id),
              type: "fill",
              source: sourceId,
              layout: { visibility },
              paint: { "fill-color": category.color, "fill-opacity": 0.28 },
            });
          }
          if (!map.getLayer(projectBorderLayerId(category.id))) {
            map.addLayer({
              id: projectBorderLayerId(category.id),
              type: "line",
              source: sourceId,
              layout: { visibility },
              paint: { "line-color": category.color, "line-width": 2 },
            });
          }
          if (!map.getLayer(projectSymbolLayerId(category.id))) {
            map.addLayer({
              id: projectSymbolLayerId(category.id),
              type: "symbol",
              source: sourceId,
              layout: {
                visibility,
                "icon-image": projectIconId(category.id),
                "icon-size": 0.72,
                "icon-anchor": "bottom",
                "icon-allow-overlap": false,
              },
            });
          }
        });

        const projectFillLayers = PROJECT_CATEGORIES.map((category) => projectFillLayerId(category.id));
        const selectWardFeature = (
          event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
        ) => {
          if (
            projectVisibleRef.current
            && map.queryRenderedFeatures(event.point, { layers: projectFillLayers }).length
          ) return;
          const properties = event.features?.[0]?.properties as WardProperties | undefined;
          if (properties) {
            setCitySelected(false);
            setSelectedProject(null);
            setSelectedWard(normalizeWard(properties));
          }
        };
        map.on("click", FILL_LAYER, selectWardFeature);
        map.on("click", LABEL_LAYER, selectWardFeature);
        map.on("click", CITY_FILL_LAYER, (event) => {
          if (
            !cityVisibleRef.current
            || map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER, LABEL_LAYER, ...projectFillLayers] }).length
          ) return;
          setSelectedWard(null);
          setSelectedProject(null);
          setCitySelected(true);
        });

        PROJECT_CATEGORIES.forEach((category) => {
          const selectProjectFeature = (
            event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
          ) => {
            const properties = event.features?.[0]?.properties as ProjectProperties | undefined;
            if (!properties) return;
            setCitySelected(false);
            setSelectedWard(null);
            setSelectedProject(normalizeProject(category, properties));
          };
          [projectFillLayerId(category.id), projectSymbolLayerId(category.id)].forEach((layer) => {
            map.on("click", layer, selectProjectFeature);
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
          });
        });

        map.on("mouseenter", FILL_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", FILL_LAYER, () => { map.getCanvas().style.cursor = ""; });
        applyState(
          map,
          selectedRef.current,
          hiddenRef.current,
          cityVisibleRef.current,
          projectVisibleRef.current,
          projectCategoryVisibilityRef.current,
        );
        setError(null);
      } catch (reason) {
        if (!disposed) {
          setError(
            reason instanceof Error
              ? `${i18n.t("map.loadError")}: ${reason.message}`
              : i18n.t("map.loadError"),
          );
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    map.on("style.load", load);
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [applyState, clearMvtFeature, containerRef, registry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(LABEL_LAYER)) return;
    const language = appLanguage(currentLanguage);
    map.setLayoutProperty(LABEL_LAYER, "text-field", [
      "coalesce",
      ["get", `nhanBanDo_${language}`],
      ["get", `diaDanh_${language}`],
      ["get", "nhanBanDo"],
      ["get", "diaDanh"],
      ["get", "nhan"],
      "",
    ]);
  }, [currentLanguage]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !registry) return;
    registry.layers.forEach((config) => {
      const visibility = visibleMvtCollections.has(config.collectionKey) ? "visible" : "none";
      [mvtPointLayerId(config.collectionKey), mvtPointHaloLayerId(config.collectionKey), mvtFillLayerId(config.collectionKey), mvtLineLayerId(config.collectionKey)].forEach((layerId) => {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
      });
    });
    if (selectedMvtFeature && !visibleMvtCollections.has(selectedMvtFeature.config.collectionKey)) {
      if (selectedMvtFeature.featureId !== null) {
        map.removeFeatureState({
          source: mvtSourceId(selectedMvtFeature.config.collectionKey),
          sourceLayer: selectedMvtFeature.config.sourceLayer,
          id: selectedMvtFeature.featureId,
        });
      }
      setSelectedMvtFeature(null);
    }
  }, [registry, selectedMvtFeature, visibleMvtCollections]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      applyState(
        map,
        selectedWard?.id ?? null,
        hiddenWardIds,
        cityVisible,
        projectLayerVisible,
        projectCategoryVisibility,
      );
    }
  }, [
    applyState,
    cityVisible,
    hiddenWardIds,
    projectCategoryVisibility,
    projectLayerVisible,
    selectedWard,
  ]);

  const toggleCity = useCallback((visible: boolean) => {
    setCityVisible(visible);
    if (!visible) setCitySelected(false);
  }, []);
  const selectCity = useCallback(() => {
    clearMvtFeature();
    setCityVisible(true);
    setSelectedWard(null);
    setSelectedProject(null);
    setCitySelected(true);
  }, [clearMvtFeature]);
  const toggleAll = useCallback((visible: boolean) => {
    setHiddenWardIds(visible ? new Set() : new Set(wards.map((ward) => ward.id)));
    if (!visible) setSelectedWard(null);
  }, [wards]);
  const toggleWard = useCallback((id: string) => {
    setHiddenWardIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (selectedRef.current === id) setSelectedWard(null);
      }
      return next;
    });
  }, []);
  const selectWard = useCallback((ward: Ward) => {
    clearMvtFeature();
    setHiddenWardIds((current) => {
      if (!current.has(ward.id)) return current;
      const next = new Set(current);
      next.delete(ward.id);
      return next;
    });
    setCitySelected(false);
    setSelectedProject(null);
    setSelectedWard(ward);
    const feature = dataRef.current?.features.find(
      (item) => text(item.properties.publicWardId) === ward.id,
    );
    const bounds = geometryBounds(feature?.geometry);
    if (bounds && mapRef.current) focusBounds(mapRef.current, bounds, 13);
  }, [clearMvtFeature]);
  const toggleProjectLayer = useCallback((visible: boolean) => {
    setProjectLayerVisible(visible);
    if (!visible) setSelectedProject(null);
  }, []);
  const activateProjectLayer = useCallback(() => {
    clearMvtFeature();
    setProjectLayerVisible(true);
    setCitySelected(false);
    setSelectedWard(null);
    setSelectedProject(null);
  }, [clearMvtFeature]);
  const toggleProjectCategory = useCallback((id: ProjectCategoryId, visible: boolean) => {
    setProjectCategoryVisibility((current) => ({ ...current, [id]: visible }));
    setSelectedProject((current) => current?.categoryId === id && !visible ? null : current);
  }, []);
  const selectProject = useCallback((project: ProjectSearchItem) => {
    clearMvtFeature();
    setProjectLayerVisible(true);
    setProjectCategoryVisibility((current) => ({ ...current, [project.categoryId]: true }));
    setCitySelected(false);
    setSelectedWard(null);
    setSelectedProject(project);
    if (project.bounds && mapRef.current) {
      focusBounds(mapRef.current, project.bounds, 16);
    }
  }, [clearMvtFeature]);
  const clearSelection = useCallback(() => {
    setSelectedWard(null);
    setCitySelected(false);
    setSelectedProject(null);
    clearMvtFeature();
  }, [clearMvtFeature]);
  const toggleMvtLayer = useCallback((config: DynamicMapLayerConfig, visible: boolean) => {
    setVisibleMvtCollections((current) => {
      const next = new Set(current);
      if (visible) next.add(config.collectionKey);
        else next.delete(config.collectionKey);
      return next;
    });
  }, []);

  return {
    loading,
    error,
    wards,
    cityVisible,
    citySelected,
    hiddenWardIds,
    selectedWard,
    projectLayerVisible,
    projectCategoryVisibility,
    selectedProject,
    projects,
    mvtLayers: registry?.layers ?? [],
    visibleMvtCollections,
    selectedMvtFeature,
    toggleCity,
    selectCity,
    toggleAll,
    toggleWard,
    selectWard,
    toggleProjectLayer,
    activateProjectLayer,
    toggleProjectCategory,
    selectProject,
    clearSelection,
    toggleMvtLayer,
  };
}
