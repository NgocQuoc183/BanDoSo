export type GeometryType = "Point" | "LineString" | "Polygon";

export type DynamicMapLayerConfig = {
  collectionKey: string;
  menuGroup: string;
  collection: string;
  label: string;
  geometryTypes: GeometryType[];
  idField: string;
  geometryField: string;
  wardField?: string;
  titleFields: string[];
  searchableFields: string[];
  listFields: string[];
  detailFields: string[];
  // Nhãn tiếng Việt hiển thị thay cho tên field kỹ thuật trong panel chi tiết
  // (vd: "so_thu_tu_thua" -> "Số thửa"). Field không có trong bảng này rơi về
  // hiển thị nguyên tên field.
  fieldLabels?: Record<string, string>;
  // Dịch giá trị mã hoá sang chữ (vd: operation_status "1" -> "Bình thường").
  // Dùng object tra cứu thuần (không phải hàm) để registry vẫn nạp được từ
  // JSON ở production (xem loadMapRegistry).
  valueLabels?: Record<string, Record<string, string>>;
  // Với field lưu nguyên 1 JSON object (vd water_station_type: { desc, name }),
  // chỉ lấy đúng 1 property này ra để hiển thị thay vì in cả object thô.
  objectValueKey?: Record<string, string>;
  minZoom: number;
  maxZoom?: number;
  color: string;
  icon: string;
  sourceLayer: string;
  tileUrl: string;
  directusCollection: string;
  directusIdField: string;
  featureIdField: string;
  capabilities: {
    mvt: boolean;
    directus: boolean;
    list: boolean;
    detail: boolean;
    search: boolean;
    statistics: boolean;
  };
  dimensions: {
    wardField?: string;
    statusField?: string;
    updatedAtField?: string;
    managingUnitField?: string;
    measureFields: string[];
  };
};

export type SelectedMvtFeature = {
  config: DynamicMapLayerConfig;
  featureId: string | number | null;
  properties: Record<string, unknown>;
};


type Draft = Omit<DynamicMapLayerConfig, "collectionKey" | "menuGroup" | "collection" | "label" | "color" | "icon" | "sourceLayer" | "tileUrl" | "directusCollection" | "directusIdField" | "featureIdField" | "capabilities" | "dimensions">;
const layerConfig = (data: Draft): Draft => data;

