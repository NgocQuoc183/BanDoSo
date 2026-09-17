
import type { DirectusCollection } from "./directusCollections";
export type CatalogRecord = { id?: string | number; [key: string]: unknown };
// `render` cho phép chuẩn hoá field lưu khác tên/khác kiểu giữa các collection
// (vd: JSON object ở collection này, chuỗi thường ở collection khác) về cùng 1 cách hiển thị.
export type CatalogColumn = { field: string; label: string; render?: (item: CatalogRecord) => string };
export type CatalogDetailField = string | { field: string; label: string; render?: (item: CatalogRecord) => string };
export type CatalogCollectionConfig = {
  collection: string;
  label: string;
  fields: string[];
  columns: CatalogColumn[];
  detailFields: CatalogDetailField[];
  titleField: string;
  searchFields: string[];
  filterField?: string;
  filterLabel?: string;
  filterOptions?: string[];
  // Có field hình học (thường "geom") thì mới xem trước trên mini-map / bay tới bản đồ chính được.
  geometryField?: string;
  // Khoá chính thật trong Directus không phải lúc nào cũng là "id" (vd các
  // collection gisportal_* dùng "objectid") — thiếu field này thì mọi thao tác
  // theo bản ghi (chọn dòng, xem hình học, "Định vị trên bản đồ") đều gãy vì
  // item.id luôn undefined.
  idField?: string;
};
export type CollectionDashboardConfig = {
  title: string;
  kicker: string;
  description: string;
  searchPlaceholder: string;
  icon: string;
  color: string;
  collections: CatalogCollectionConfig[];
};

export type CollectionCheck = {
  collection: DirectusCollection;
  status: number | null;
  ok: boolean;
  fields: string[];
  message: string;
};

type DirectusResponse = { data?: Array<Record<string, unknown>>; errors?: Array<{ message?: string }> };

// Mọi request đi qua proxy cùng origin (xem server/index.mjs và vite.config.ts);
// token Directus chỉ tồn tại phía server, không bao giờ vào bundle trình duyệt.
const baseUrl = "/api/directus";

