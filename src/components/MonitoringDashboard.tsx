import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { STYLE_URL, transformTileRequest } from "../map/mapClient";
import {
  fetchHourlyStationTrend,
  fetchLatestStationReading,
  fetchRecentStationReadings,
  fetchStationAggregate,
  fetchStationsWithGeometry,
  type CatalogRecord,
  type HourlyAggregate,
  type StationReading,
} from "../data/directusClient";
import { MONITORING_RECENT_LIMIT, MONITORING_STATION_TYPES, MONITORING_TREND_HOURS, type MonitoringStationType } from "../data/monitoringConfig";
import { Badge } from "./Badge";

type StationDetail = {
  latest: StationReading | null;
  aggregate: number | null;
  trend: HourlyAggregate[];
  recent: StationReading[];
};

function stationCoordinates(station: CatalogRecord): [number, number] | null {
  const geom = station.geom as { type?: string; coordinates?: unknown } | undefined;
  const coords = geom?.coordinates;
  return Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number"
    ? [coords[0], coords[1]]
    : null;
}

export function MonitoringDashboard() {
  const [typeIndex, setTypeIndex] = useState(0);
  const activeType = MONITORING_STATION_TYPES[typeIndex];

  const [stations, setStations] = useState<CatalogRecord[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const mainRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const activeTypeRef = useRef(activeType);
  activeTypeRef.current = activeType;

  // Tải danh sách trạm khi đổi loại trạm (dữ liệu nhỏ — vài chục bản ghi, đọc
  // thẳng qua Directus REST thay vì qua pipeline MVT).
  useEffect(() => {
    let disposed = false;
    setStationsLoading(true);
    setSelectedId(null);
    setSearch("");
    void fetchStationsWithGeometry(activeType.stationCollection, ["id", "code", "name", "address", "area"]).then((data) => {
      if (!disposed) { setStations(data); setStationsLoading(false); }
    });
    return () => { disposed = true; };
  }, [activeType.stationCollection]);

  // Khởi tạo bản đồ 1 lần.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [107.5991, 16.4637],
      zoom: 10,
      attributionControl: false,
      transformRequest: transformTileRequest,
    });
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    if (mainRef.current) resizeObserver.observe(mainRef.current);
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Vẽ lại marker mỗi khi danh sách trạm đổi.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const render = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      const bounds = new maplibregl.LngLatBounds();
      let any = false;
      for (const station of stations) {
        const coords = stationCoordinates(station);
        if (!coords) continue;
        const id = String(station.id);
        // maplibregl định vị marker bằng transform inline trên chính "el"; nếu
        // đặt luôn hover:scale-* (CSS "scale" riêng) lên "el" thì nó cộng dồn
        // với transform đó khiến marker "nhảy" lệch vị trí khi hover — chuột
        // rời khỏi nút giữa chừng mousedown/mouseup nên click bị rớt, không
        // bao giờ chọn được trạm. Đẩy hiệu ứng scale sang 1 span con để "el"
        // (vùng bắt sự kiện + vị trí do maplibregl quản) luôn đứng yên.
        const el = document.createElement("button");
        el.type = "button";
        el.className = "flex h-7 w-7 items-center justify-center";
        el.innerHTML = `<span class="flex h-full w-full items-center justify-center rounded-full border-2 border-white shadow-[0_2px_6px_rgba(15,40,70,0.35)] transition-transform hover:scale-110" style="background-color:${activeTypeRef.current.color}"><span class="material-symbols-outlined text-white" style="font-size:15px">${activeTypeRef.current.icon}</span></span>`;
        el.addEventListener("click", (event) => { event.stopPropagation(); setSelectedId(id); });
        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(coords).addTo(map);
        markersRef.current.set(id, marker);
        bounds.extend(coords);
        any = true;
      }
      if (any) map.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 0 });
    };
    if (map.isStyleLoaded()) render(); else map.once("load", render);
  }, [stations]);

  // Đổi diện mạo marker đang chọn + bay tới.
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.style.outline = id === selectedId ? "3px solid #d71920" : "none";
      el.style.outlineOffset = id === selectedId ? "2px" : "0";
      el.style.borderRadius = "9999px";
      el.style.zIndex = id === selectedId ? "10" : "1";
    });
    const map = mapRef.current;
    const coords = selectedId ? stationCoordinates(stations.find((s) => String(s.id) === selectedId) ?? {}) : null;
    if (!map || !coords) return;
    const frameId = requestAnimationFrame(() => {
      map.resize();
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 700 });
    });
    return () => cancelAnimationFrame(frameId);
  }, [selectedId, stations]);

  const selectedStation = stations.find((station) => String(station.id) === selectedId) ?? null;

  // Tải dữ liệu đo cho trạm đang chọn.
  useEffect(() => {
    if (!selectedStation) { setDetail(null); return; }
    const stationId = String(selectedStation[activeType.stationIdField]);
    const aggregateFn = activeType.accumulate ? "sum" : "max";
    let disposed = false;
    setDetailLoading(true);
    void Promise.all([
      fetchLatestStationReading(activeType.seriesCollection, activeType.seriesStationField, stationId, [activeType.primaryField, "time_point"]),
      fetchStationAggregate(activeType.seriesCollection, activeType.seriesStationField, stationId, activeType.primaryField, aggregateFn, MONITORING_TREND_HOURS),
      fetchHourlyStationTrend(activeType.seriesCollection, activeType.seriesStationField, stationId, activeType.primaryField, aggregateFn, MONITORING_TREND_HOURS),
      fetchRecentStationReadings(activeType.seriesCollection, activeType.seriesStationField, stationId, [activeType.primaryField, "time_point"], MONITORING_RECENT_LIMIT),
    ]).then(([latest, aggregate, trend, recent]) => {
      if (disposed) return;
      setDetail({ latest, aggregate, trend, recent });
      setDetailLoading(false);
    });
    return () => { disposed = true; };
  }, [selectedStation, activeType]);

  const filteredStations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    if (!query) return stations;
    return stations.filter((station) =>
      [station.name, station.code, station.address].some((value) => String(value ?? "").toLocaleLowerCase("vi").includes(query)));
  }, [search, stations]);

  const isWarning = activeType.warningThreshold !== undefined && detail?.aggregate !== null && detail?.aggregate !== undefined && detail.aggregate >= activeType.warningThreshold;

  const exportReadings = () => {
    if (!detail?.recent.length || !selectedStation) return;
    const rows = [
      ["Thời gian", `${activeType.primaryLabel} (${activeType.primaryUnit})`],
      ...detail.recent.map((reading) => [formatDateTime(reading.time_point), formatNumber(reading[activeType.primaryField])]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${activeType.seriesCollection}-${String(selectedStation.code ?? selectedStation.id)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const selectStation = (id: string) => { setSelectedId(id); setMobileListOpen(false); };

  return <div className="flex h-dvh flex-col bg-surface text-ink-900">
    <header className="flex min-h-[4.25rem] shrink-0 items-center gap-4 border-b border-line bg-white px-5 shadow-header">
      <a href="/" className="flex min-w-0 items-center gap-3 text-ink-900 transition-opacity duration-150 hover:opacity-80" title="Về bản đồ"><img src="/images/logo/Logo_IOC.png" alt="IOC Huế" className="h-10 w-14 object-contain" /><span className="truncate text-base font-extrabold uppercase tracking-[-0.02em]">Hệ thống bản đồ số theo dõi dữ liệu số hóa</span></a>
      <a href="/statics" className="ml-auto flex h-9 items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold text-ink-500 transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted"><span className="material-symbols-outlined text-[17px]">layers</span>Danh sách chi tiết</a>
    </header>
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-white px-3 py-2 lg:hidden">
      {MONITORING_STATION_TYPES.map((type, index) => (
        <button
          key={type.key}
          type="button"
          onClick={() => setTypeIndex(index)}
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${index === typeIndex ? "border-accent bg-accent-soft text-accent-dark" : "border-line text-ink-500 hover:border-line-strong hover:bg-surface-muted"}`}
        >
          <span className="material-symbols-outlined text-[16px]" style={{ color: type.color }}>{type.icon}</span>
          {type.label}
        </button>
      ))}
      <button type="button" onClick={() => setMobileListOpen(true)} className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-500 transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted">
        <span className="material-symbols-outlined text-[16px]">layers</span>
        Danh sách ({filteredStations.length})
      </button>
    </div>
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[14.5rem] shrink-0 overflow-y-auto border-r border-line bg-white lg:block">
        <div className="px-5 py-5 text-[11px] font-bold uppercase tracking-wide text-ink-500">Trạm quan trắc IoT</div>
        {MONITORING_STATION_TYPES.map((type, index) => (
          <button key={type.key} type="button" onClick={() => setTypeIndex(index)} className="w-full text-left">
            <div className={`flex items-center gap-3 border-l-2 px-4 py-3 text-xs font-semibold transition-colors duration-150 ${index === typeIndex ? "border-accent bg-accent-soft text-accent-dark" : "border-transparent text-ink-500 hover:bg-surface-muted"}`}>
              <span className="material-symbols-outlined text-[19px]" style={{ color: type.color }}>{type.icon}</span>
              {type.label}
            </div>
          </button>
        ))}
        <div className="border-t border-line px-5 py-4 text-xs text-ink-400"><span className="material-symbols-outlined mr-2 align-middle text-[16px]">arrow_back</span><a href="/">Về bản đồ</a></div>
      </aside>
      {!stationsLoading && (
        <StationListPanel
          stations={filteredStations}
          total={stations.length}
          selectedId={selectedId}
          onSelect={selectStation}
          type={activeType}
          search={search}
          onSearchChange={setSearch}
        />
      )}
      {!stationsLoading && mobileListOpen && (
        <StationListPanel
          stations={filteredStations}
          total={stations.length}
          selectedId={selectedId}
          onSelect={selectStation}
          type={activeType}
          search={search}
          onSearchChange={setSearch}
          variant="sheet"
          onClose={() => setMobileListOpen(false)}
        />
      )}
      <main ref={mainRef} className="relative min-w-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {stationsLoading && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}
      </main>
      {selectedStation && (
        <StationDetailPanel
          station={selectedStation}
          type={activeType}
          detail={detail}
          loading={detailLoading}
          isWarning={isWarning}
          onClose={() => setSelectedId(null)}
          onExport={exportReadings}
        />
      )}
    </div>
  </div>;
}

function StationListPanel({ stations, total, selectedId, onSelect, type, search, onSearchChange, variant = "sidebar", onClose }: {
  stations: CatalogRecord[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  type: MonitoringStationType;
  search: string;
  onSearchChange: (value: string) => void;
  // "sidebar" = cột cố định cạnh bản đồ (desktop, >=lg). "sheet" = lớp phủ toàn
  // màn hình cho mobile/tablet (<lg) — ở các cỡ đó sidebar bị ẩn nên người
  // dùng cần cách khác để đổi trạm, mở qua nút "Danh sách" trong thanh trên.
  variant?: "sidebar" | "sheet";
  onClose?: () => void;
}) {
  const wrapperClass = variant === "sheet"
    ? "fixed inset-y-[4.25rem] inset-x-0 z-30 flex flex-col bg-white lg:hidden"
    // Cột layout thật (không phải overlay đè lên bản đồ) — trước đây panel này
    // "absolute" nằm trên bản đồ nên marker rơi vào vùng nó che bị chặn click.
    : "hidden w-[16rem] shrink-0 flex-col border-r border-line bg-white lg:flex";
  return (
    <div className={wrapperClass}>
      {variant === "sheet" && (
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3.5 py-2.5">
          <span className="text-xs font-bold text-ink-900">Chọn {type.label.toLocaleLowerCase("vi")}</span>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-ink-400 transition-colors duration-150 hover:text-accent">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
      <div className="shrink-0 border-b border-line px-3.5 py-2.5">
        <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface-muted px-2.5 transition-colors duration-150 focus-within:border-accent focus-within:bg-white">
          <span className="material-symbols-outlined text-[16px] text-ink-400">search</span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={`Tìm ${type.label.toLocaleLowerCase("vi")}...`} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-300" />
        </label>
        <p className="mt-2 text-[11px] font-semibold text-ink-500">{stations.length}/{total} {type.label.toLocaleLowerCase("vi")}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {stations.map((station) => (
          <button key={String(station.id)} type="button" onClick={() => onSelect(String(station.id))} className={`block w-full border-b border-line px-3.5 py-2.5 text-left text-xs transition-colors duration-150 ${selectedId === String(station.id) ? "bg-accent-soft shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-surface-muted"}`}>
            <div className="font-semibold text-ink-700">{display(station.name)}</div>
            <div className="mt-0.5 text-[10px] text-ink-400">{display(station.code)} · {display(station.area)}</div>
          </button>
        ))}
        {stations.length === 0 && <p className="px-3.5 py-4 text-xs text-ink-300">Không tìm thấy trạm phù hợp.</p>}
      </div>
    </div>
  );
}

function StationDetailPanel({ station, type, detail, loading, isWarning, onClose, onExport }: {
  station: CatalogRecord;
  type: MonitoringStationType;
  detail: StationDetail | null;
  loading: boolean;
  isWarning: boolean;
  onClose: () => void;
  onExport: () => void;
}) {
  return (
    // Overlay toàn màn hình dưới lg (sidebar loại trạm + danh sách đã ẩn ở cỡ
    // này) để tránh việc panel "w-full" làm vỡ layout khi vẫn nằm chung hàng
    // flex với bản đồ trên màn hình hẹp; từ lg trở lên quay lại làm cột cạnh
    // bản đồ như cũ.
    <aside className="fixed inset-y-[4.25rem] inset-x-0 z-30 flex flex-col overflow-hidden bg-white shadow-dock lg:static lg:inset-auto lg:z-auto lg:w-full lg:max-w-[24rem] lg:shrink-0 lg:border-l lg:border-line">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: type.color }}>{type.label}</p>
          <h2 className="mt-1 truncate text-sm font-extrabold text-ink-900">{display(station.name)}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {type.warningThreshold !== undefined && !loading && (
            <Badge tone={isWarning ? "danger" : "success"}>
              <span className="material-symbols-outlined mr-0.5 align-middle text-[13px]">{isWarning ? "warning" : "check_circle"}</span>
              {isWarning ? "Cảnh báo" : "Bình thường"}
            </Badge>
          )}
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-ink-400 transition-colors duration-150 hover:text-accent"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2 border-b border-line px-4 py-3 text-xs">
          <InfoRow label="Mã trạm" value={display(station.code ?? station.id)} />
          <InfoRow label="Phường, xã" value={display(station.area)} />
          <InfoRow label="Địa chỉ" value={display(station.address)} />
          <InfoRow label="Cập nhật cuối" value={loading ? "…" : formatDateTime(detail?.latest?.time_point)} />
        </div>
        <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
          <StatTile label={`${type.primaryLabel} hiện tại`} value={loading ? "…" : formatMeasure(detail?.latest?.[type.primaryField], type.primaryUnit)} />
          <StatTile label={type.accumulate ? `Trong ${MONITORING_TREND_HOURS} giờ` : `Cao nhất ${MONITORING_TREND_HOURS} giờ`} value={loading ? "…" : formatMeasure(detail?.aggregate, type.primaryUnit)} />
        </div>
        <div className="px-4 py-3">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink-500">{type.primaryLabel} {MONITORING_TREND_HOURS} giờ qua</h3>
          {loading ? <div className="h-40 animate-pulse rounded-md bg-surface-muted" />
            : detail && detail.trend.length > 0 ? <HourlyBarChart data={detail.trend} color={type.color} unit={type.primaryUnit} />
              : <p className="py-6 text-center text-xs text-ink-300">Chưa có dữ liệu.</p>}
        </div>
        <div className="px-4 pb-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink-500">Số liệu gần nhất</h3>
          {loading ? <div className="h-32 animate-pulse rounded-md bg-surface-muted" /> : (
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="text-[10px] font-bold uppercase text-ink-400"><tr><th className="py-1.5">Thời gian</th><th className="py-1.5 text-right">{type.primaryLabel} ({type.primaryUnit})</th></tr></thead>
              <tbody className="divide-y divide-line">
                {(detail?.recent ?? []).map((reading, index) => (
                  <tr key={index}><td className="py-1.5 text-ink-500">{formatDateTime(reading.time_point)}</td><td className="py-1.5 text-right font-semibold tabular-nums text-ink-900">{formatNumber(reading[type.primaryField])}</td></tr>
                ))}
                {(!detail || detail.recent.length === 0) && <tr><td colSpan={2} className="py-4 text-center text-ink-300">Chưa có dữ liệu.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t border-line px-4 py-3">
        <button type="button" onClick={onExport} disabled={!detail?.recent.length} className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent text-xs font-bold text-white transition-colors duration-150 hover:bg-accent-dark disabled:opacity-50">
          <span className="material-symbols-outlined text-[16px]">description</span>Xuất báo cáo
        </button>
      </div>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2"><span className="w-24 shrink-0 text-ink-400">{label}</span><span className="text-ink-700">{value}</span></div>;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return <div className="bg-white px-3.5 py-3"><strong className="block text-lg leading-tight text-ink-900">{value}</strong><span className="mt-1 block text-[10px] leading-4 text-ink-400">{label}</span></div>;
}

function HourlyBarChart({ data, color, unit }: { data: HourlyAggregate[]; color: string; unit: string }) {
  const width = 380;
  const height = 150;
  const paddingLeft = 4;
  const paddingRight = 4;
  const paddingTop = 8;
  const paddingBottom = 20;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const max = Math.max(...data.map((item) => item.value), 1);
  const barWidth = innerWidth / data.length;
  const labelEvery = Math.max(1, Math.round(data.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Biểu đồ theo giờ">
      {[0, 0.5, 1].map((step) => {
        const y = paddingTop + innerHeight * (1 - step);
        return <line key={step} x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />;
      })}
      {data.map((item, index) => {
        const barHeight = (item.value / max) * innerHeight;
        const x = paddingLeft + index * barWidth;
        const y = paddingTop + innerHeight - barHeight;
        return <rect key={item.hour} x={x + barWidth * 0.15} y={y} width={Math.max(barWidth * 0.7, 1)} height={Math.max(barHeight, 1)} rx={2} fill={color} />;
      })}
      {data.map((item, index) => index % labelEvery === 0 ? (
        <text key={item.hour} x={paddingLeft + index * barWidth + barWidth / 2} y={height - 4} textAnchor="middle" fontSize={9} fill="var(--color-ink-300)">{item.hour.slice(11, 16)}</text>
      ) : null)}
      <text x={width - paddingRight} y={paddingTop + 8} textAnchor="end" fontSize={9} fill="var(--color-ink-300)">Đơn vị: {unit}</text>
    </svg>
  );
}

function display(value: unknown): string {
  return value === null || value === undefined || String(value).trim() === "" ? "-" : String(value);
}

function formatNumber(value: unknown): string {
  const numeric = Number(value);
  return value !== null && value !== undefined && Number.isFinite(numeric) ? numeric.toLocaleString("vi") : "-";
}

function formatMeasure(value: unknown, unit: string): string {
  const numeric = Number(value);
  return value !== null && value !== undefined && Number.isFinite(numeric) ? `${numeric.toLocaleString("vi")} ${unit}` : "-";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