const LOCAL_MVT_LAYER_REGISTRY: Array<Omit<DynamicMapLayerConfig, "collectionKey" | "menuGroup" | "sourceLayer" | "tileUrl" | "directusCollection" | "directusIdField" | "featureIdField" | "capabilities" | "dimensions">> = [
  { collection: "rain_water_stations", label: "Trạm đo mưa", color: "#1479c9", icon: "rainy", ...layerConfig({ geometryTypes: ["Point"], idField: "id", geometryField: "geom", wardField: "phuongxa", titleFields: ["name", "code"], searchableFields: ["name", "code", "address"], listFields: ["name", "code", "address"], detailFields: ["name", "code", "number", "address", "altitude", "waterStationType", "city", "area"], minZoom: 10, maxZoom : 12 }) },
  // water_station_type lưu dạng JSON object { desc, name } (vd { desc: "Tháp báo lũ",
  // name: "flood_3m" }) — chỉ hiển thị "desc", không in nguyên object.
  { collection: "water_level_station", label: "Trạm đo mực nước", color: "#0f9b8e", icon: "water", ...layerConfig({ geometryTypes: ["Point"], idField: "id", geometryField: "geom", titleFields: ["name", "code"], searchableFields: ["name", "code", "address"], listFields: ["name", "code", "address"], detailFields: ["name", "code", "number", "address", "altitude", "water_station_type", "city", "area"], objectValueKey: { water_station_type: "desc" }, minZoom: 10, maxZoom : 12 }) },
  { collection: "iot_wind_station", label: "Trạm đo gió IoT", color: "#805ad5", icon: "air", ...layerConfig({ geometryTypes: ["Point"], idField: "id", geometryField: "geom", titleFields: ["name", "code"], searchableFields: ["name", "code", "address"], listFields: ["name", "code", "address"], detailFields: ["name", "code", "number", "address", "altitude", "city", "area"], minZoom: 10, maxZoom : 12 }) },
  // Field thật của "bts" (kiểm tra qua /fields/bts): station_code/provider/tower_type/
  // operation_status — không có ten_tram/ma_tram/chu_so_huu như cấu hình cũ (không tồn tại).
  { collection: "bts", label: "Trạm BTS", color: "#e16d2d", icon: "settings_input_antenna", ...layerConfig({ geometryTypes: ["Point"], idField: "id", geometryField: "geom", titleFields: ["station_code"], searchableFields: ["station_code", "provider"], listFields: ["station_code", "provider", "tower_type"], detailFields: ["station_code", "provider", "tower_type", "operation_status"], valueLabels: { operation_status: { "1": "Bình thường", "2": "Ngừng hoạt động" } }, minZoom: 10, maxZoom : 12 }) },
  { collection: "thua_dat", label: "Thửa đất", color: "#c58a12", icon: "landscape", ...layerConfig({ geometryTypes: ["Polygon"], idField: "id", geometryField: "geom", wardField: "ma_xa", titleFields: ["so_thu_tu_thua", "so_hieu_to_ban_do"], searchableFields: ["so_thu_tu_thua", "so_hieu_to_ban_do", "chu_so_huu", "dia_chi", "ten_xa"], listFields: ["so_thu_tu_thua", "so_hieu_to_ban_do", "dien_tich", "muc_dich_su_dung", "chu_so_huu"], detailFields: ["so_thu_tu_thua", "so_hieu_to_ban_do", "dien_tich", "muc_dich_su_dung", "chu_so_huu", "dia_chi", "ten_xa", "ma_xa", "co_giay_phep", "ghi_chu"], minZoom: 14, maxZoom : 18 }) },
  ...([
    ["gisportal_HienTrangKhuCongNghiep_P", "Hiện trạng Khu công nghiệp", "#d44b36", ["loaihinh", "chuquanly", "thoihanhoatdong", "tylelapday", "loaihientrang", "nam"]],
    ["gisportal_DinhHuongPhatTrienKhuCongNghiep_P", "Định hướng phát triển Khu công nghiệp", "#e16d2d", ["loaihinh", "loaiquyhoach", "quyhoachbatdau", "quyhoachketthuc"]],
    ["gisportal_DinhHuongKhuCongNgheCao_P", "Định hướng Khu công nghệ cao", "#a04a9c", ["loaiquyhoach", "quyhoachbatdau", "quyhoachketthuc"]],
    ["gisportal_HienTrangCoSoKHCN_P", "Hiện trạng Cơ sở KH&CN", "#2877b9", ["phanloai", "loaihientrang", "nam"]],
    ["gisportal_DinhHuongCoSoKHCN_P", "Định hướng Cơ sở KH&CN", "#3e8fc8", ["phanloai", "loaiquyhoach", "quyhoachbatdau", "quyhoachketthuc"]],
    ["gisportal_HienTrangKhuXuLyChatThai_P", "Hiện trạng Khu xử lý chất thải", "#5c9f3e", ["loaichatthai", "hinhthucxuly", "phanloai", "congsuat", "loaihientrang", "nam"]],
    ["gisportal_DinhHuongKhuXuLyChatThai_P", "Định hướng Khu xử lý chất thải", "#8aac45", ["loaichatthai", "hinhthucxuly", "phanloai", "congsuat", "loaiquyhoach", "quyhoachbatdau", "quyhoachketthuc"]],
    ["gisportal_HienTrangNghiaTrang_P", "Hiện trạng Nghĩa trang", "#6e7784", ["hinhthuctang", "loaihientrang", "nam"]],
    ["gisportal_DinhHuongNghiaTrang_P", "Định hướng Nghĩa trang", "#8b7d56", ["hinhthuctang", "loaiquyhoach", "quyhoachbatdau", "quyhoachketthuc"]],
  ] as Array<[string, string, string, string[]]>).map(([collection, label, color, extraFields]) => ({
    collection, label, color, icon: "map", geometryTypes: ["Point"] as GeometryType[], idField: "objectid", geometryField: "geom", titleFields: ["ten"], searchableFields: ["ten", "madoituong", "diadiem", ...extraFields], listFields: ["ten", "diadiem", "dientich"], detailFields: ["ten", "madoituong", "dientich", "diadiem", ...extraFields, "nguon"], minZoom: 9,
  })),
];