export async function checkCollection(collection: DirectusCollection): Promise<CollectionCheck> {
  try {
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?limit=1`);
    const payload = await response.json().catch(() => ({})) as DirectusResponse;
    if (!response.ok) {
      return {
        collection,
        status: response.status,
        ok: false,
        fields: [],
        message: payload.errors?.[0]?.message ?? response.statusText ?? "Yêu cầu bị từ chối.",
      };
    }
    const record = payload.data?.[0];
    return {
      collection,
      status: response.status,
      ok: true,
      fields: record ? Object.keys(record) : [],
      message: record ? "Đọc được một bản ghi mẫu." : "Token hợp lệ, nhưng collection chưa có bản ghi.",
    };
  } catch (error) {
    return {
      collection,
      status: null,
      ok: false,
      fields: [],
      message: error instanceof Error ? error.message : "Không thể kết nối tới Directus.",
    };
  }
}

export async function countCollection(collection: DirectusCollection): Promise<number | null> {
  try {
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?aggregate[count]=*&limit=0`);
    if (response.ok) {
      const payload = await response.json() as {
        data?: Array<Record<string, unknown>>;
        meta?: { total_count?: number };
      };
      const aggregateCount = payload.data?.[0]?.count;
      if (typeof aggregateCount === "number") return aggregateCount;
      if (typeof aggregateCount === "string" && Number.isFinite(Number(aggregateCount))) return Number(aggregateCount);
      if (typeof payload.meta?.total_count === "number") return payload.meta.total_count;
    }

    // Some Directus roles can read items but cannot use aggregate queries.
    const fallback = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?limit=1&meta=total_count`);
    if (!fallback.ok) return null;
    const payload = await fallback.json() as { meta?: { total_count?: number } };
    return typeof payload.meta?.total_count === "number" ? payload.meta.total_count : null;
  } catch {
    return null;
  }
}

export type CollectionRecordsQuery = {
  collection: string;
  fields: string[];
  search?: string;
  searchFields: string[];
  filterField?: string;
  filterValue?: string;
  page: number;
  limit: number;
};

export async function fetchCollectionRecords(
  query: CollectionRecordsQuery,
  signal?: AbortSignal,
): Promise<{ items: CatalogRecord[]; total: number | null }> {
  // "total_count" bỏ qua filter/search hiện tại (luôn là tổng cả collection);
  // "filter_count" mới là số khớp với filter/search đang áp dụng — dùng cái này
  // để phân trang và hiển thị "tổng số kết quả" đúng với những gì đang lọc.
  const params = new URLSearchParams({ limit: String(query.limit), offset: String((query.page - 1) * query.limit), meta: "filter_count", fields: query.fields.join(",") });
  if (query.filterField && query.filterValue) params.set(`filter[${query.filterField}][_icontains]`, query.filterValue);
  if (query.search?.trim()) query.searchFields.forEach((field, index) => params.set(`filter[_or][${index}][${field}][_icontains]`, query.search!.trim()));
  const response = await fetch(`${baseUrl}/items/${encodeURIComponent(query.collection)}?${params.toString()}`, { signal });
  const payload = await response.json().catch(() => ({})) as { data?: CatalogRecord[]; meta?: { filter_count?: number }; errors?: Array<{ message?: string }> };
  if (!response.ok) throw new Error(payload.errors?.[0]?.message ?? `Không tải được ${query.collection} (${response.status}).`);
  return { items: payload.data ?? [], total: typeof payload.meta?.filter_count === "number" ? payload.meta.filter_count : null };
}

const EXPORT_PAGE_SIZE = 500;
const EXPORT_MAX_RECORDS = 5000;

// Dùng cho xuất CSV: kéo toàn bộ kết quả đang lọc (không chỉ trang đang xem),
// giới hạn ở EXPORT_MAX_RECORDS để tránh treo trình duyệt với collection hàng trăm nghìn dòng.
export async function fetchAllCollectionRecords(
  query: Omit<CollectionRecordsQuery, "page" | "limit">,
): Promise<{ items: CatalogRecord[]; truncated: boolean }> {
  const items: CatalogRecord[] = [];
  let page = 1;
  let total: number | null = null;
  while (items.length < EXPORT_MAX_RECORDS) {
    const data = await fetchCollectionRecords({ ...query, page, limit: EXPORT_PAGE_SIZE });
    items.push(...data.items);
    total = data.total;
    if (data.items.length < EXPORT_PAGE_SIZE) break;
    page += 1;
  }
  return { items: items.slice(0, EXPORT_MAX_RECORDS), truncated: total !== null && total > items.length };
}

// Dùng cho mini-map xem trước trong panel chi tiết: chỉ kéo mỗi field hình học,
// không kéo cả record để tránh tải thừa cho danh sách/bảng.
export async function fetchRecordGeometry(collection: string, id: string | number, geometryField = "geom"): Promise<unknown | null> {
  try {
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}?fields=${encodeURIComponent(geometryField)}`);
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({})) as { data?: Record<string, unknown> };
    return payload.data?.[geometryField] ?? null;
  } catch {
    return null;
  }
}

