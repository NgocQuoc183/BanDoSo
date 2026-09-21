import type { CatalogRecord, CollectionDashboardConfig } from "./directusClient";

// chu_so_huu là mảng JSON [{ ho_ten, dia_chi, ... }] (1 thửa có thể nhiều đồng sở
// hữu) — hiển thị trực tiếp sẽ ra "[object Object]", gộp về danh sách tên.
function ownerLabel(item: CatalogRecord): string {
  const raw = item.chu_so_huu;
  if (!Array.isArray(raw) || raw.length === 0) return "-";
  const names = raw
    .map((owner) => (owner && typeof owner === "object" ? String((owner as Record<string, unknown>).ho_ten ?? "") : ""))
    .filter(Boolean);
  return names.length ? names.join(", ") : "-";
}

function booleanLabel(field: string) {
  return (item: CatalogRecord): string => {
    const value = item[field];
    if (value === true) return "Có";
    if (value === false) return "Không";
    return "-";
  };
}

// Không có render riêng thì bảng hiện thẳng chuỗi ISO thô (vd "2026-09-03T17:26:12.979Z").
function dateTimeLabel(field: string) {
  return (item: CatalogRecord): string => {
    const raw = item[field];
    if (!raw || typeof raw !== "string") return "-";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
}

// quyhoachbatdau/quyhoachketthuc chỉ là mốc ngày (không có giờ phút), nên dùng
// định dạng ngày thuần thay vì dateTimeLabel để khỏi hiện "00:00" vô nghĩa.
function dateLabel(field: string) {
  return (item: CatalogRecord): string => {
    const raw = item[field];
    if (!raw || typeof raw !== "string") return "-";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
  };
}

export const LAND_CONFIG: CollectionDashboardConfig = {
  title: "Đất đai, địa chính", kicker: "Đất đai", description: "Tra cứu danh sách và thông tin thửa đất.", searchPlaceholder: "Tìm số thửa, địa chỉ...", icon: "dataset", color: "#2d9b68", collections: [{
    collection: "thua_dat", label: "Thửa đất", fields: ["id", "so_thu_tu_thua", "so_hieu_to_ban_do", "dia_chi", "ma_xa", "ten_xa", "dien_tich", "muc_dich_su_dung", "chu_so_huu", "co_giay_phep", "ghi_chu", "date_updated"],
    columns: [{ field: "so_thu_tu_thua", label: "Số thửa", width: "6.5rem" }, { field: "dia_chi", label: "Địa chỉ" }, { field: "ten_xa", label: "Phường, xã", width: "9rem" }, { field: "dien_tich", label: "Diện tích", width: "7rem" }, { field: "muc_dich_su_dung", label: "Mục đích sử dụng", width: "9rem", tone: () => "neutral" }, { field: "date_updated", label: "Cập nhật cuối", width: "9.5rem", render: dateTimeLabel("date_updated") }],
    detailFields: [{ field: "so_thu_tu_thua", label: "Số thửa" }, { field: "so_hieu_to_ban_do", label: "Số tờ bản đồ" }, { field: "dia_chi", label: "Địa chỉ" }, { field: "ma_xa", label: "Mã xã" }, { field: "ten_xa", label: "Tên xã" }, { field: "dien_tich", label: "Diện tích" }, { field: "muc_dich_su_dung", label: "Mục đích sử dụng" }, { field: "chu_so_huu", label: "Chủ sử dụng", render: ownerLabel }, { field: "co_giay_phep", label: "Giấy phép", render: booleanLabel("co_giay_phep") }, { field: "date_updated", label: "Cập nhật cuối", render: dateTimeLabel("date_updated") }, { field: "ghi_chu", label: "Ghi chú" }], titleField: "so_thu_tu_thua", searchFields: ["so_thu_tu_thua", "so_hieu_to_ban_do", "dia_chi", "ma_xa", "ten_xa"], filterField: "ten_xa", filterLabel: "Phường, xã", geometryField: "geom",
  }],
};

const planningFields = ["objectid", "madoituong", "ten", "dientich", "diadiem", "loaiquyhoach", "quyhoachbatdau", "quyhoachketthuc", "nguon"];
const planningColumns = [{ field: "madoituong", label: "Mã dữ liệu" }, { field: "ten", label: "Tên đối tượng" }, { field: "diadiem", label: "Địa điểm" }, { field: "dientich", label: "Diện tích" }, { field: "loaiquyhoach", label: "Loại quy hoạch" }, { field: "quyhoachketthuc", label: "Kết thúc", render: dateLabel("quyhoachketthuc") }];

export const PLANNING_CONFIG: CollectionDashboardConfig = {
  title: "Quy hoạch chuyên ngành", kicker: "Quy hoạch", description: "Tra cứu các lớp dữ liệu định hướng và quy hoạch chuyên ngành.", searchPlaceholder: "Tìm mã, tên, địa điểm...", icon: "map", color: "#3a78c2", collections: [
    { collection: "gisportal_DinhHuongPhatTrienKhuCongNghiep_P", label: "Khu công nghiệp định hướng", fields: planningFields, columns: planningColumns, detailFields: planningColumns, titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "loaiquyhoach"], filterField: "loaiquyhoach", filterLabel: "Loại quy hoạch", geometryField: "geom", idField: "objectid" },
    { collection: "gisportal_DinhHuongKhuXuLyChatThai_P", label: "Khu xử lý chất thải định hướng", fields: [...planningFields, "loaichatthai", "hinhthucxuly", "congsuat"], columns: [...planningColumns.slice(0, 3), { field: "loaichatthai", label: "Loại chất thải" }, { field: "congsuat", label: "Công suất" }, planningColumns[5]], detailFields: [...planningColumns, { field: "loaichatthai", label: "Loại chất thải" }, { field: "hinhthucxuly", label: "Hình thức xử lý" }, { field: "congsuat", label: "Công suất" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "loaichatthai"], filterField: "loaiquyhoach", filterLabel: "Loại quy hoạch", geometryField: "geom", idField: "objectid" },
    { collection: "gisportal_DinhHuongNghiaTrang_P", label: "Nghĩa trang định hướng", fields: [...planningFields, "hinhthuctang"], columns: [...planningColumns.slice(0, 3), { field: "hinhthuctang", label: "Hình thức táng" }, planningColumns[5]], detailFields: [...planningColumns, { field: "hinhthuctang", label: "Hình thức táng" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "hinhthuctang"], filterField: "loaiquyhoach", filterLabel: "Loại quy hoạch", geometryField: "geom", idField: "objectid" },
    { collection: "gisportal_DinhHuongKhuCongNgheCao_P", label: "Khu công nghệ cao", fields: planningFields, columns: planningColumns, detailFields: planningColumns, titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "loaiquyhoach"], filterField: "loaiquyhoach", filterLabel: "Loại quy hoạch", geometryField: "geom", idField: "objectid" },
    { collection: "gisportal_DinhHuongCoSoKHCN_P", label: "Cơ sở KH&CN định hướng", fields: [...planningFields, "phanloai"], columns: [...planningColumns.slice(0, 3), { field: "phanloai", label: "Phân loại" }, planningColumns[5]], detailFields: [...planningColumns, { field: "phanloai", label: "Phân loại" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "phanloai"], filterField: "loaiquyhoach", filterLabel: "Loại quy hoạch", geometryField: "geom", idField: "objectid" },
  ],
};

const currentFields = ["objectid", "madoituong", "ten", "dientich", "diadiem", "loaihientrang", "nam", "nguon"];
export const ENVIRONMENT_CONFIG: CollectionDashboardConfig = { title: "Môi trường", kicker: "Hiện trạng", description: "Tra cứu hiện trạng khu công nghiệp, khu xử lý chất thải và nghĩa trang.", searchPlaceholder: "Tìm mã, tên, địa điểm...", icon: "eco", color: "#2d9b68", collections: [
  { collection: "gisportal_HienTrangKhuCongNghiep_P", label: "Khu công nghiệp hiện trạng", fields: [...currentFields, "loaihinh", "chuquanly", "tylelapday"], columns: [{ field: "madoituong", label: "Mã" }, { field: "ten", label: "Tên" }, { field: "diadiem", label: "Địa điểm" }, { field: "dientich", label: "Diện tích" }, { field: "loaihientrang", label: "Hiện trạng" }, { field: "tylelapday", label: "Tỷ lệ lấp đầy" }], detailFields: [...currentFields, { field: "loaihinh", label: "Loại hình" }, { field: "chuquanly", label: "Chủ quản lý" }, { field: "tylelapday", label: "Tỷ lệ lấp đầy" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "loaihientrang"], filterField: "loaihientrang", filterLabel: "Hiện trạng", geometryField: "geom", idField: "objectid" },
  { collection: "gisportal_HienTrangKhuXuLyChatThai_P", label: "Khu xử lý chất thải hiện trạng", fields: [...currentFields, "loaichatthai", "hinhthucxuly", "congsuat"], columns: [{ field: "madoituong", label: "Mã" }, { field: "ten", label: "Tên" }, { field: "diadiem", label: "Địa điểm" }, { field: "loaichatthai", label: "Loại chất thải" }, { field: "congsuat", label: "Công suất" }, { field: "loaihientrang", label: "Hiện trạng" }], detailFields: [...currentFields, { field: "loaichatthai", label: "Loại chất thải" }, { field: "hinhthucxuly", label: "Hình thức xử lý" }, { field: "congsuat", label: "Công suất" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "loaichatthai"], filterField: "loaihientrang", filterLabel: "Hiện trạng", geometryField: "geom", idField: "objectid" },
  { collection: "gisportal_HienTrangNghiaTrang_P", label: "Nghĩa trang hiện trạng", fields: [...currentFields, "hinhthuctang"], columns: [{ field: "madoituong", label: "Mã" }, { field: "ten", label: "Tên" }, { field: "diadiem", label: "Địa điểm" }, { field: "dientich", label: "Diện tích" }, { field: "hinhthuctang", label: "Hình thức táng" }, { field: "loaihientrang", label: "Hiện trạng" }], detailFields: [...currentFields, { field: "hinhthuctang", label: "Hình thức táng" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "hinhthuctang"], filterField: "loaihientrang", filterLabel: "Hiện trạng", geometryField: "geom", idField: "objectid" },
] };

// 3 collection trạm không cùng schema: "phuongxa" (quan hệ m2o) chỉ tồn tại ở
// rain_water_stations và luôn null trong dữ liệu thật; yêu cầu field này ở 2
// collection còn lại khiến Directus trả lỗi 403 cho toàn bộ query. Dữ liệu
// phường/xã thực tế nằm ở field "area" (có ở cả 3, "city" luôn cố định "Thành
// phố Huế" nên không dùng để lọc được) — dùng "area" thống nhất cho cả 3.
const stationFields = ["id", "code", "name", "number", "address", "altitude", "area"];
const stationColumns = [{ field: "code", label: "Mã trạm" }, { field: "name", label: "Tên trạm" }, { field: "address", label: "Địa chỉ" }, { field: "area", label: "Khu vực" }, { field: "altitude", label: "Độ cao" }];

// Cùng khái niệm "loại trạm" nhưng tên field và kiểu dữ liệu khác nhau giữa các
// collection: rain_water_stations.waterStationType là chuỗi (camelCase), còn
// water_level_station.water_station_type là JSON object { desc, name }. Gộp về
// 1 cách hiển thị để tránh in ra "[object Object]".
function stationTypeLabel(item: CatalogRecord): string {
  const raw = item.waterStationType ?? item.water_station_type;
  if (raw === null || raw === undefined || raw === "") return "-";
  if (typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    return String(value.desc ?? value.name ?? "-");
  }
  return String(raw);
}

export const MONITORING_CONFIG: CollectionDashboardConfig = { title: "Trạm quan trắc IoT", kicker: "Quan trắc", description: "Danh sách các trạm đo mưa, mực nước và gió IoT.", searchPlaceholder: "Tìm mã trạm, tên, địa chỉ...", icon: "sensors", color: "#d28a27", collections: [
  { collection: "rain_water_stations", label: "Trạm đo mưa", fields: [...stationFields, "waterStationType"], columns: [...stationColumns, { field: "waterStationType", label: "Loại trạm", render: stationTypeLabel }], detailFields: [...stationFields.map((field) => ({ field, label: field })), { field: "waterStationType", label: "Loại trạm", render: stationTypeLabel }], titleField: "name", searchFields: ["code", "name", "address", "area"], filterField: "area", filterLabel: "Khu vực", geometryField: "geom" },
  { collection: "water_level_station", label: "Trạm đo mực nước", fields: [...stationFields, "water_station_type"], columns: [...stationColumns, { field: "water_station_type", label: "Loại trạm", render: stationTypeLabel }], detailFields: [...stationFields.map((field) => ({ field, label: field })), { field: "water_station_type", label: "Loại trạm", render: stationTypeLabel }], titleField: "name", searchFields: ["code", "name", "address", "area"], filterField: "area", filterLabel: "Khu vực", geometryField: "geom" },
  { collection: "iot_wind_station", label: "Trạm đo gió IoT", fields: stationFields, columns: stationColumns, detailFields: stationFields.map((field) => ({ field, label: field })), titleField: "name", searchFields: ["code", "name", "address", "area"], filterField: "area", filterLabel: "Khu vực", geometryField: "geom" },
] };

export const SCIENCE_CONFIG: CollectionDashboardConfig = { title: "Khoa học và công nghệ", kicker: "Khoa học & công nghệ", description: "Tra cứu khu công nghệ cao và cơ sở khoa học công nghệ.", searchPlaceholder: "Tìm mã, tên, địa điểm...", icon: "science", color: "#8260c6", collections: [
  { collection: "gisportal_DinhHuongKhuCongNgheCao_P", label: "Khu công nghệ cao", fields: planningFields, columns: planningColumns, detailFields: planningColumns, titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "loaiquyhoach"], filterField: "loaiquyhoach", filterLabel: "Loại quy hoạch", geometryField: "geom", idField: "objectid" },
  { collection: "gisportal_HienTrangCoSoKHCN_P", label: "Cơ sở KH&CN hiện trạng", fields: [...currentFields, "phanloai"], columns: [{ field: "madoituong", label: "Mã" }, { field: "ten", label: "Tên" }, { field: "diadiem", label: "Địa điểm" }, { field: "phanloai", label: "Phân loại" }, { field: "loaihientrang", label: "Hiện trạng" }, { field: "nam", label: "Năm" }], detailFields: [...currentFields, { field: "phanloai", label: "Phân loại" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "phanloai"], filterField: "loaihientrang", filterLabel: "Hiện trạng", geometryField: "geom", idField: "objectid" },
  { collection: "gisportal_DinhHuongCoSoKHCN_P", label: "Cơ sở KH&CN định hướng", fields: [...planningFields, "phanloai"], columns: [{ field: "madoituong", label: "Mã" }, { field: "ten", label: "Tên" }, { field: "diadiem", label: "Địa điểm" }, { field: "phanloai", label: "Phân loại" }, { field: "loaiquyhoach", label: "Quy hoạch" }, { field: "quyhoachketthuc", label: "Kết thúc", render: dateLabel("quyhoachketthuc") }], detailFields: [...planningColumns, { field: "phanloai", label: "Phân loại" }], titleField: "ten", searchFields: ["madoituong", "ten", "diadiem", "phanloai"], filterField: "loaiquyhoach", filterLabel: "Loại quy hoạch", geometryField: "geom", idField: "objectid" },
] };

// Field thật của "bts" khác hoàn toàn field từng cấu hình trước đó (đã kiểm
// tra qua /fields/bts): không có code/name/address/city. "operation_status" và
// "disabled_reason" là field mã hoá có bảng nhãn riêng (meta.options.choices)
// trong Directus; "ward" là quan hệ m2o sang administrative_ward, resolve tên
// thật qua field ảo "ward.name". "station_type" là JSON array [{type,radius}].
const BTS_STATUS_LABELS: Record<string, string> = { "1": "Bình thường", "2": "Ngừng hoạt động" };
function btsStatusLabel(item: CatalogRecord): string {
  const raw = item.operation_status;
  return typeof raw === "string" ? (BTS_STATUS_LABELS[raw] ?? raw) : "-";
}
function btsStatusTone(item: CatalogRecord): "success" | "danger" | "neutral" {
  const raw = item.operation_status;
  if (raw === "1") return "success";
  if (raw === "2") return "danger";
  return "neutral";
}
function btsWardLabel(item: CatalogRecord): string {
  const ward = item.ward;
  return ward && typeof ward === "object" ? String((ward as Record<string, unknown>).name ?? "-") : "-";
}
function btsStationTypeLabel(item: CatalogRecord): string {
  const raw = item.station_type;
  if (!Array.isArray(raw)) return "-";
  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") return String(entry);
    const value = entry as Record<string, unknown>;
    return value.radius ? `${String(value.type).toUpperCase()} (${value.radius}m)` : String(value.type).toUpperCase();
  }).join(", ") || "-";
}
function btsBoolLabel(value: unknown): string {
  return value === true ? "Có" : value === false ? "Không" : "-";
}

export const TELECOM_CONFIG: CollectionDashboardConfig = { title: "Hạ tầng viễn thông", kicker: "Viễn thông", description: "Tra cứu dữ liệu trạm BTS.", searchPlaceholder: "Tìm mã trạm, nhà mạng...", icon: "cell_tower", color: "#8260c6", collections: [{
  collection: "bts", label: "Trạm BTS",
  fields: ["id", "station_code", "provider", "tower_type", "station_type", "operation_status", "ward.name", "backup_power_battery", "backup_power_alternator"],
  columns: [
    { field: "station_code", label: "Mã trạm" },
    { field: "provider", label: "Nhà mạng" },
    { field: "tower_type", label: "Loại cột" },
    { field: "ward", label: "Phường, xã", render: btsWardLabel },
    { field: "operation_status", label: "Trạng thái", render: btsStatusLabel, tone: btsStatusTone },
  ],
  detailFields: [
    { field: "station_code", label: "Mã trạm" },
    { field: "provider", label: "Nhà mạng" },
    { field: "tower_type", label: "Loại cột ăng-ten" },
    { field: "station_type", label: "Công nghệ phủ sóng", render: btsStationTypeLabel },
    { field: "operation_status", label: "Trạng thái hoạt động", render: btsStatusLabel },
    { field: "ward", label: "Phường, xã", render: btsWardLabel },
    { field: "backup_power_battery", label: "Pin dự phòng", render: (item) => btsBoolLabel(item.backup_power_battery) },
    { field: "backup_power_alternator", label: "Máy phát dự phòng", render: (item) => btsBoolLabel(item.backup_power_alternator) },
  ],
  titleField: "station_code",
  searchFields: ["station_code", "provider"],
  filterField: "provider", filterLabel: "Nhà mạng",
  geometryField: "geom",
}] };