// Nhãn tiếng Việt dùng chung cho mọi collection MVT cục bộ — cùng 1 tên field
// (vd "nam", "dien_tich") mang cùng ý nghĩa ở các collection khác nhau nên chỉ
// cần 1 bảng tra cứu duy nhất thay vì lặp lại cho từng layer.
const FIELD_LABELS: Record<string, string> = {
  // Trường lặp lại ở nhóm gisportal_*
  ten: "Tên đối tượng",
  madoituong: "Mã dữ liệu",
  dientich: "Diện tích",
  diadiem: "Địa điểm",
  nguon: "Nguồn dữ liệu",
  loaihinh: "Loại hình",
  chuquanly: "Chủ quản lý",
  thoihanhoatdong: "Thời hạn hoạt động",
  tylelapday: "Tỷ lệ lấp đầy",
  loaihientrang: "Loại hiện trạng",
  nam: "Năm",
  loaiquyhoach: "Loại quy hoạch",
  quyhoachbatdau: "Quy hoạch bắt đầu",
  quyhoachketthuc: "Quy hoạch kết thúc",
  phanloai: "Phân loại",
  loaichatthai: "Loại chất thải",
  hinhthucxuly: "Hình thức xử lý",
  congsuat: "Công suất",
  hinhthuctang: "Hình thức táng",
  // Trạm quan trắc (mưa/mực nước/gió)
  name: "Tên trạm",
  code: "Mã trạm",
  number: "Số điện thoại",
  address: "Địa chỉ",
  altitude: "Độ cao",
  waterStationType: "Loại trạm",
  water_station_type: "Loại trạm",
  city: "Thành phố",
  area: "Khu vực",
  // Trạm BTS
  station_code: "Mã trạm",
  provider: "Nhà mạng",
  tower_type: "Loại cột ăng-ten",
  operation_status: "Trạng thái hoạt động",
  // Thửa đất
  so_thu_tu_thua: "Số thửa",
  so_hieu_to_ban_do: "Số tờ bản đồ",
  dien_tich: "Diện tích",
  muc_dich_su_dung: "Mục đích sử dụng",
  chu_so_huu: "Chủ sử dụng",
  dia_chi: "Địa chỉ",
  ten_xa: "Phường, xã",
  ma_xa: "Mã xã",
  co_giay_phep: "Có giấy phép",
  ghi_chu: "Ghi chú",
};

export type MapRegistrySnapshot = {
  schemaVersion: number;
  registryVersion: string;
  publishedAt: string;
  layers: DynamicMapLayerConfig[];
};

const DEFAULT_TILE_URL = "https://dcu.huecity.vn/mvt/{z}/{x}/{y}.mvt?collections=";

function localLayerConfig(layer: typeof LOCAL_MVT_LAYER_REGISTRY[number]): DynamicMapLayerConfig {
  return {
    ...layer,
    collectionKey: layer.collection,
    menuGroup: "data",
    sourceLayer: layer.collection,
    tileUrl: `${DEFAULT_TILE_URL}${encodeURIComponent(layer.collection)}`,
    directusCollection: layer.collection,
    directusIdField: layer.idField,
    featureIdField: layer.idField,
    fieldLabels: FIELD_LABELS,
    capabilities: { mvt: true, directus: true, list: true, detail: true, search: true, statistics: false },
    dimensions: { wardField: layer.wardField, measureFields: [] },
  };
}