// Dùng cho nút "Định vị trên bản đồ": trang bản đồ chính cần đầy đủ thuộc tính
// của đối tượng (không chỉ vài field như bảng danh sách) để hiển thị panel chi tiết.
export async function fetchRecord(collection: string, id: string | number): Promise<CatalogRecord | null> {
  try {
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`);
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({})) as { data?: CatalogRecord };
    return payload.data ?? null;
  } catch {
    return null;
  }
}

export type GroupedCount = { label: string; count: number };

// Dùng cho biểu đồ cột (vd: số thửa đất theo phường/xã) — Directus tự đếm và
// nhóm ở phía server, không cần tải hàng trăm nghìn bản ghi về rồi đếm tay.
export async function fetchGroupedCounts(collection: string, groupField: string, limit = 12): Promise<GroupedCount[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit), sort: "-count" });
    params.set("aggregate[count]", "*");
    params.append("groupBy[]", groupField);
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({})) as { data?: Array<Record<string, unknown>> };
    return (payload.data ?? [])
      .map((row) => ({ label: String(row[groupField] ?? "").trim(), count: Number(row.count ?? 0) }))
      .filter((row) => row.label);
  } catch {
    return [];
  }
}

export type UpdateSplit = { updated: number; notUpdated: number; lastUpdated: string | null };

// "Đã cập nhật" = bản ghi có giá trị ở field ngày cập nhật; "chưa cập nhật" =
// field đó null. Dùng thay cho khái niệm "trạng thái" vì collection không có
// field trạng thái thật — đây là field thật duy nhất phản ánh đúng ý đó.
export async function fetchUpdateSplit(collection: string, dateField = "date_updated"): Promise<UpdateSplit> {
  try {
    const [updatedRes, notUpdatedRes, maxRes] = await Promise.all([
      fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?aggregate[count]=*&filter[${encodeURIComponent(dateField)}][_nnull]=true`),
      fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?aggregate[count]=*&filter[${encodeURIComponent(dateField)}][_null]=true`),
      fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?aggregate[max]=${encodeURIComponent(dateField)}`),
    ]);
    const [updatedPayload, notUpdatedPayload, maxPayload] = await Promise.all([
      updatedRes.json().catch(() => ({})) as Promise<{ data?: Array<{ count?: string | number }> }>,
      notUpdatedRes.json().catch(() => ({})) as Promise<{ data?: Array<{ count?: string | number }> }>,
      maxRes.json().catch(() => ({})) as Promise<{ data?: Array<{ max?: Record<string, string | null> }> }>,
    ]);
    return {
      updated: Number(updatedPayload.data?.[0]?.count ?? 0),
      notUpdated: Number(notUpdatedPayload.data?.[0]?.count ?? 0),
      lastUpdated: maxPayload.data?.[0]?.max?.[dateField] ?? null,
    };
  } catch {
    return { updated: 0, notUpdated: 0, lastUpdated: null };
  }
}

export type DailyCount = { date: string; count: number };

// Dùng cho biểu đồ xu hướng cập nhật theo ngày, giới hạn N ngày gần nhất để
// tránh kéo toàn bộ lịch sử.
export async function fetchDailyTrend(collection: string, dateField: string, days: number): Promise<DailyCount[]> {
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const params = new URLSearchParams({ sort: `year(${dateField}),month(${dateField}),day(${dateField})` });
    params.set("aggregate[count]", "*");
    params.append("groupBy[]", `year(${dateField})`);
    params.append("groupBy[]", `month(${dateField})`);
    params.append("groupBy[]", `day(${dateField})`);
    params.set(`filter[${dateField}][_gte]`, since.toISOString().slice(0, 10));
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({})) as { data?: Array<Record<string, string>> };
    return (payload.data ?? []).map((row) => {
      const year = row[`${dateField}_year`];
      const month = String(row[`${dateField}_month`]).padStart(2, "0");
      const day = String(row[`${dateField}_day`]).padStart(2, "0");
      return { date: `${year}-${month}-${day}`, count: Number(row.count ?? 0) };
    });
  } catch {
    return [];
  }
}

// --- Time-series đo đạc trạm quan trắc (rain_water_depth / water_level_depth /
// iot_wind_speed...) — mỗi bảng có field khác nhau map trạm (station_id/sid) và
// giá trị đo (depth/ws), nhưng đều có "time_point" nên viết chung 1 bộ hàm.

export type StationReading = Record<string, unknown> & { time_point?: string };

// Đọc gần nhất của 1 trạm.
export async function fetchLatestStationReading(
  seriesCollection: string,
  stationField: string,
  stationId: string,
  fields: string[],
): Promise<StationReading | null> {
  try {
    const params = new URLSearchParams({ limit: "1", sort: "-time_point", fields: fields.join(",") });
    params.set(`filter[${stationField}][_eq]`, stationId);
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(seriesCollection)}?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({})) as { data?: StationReading[] };
    return payload.data?.[0] ?? null;
  } catch {
    return null;
  }
}