export const LOCAL_MAP_REGISTRY: MapRegistrySnapshot = {
  schemaVersion: 1,
  registryVersion: "local-development",
  publishedAt: new Date(0).toISOString(),
  layers: LOCAL_MVT_LAYER_REGISTRY.map(localLayerConfig),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown, field: string, collectionKey: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new Error(`Registry ${collectionKey}: ${field} phải là mảng chuỗi không rỗng.`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Registry thiếu ${field}.`);
  return value;
}

function validateLayer(value: unknown): DynamicMapLayerConfig {
  if (!isRecord(value)) throw new Error("Registry layer không hợp lệ.");
  const collectionKey = requiredString(value.collectionKey, "collectionKey");
  const collection = requiredString(value.directusCollection, "Directus collection");
  const sourceLayer = requiredString(value.sourceLayer, "MVT source-layer");
  const featureIdField = requiredString(value.featureIdField, "MVT feature ID");
  if (value.directusIdField !== featureIdField) {
    throw new Error(`Registry ${collectionKey}: feature ID MVT phải ánh xạ đúng ID Directus.`);
  }
  const geometryTypes = stringArray(value.geometryTypes, "geometryTypes", collectionKey) as DynamicMapLayerConfig["geometryTypes"];
  if (!geometryTypes.every((type) => ["Point", "LineString", "Polygon"].includes(type))) {
    throw new Error(`Registry ${collectionKey}: geometry type không được hỗ trợ.`);
  }
  const capabilities = isRecord(value.capabilities) ? value.capabilities : {};
  if (capabilities.mvt !== true || capabilities.directus !== true) {
    throw new Error(`Registry ${collectionKey}: MVT và Directus phải được publish.`);
  }
  const dimensions = isRecord(value.dimensions) ? value.dimensions : {};
  const optionalString = (item: unknown) => typeof item === "string" && item.trim() ? item : undefined;
  return {
    collectionKey,
    menuGroup: typeof value.menuGroup === "string" ? value.menuGroup : "data",
    collection,
    label: typeof value.label === "string" && value.label.trim() ? value.label : collectionKey,
    geometryTypes,
    idField: featureIdField,
    geometryField: typeof value.geometryField === "string" ? value.geometryField : "geom",
    wardField: optionalString(value.wardField),
    titleFields: stringArray(value.titleFields, "titleFields", collectionKey),
    searchableFields: stringArray(value.searchableFields, "searchableFields", collectionKey),
    listFields: stringArray(value.listFields, "listFields", collectionKey),
    detailFields: stringArray(value.detailFields, "detailFields", collectionKey),
    fieldLabels: isRecord(value.fieldLabels)
      ? Object.fromEntries(Object.entries(value.fieldLabels).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : undefined,
    valueLabels: isRecord(value.valueLabels)
      ? Object.fromEntries(
        Object.entries(value.valueLabels)
          .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
          .map(([field, choices]) => [field, Object.fromEntries(Object.entries(choices).filter((entry): entry is [string, string] => typeof entry[1] === "string"))]),
      )
      : undefined,
    minZoom: typeof value.minZoom === "number" ? value.minZoom : 0,
    maxZoom: typeof value.maxZoom === "number" ? value.maxZoom : undefined,
    color: typeof value.color === "string" ? value.color : "#0878bd",
    icon: typeof value.icon === "string" ? value.icon : "map",
    sourceLayer,
    tileUrl: typeof value.tileUrl === "string" && value.tileUrl.trim() ? value.tileUrl : DEFAULT_TILE_URL,
    directusCollection: collection,
    directusIdField: featureIdField,
    featureIdField,
    capabilities: {
      mvt: capabilities.mvt === true,
      directus: capabilities.directus === true,
      list: capabilities.list === true,
      detail: capabilities.detail === true,
      search: capabilities.search === true,
      statistics: capabilities.statistics === true,
    },
    dimensions: {
      wardField: optionalString(dimensions.wardField),
      statusField: optionalString(dimensions.statusField),
      updatedAtField: optionalString(dimensions.updatedAtField),
      managingUnitField: optionalString(dimensions.managingUnitField),
      measureFields: Array.isArray(dimensions.measureFields) && dimensions.measureFields.every((item) => typeof item === "string") ? dimensions.measureFields : [],
    },
  };
}

export function validateMapRegistry(value: unknown): MapRegistrySnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.registryVersion !== "string" || !Array.isArray(value.layers)) {
    throw new Error("Map registry không đúng schema hoặc chưa được publish.");
  }
  const layers = value.layers.map(validateLayer);
  const keys = new Set<string>();
  for (const layer of layers) {
    if (keys.has(layer.collectionKey)) throw new Error(`Registry trùng collectionKey: ${layer.collectionKey}.`);
    keys.add(layer.collectionKey);
  }
  return {
    schemaVersion: 1,
    registryVersion: value.registryVersion,
    publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : "",
    layers,
  };
}

export async function loadMapRegistry(): Promise<MapRegistrySnapshot> {
  if (import.meta.env.DEV && (import.meta.env.VITE_MAP_REGISTRY_MODE === "local" || !import.meta.env.VITE_MAP_REGISTRY_URL)) {
    return LOCAL_MAP_REGISTRY;
  }
  const url = import.meta.env.VITE_MAP_REGISTRY_URL ?? "/api/map-registry/v1/registry.json";
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Không tải được map registry (${response.status}).`);
  return validateMapRegistry(payload);
}

export const mvtSourceId = (collection: string) => `mvt-${collection}-source`;
export const mvtFillLayerId = (collection: string) => `mvt-${collection}-fill`;
export const mvtLineLayerId = (collection: string) => `mvt-${collection}-line`;
export const mvtPointLayerId = (collection: string) => `mvt-${collection}-point`;
// Icon điểm là ảnh bitmap thường (không phải SDF) nên icon-color/icon-halo của
// MapLibre không tô được; dùng 1 layer circle riêng làm vòng tròn nổi bật khi
// feature đó được chọn (feature-state "selected"), vẽ dưới icon.
export const mvtPointHaloLayerId = (collection: string) => `mvt-${collection}-halo`;