// Danh sách các bản ghi gần nhất của 1 trạm (cho bảng "Số liệu gần nhất").
export async function fetchRecentStationReadings(
  seriesCollection: string,
  stationField: string,
  stationId: string,
  fields: string[],
  limit: number,
): Promise<StationReading[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit), sort: "-time_point", fields: fields.join(",") });
    params.set(`filter[${stationField}][_eq]`, stationId);
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(seriesCollection)}?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({})) as { data?: StationReading[] };
    return payload.data ?? [];
  } catch {
    return [];
  }
}

// Gộp giá trị theo khoảng N giờ gần nhất thành 1 số (cho thẻ thống kê).
export async function fetchStationAggregate(
  seriesCollection: string,
  stationField: string,
  stationId: string,
  valueField: string,
  aggregateFn: "sum" | "max" | "min" | "avg",
  hours: number,
): Promise<number | null> {
  try {
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const params = new URLSearchParams();
    params.set(`aggregate[${aggregateFn}]`, valueField);
    params.set(`filter[${stationField}][_eq]`, stationId);
    params.set("filter[time_point][_gte]", since.toISOString());
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(seriesCollection)}?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({})) as { data?: Array<Record<string, Record<string, unknown>>> };
    const value = payload.data?.[0]?.[aggregateFn]?.[valueField];
    return typeof value === "number" ? value : value !== undefined && value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
  } catch {
    return null;
  }
}

export type HourlyAggregate = { hour: string; value: number };

// Xu hướng theo giờ trong N giờ gần nhất (cho biểu đồ cột).
export async function fetchHourlyStationTrend(
  seriesCollection: string,
  stationField: string,
  stationId: string,
  valueField: string,
  aggregateFn: "sum" | "max" | "avg",
  hours: number,
): Promise<HourlyAggregate[]> {
  try {
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const params = new URLSearchParams({ sort: "year(time_point),month(time_point),day(time_point),hour(time_point)" });
    params.set(`aggregate[${aggregateFn}]`, valueField);
    params.append("groupBy[]", "year(time_point)");
    params.append("groupBy[]", "month(time_point)");
    params.append("groupBy[]", "day(time_point)");
    params.append("groupBy[]", "hour(time_point)");
    params.set(`filter[${stationField}][_eq]`, stationId);
    params.set("filter[time_point][_gte]", since.toISOString());
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(seriesCollection)}?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({})) as { data?: Array<Record<string, unknown>> };
    return (payload.data ?? []).map((row) => {
      const year = row.time_point_year;
      const month = String(row.time_point_month).padStart(2, "0");
      const day = String(row.time_point_day).padStart(2, "0");
      const hour = String(row.time_point_hour).padStart(2, "0");
      const aggregateValue = (row[aggregateFn] as Record<string, unknown> | undefined)?.[valueField];
      const numeric = typeof aggregateValue === "number" ? aggregateValue : Number(aggregateValue ?? 0);
      return { hour: `${year}-${month}-${day}T${hour}:00`, value: Number.isFinite(numeric) ? numeric : 0 };
    });
  } catch {
    return [];
  }
}

// Danh sách trạm kèm hình học, dùng để vẽ marker trên bản đồ tương tác nhỏ mà
// không cần qua pipeline MVT (dữ liệu trạm chỉ vài chục bản ghi, không cần tile).
export async function fetchStationsWithGeometry(
  collection: string,
  fields: string[],
  geometryField = "geom",
): Promise<CatalogRecord[]> {
  try {
    const params = new URLSearchParams({ limit: "-1", fields: [...fields, geometryField].join(",") });
    const response = await fetch(`${baseUrl}/items/${encodeURIComponent(collection)}?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({})) as { data?: CatalogRecord[] };
    return payload.data ?? [];
  } catch {
    return [];
  }
}
