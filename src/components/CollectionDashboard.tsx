import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Geometry } from "geojson";
import { fetchAllCollectionRecords, fetchCollectionRecords, fetchRecordGeometry, type CatalogCollectionConfig, type CatalogRecord, type CollectionDashboardConfig } from "../data/directusClient";
import { FeatureMiniMap } from "./FeatureMiniMap";
import { Badge } from "./Badge";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

type Props = { config?: CollectionDashboardConfig; configs?: CollectionDashboardConfig[] };

export function CollectionDashboard({ config, configs }: Props) {
  const dashboardConfigs = configs ?? (config ? [config] : []);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeConfig = dashboardConfigs[activeIndex] ?? dashboardConfigs[0];
  const [collection, setCollection] = useState(activeConfig.collections[0].collection);
  const [searchInput, setSearchInput] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: CatalogRecord[]; total: number | null }>({ items: [], total: null });
  const [selected, setSelected] = useState<CatalogRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const selectedConfig = activeConfig.collections.find((item) => item.collection === collection) ?? activeConfig.collections[0];
  const recordId = (item: CatalogRecord) => item[selectedConfig.idField ?? "id"];

  // Gõ tới đâu gọi API tới đó sẽ dội request liên tục vào Directus (collection thửa
  // đất có 300k+ bản ghi); debounce để chỉ gọi sau khi người dùng ngừng gõ 350ms.
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    const timer = setTimeout(() => { setFilter(filterInput); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterInput]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSelected(null);
    fetchCollectionRecords({ collection, fields: selectedConfig.fields, search, searchFields: selectedConfig.searchFields, filterField: selectedConfig.filterField, filterValue: filter, page, limit: PAGE_SIZE }, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [collection, filter, page, search, selectedConfig]);

  const totalPages = result.total === null ? 1 : Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const reset = (nextCollection = collection) => { setCollection(nextCollection); setSearchInput(""); setFilterInput(""); setSearch(""); setFilter(""); setPage(1); setSelected(null); };
  const changeSection = (index: number) => { const nextConfig = dashboardConfigs[index]; setActiveIndex(index); setCollection(nextConfig.collections[0].collection); setSearchInput(""); setFilterInput(""); setSearch(""); setFilter(""); setPage(1); setSelected(null); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { items, truncated } = await fetchAllCollectionRecords({ collection, fields: selectedConfig.fields, search, searchFields: selectedConfig.searchFields, filterField: selectedConfig.filterField, filterValue: filter });
      exportCsv(items, selectedConfig);
      if (truncated) window.alert(`Kết quả có nhiều hơn ${items.length.toLocaleString()} dòng, báo cáo chỉ xuất ${items.length.toLocaleString()} dòng đầu. Thu hẹp tìm kiếm/bộ lọc để xuất đầy đủ hơn.`);
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Không thể xuất báo cáo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface text-ink-900">
      <header className="flex min-h-[4.25rem] items-center gap-4 border-b border-line bg-white px-5 shadow-header">
        <Link to="/" className="flex min-w-0 items-center gap-3 text-ink-900 transition-opacity duration-150 hover:opacity-80" title="Về bản đồ">
          <img src="/images/logo/Logo_IOC.png" alt="IOC Huế" className="h-10 w-14 object-contain" />
          <span className="truncate text-base font-extrabold uppercase tracking-[-0.02em]">Hệ thống bản đồ số theo dõi dữ liệu số hóa</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/monitoring" className="flex h-9 items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold text-ink-500 transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted">
            <span className="material-symbols-outlined text-[17px]">sensors</span>Trạm quan trắc
          </Link>
          <Link to="/overview" className="flex h-9 items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold text-ink-500 transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted">
            <span className="material-symbols-outlined text-[17px]">analytics</span>Tổng quan thống kê
          </Link>
          <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-dark sm:flex">
            <span className="material-symbols-outlined">person</span>
          </span>
        </div>
      </header>
      <div className="relative flex min-h-[calc(100dvh-4.25rem)]">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white lg:flex">
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
            <span className="material-symbols-outlined text-[20px] text-accent">dataset</span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-extrabold uppercase tracking-wide text-ink-900">Dữ liệu số hóa</p>
              <p className="text-[10px] text-ink-400">Cổng tra cứu dữ liệu</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2.5">
            {dashboardConfigs.map((item, index) => (
              <button key={item.title} type="button" onClick={() => changeSection(index)} className="w-full text-left">
                <SidebarLink active={index === activeIndex} icon={item.icon} color={item.color} label={item.title} />
              </button>
            ))}
          </nav>
          <div className="border-t border-line px-2 py-2.5">
            <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold text-ink-500 transition-colors duration-150 hover:bg-surface-muted hover:text-ink-700">
              <span className="material-symbols-outlined text-[19px]">arrow_back</span>Về bản đồ
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-7">
          <nav aria-label="Chọn nhóm dữ liệu" className="mb-4 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {dashboardConfigs.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => changeSection(index)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${index === activeIndex ? "border-accent bg-accent-soft text-accent-dark" : "border-line text-ink-500 hover:border-line-strong hover:bg-surface-muted"}`}
              >
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.color }}>{item.icon}</span>
                {item.title}
              </button>
            ))}
          </nav>

          <div className="mb-5">
            <div aria-label="breadcrumb" className="mb-2 flex items-center gap-1 text-[11px] text-ink-400">
              <span>Dữ liệu số hóa</span>
              <span className="material-symbols-outlined text-[13px]">chevron_right</span>
              <span className="font-medium text-ink-500">{activeConfig.title}</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: activeConfig.color, backgroundColor: `${activeConfig.color}17` }}
                >
                  {activeConfig.kicker}
                </span>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">{activeConfig.title}</h1>
                <p className="mt-1 text-xs text-ink-500">{activeConfig.description}</p>
              </div>
              <button type="button" onClick={() => void handleExport()} disabled={exporting} className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-line bg-white px-4 text-xs font-bold text-ink-700 shadow-card transition-colors duration-150 hover:border-accent hover:text-accent-dark disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">description</span>{exporting ? "Đang xuất..." : "Xuất báo cáo"}
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-line bg-white p-3 shadow-card">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[1.7fr_1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Tìm kiếm</label>
                <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-surface-muted px-3 transition-colors duration-150 focus-within:border-accent focus-within:bg-white">
                  <span className="material-symbols-outlined text-[18px] text-ink-400">search</span>
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={activeConfig.searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-300" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">Loại dữ liệu</label>
                <select value={collection} onChange={(event) => reset(event.target.value)} className="h-10 w-full rounded-md border border-line bg-surface-muted px-3 text-xs text-ink-700 outline-none transition-colors duration-150 hover:border-line-strong focus:border-accent focus:bg-white">
                  {activeConfig.collections.map((item) => <option key={item.collection} value={item.collection}>{item.label}</option>)}
                </select>
              </div>
              {selectedConfig.filterField ? (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">{selectedConfig.filterLabel}</label>
                  <input value={filterInput} onChange={(event) => setFilterInput(event.target.value)} placeholder={selectedConfig.filterLabel} className="h-10 w-full rounded-md border border-line bg-surface-muted px-3 text-xs text-ink-700 outline-none transition-colors duration-150 placeholder:text-ink-300 focus:border-accent focus:bg-white" />
                </div>
              ) : <div className="hidden lg:block" />}
              <button type="button" onClick={() => reset()} className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-line px-3.5 text-xs font-semibold text-ink-500 transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted">
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>Xóa lọc
              </button>
            </div>
          </div>

          <section className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-extrabold tabular-nums text-ink-900">{result.total === null ? "-" : result.total.toLocaleString("vi")}</span>
                <span className="text-xs font-medium text-ink-400">kết quả · {selectedConfig.label}</span>
              </div>
              <span className="text-[11px] font-medium text-ink-400">Hiển thị {result.items.length} bản ghi · Trang {page}/{totalPages}</span>
            </div>
            {error && <div className="m-3 rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left text-xs">
                <thead className="border-b border-line-strong bg-surface-muted text-[10.5px] font-bold uppercase tracking-wide text-ink-500">
                  <tr>{selectedConfig.columns.map((column) => <th key={column.field} style={column.width ? { width: column.width, minWidth: column.width } : undefined} className="px-4 py-3.5">{column.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading ? (
                    <tr><td colSpan={selectedConfig.columns.length} className="px-3 py-12 text-center text-ink-400">Đang tải dữ liệu...</td></tr>
                  ) : result.items.length === 0 ? (
                    <tr><td colSpan={selectedConfig.columns.length} className="px-3 py-12 text-center text-ink-400">Không tìm thấy dữ liệu phù hợp.</td></tr>
                  ) : result.items.map((item) => (
                    <tr key={String(recordId(item))} onClick={() => setSelected(item)} className={`cursor-pointer transition-colors duration-150 hover:bg-accent-soft ${selected && recordId(selected) === recordId(item) ? "bg-accent-soft shadow-[inset_2px_0_0_var(--color-accent)]" : ""}`}>
                      {selectedConfig.columns.map((column) => {
                        const value = column.render ? column.render(item) : display(item[column.field]);
                        return (
                          <td key={column.field} style={{ maxWidth: column.width ?? "15rem" }} className="truncate px-4 py-3" title={value}>
                            {column.tone ? <Badge tone={column.tone(item)}>{value}</Badge> : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <span className="text-[11px] font-medium text-ink-400">
                {result.items.length === 0
                  ? "Không có kết quả"
                  : `Hiển thị ${((page - 1) * PAGE_SIZE + 1).toLocaleString("vi")}–${((page - 1) * PAGE_SIZE + result.items.length).toLocaleString("vi")} / ${result.total === null ? "-" : result.total.toLocaleString("vi")}`}
              </span>
              <div className="flex items-center gap-1.5">
                <PageNavButton direction="prev" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} />
                <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-accent px-2 text-[11px] font-bold text-white">{page}</span>
                <span className="px-0.5 text-[11px] text-ink-400">/ {totalPages.toLocaleString("vi")}</span>
                <PageNavButton direction="next" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} />
              </div>
            </div>
          </section>
        </main>
        {selected && <DetailPanel item={selected} config={selectedConfig} color={activeConfig.color} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function SidebarLink({ icon, color, label, active = false }: { icon: string; color: string; label: string; active?: boolean }) {
  return (
    <div className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150 ${active ? "bg-accent-soft text-accent-dark" : "text-ink-500 hover:bg-surface-muted hover:text-ink-700"}`}>
      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
      <span className="material-symbols-outlined text-[19px]" style={{ color: active ? "var(--color-accent)" : color }}>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function PageNavButton({ direction, disabled, onClick }: { direction: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const icon = direction === "prev" ? "chevron_left" : "chevron_right";
  const label = direction === "prev" ? "Trước" : "Sau";
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-8 items-center gap-1 rounded-md border border-line px-2.5 text-[11px] font-semibold text-ink-500 transition-colors duration-150 enabled:hover:border-accent enabled:hover:text-accent-dark disabled:opacity-35">
      {direction === "prev" && <span className="material-symbols-outlined text-[15px]">{icon}</span>}
      {label}
      {direction === "next" && <span className="material-symbols-outlined text-[15px]">{icon}</span>}
    </button>
  );
}

function DetailPanel({ item, config, color, onClose }: { item: CatalogRecord; config: CatalogCollectionConfig; color: string; onClose: () => void }) {
  const fields = config.detailFields.map((field) => typeof field === "string" ? { field, label: field, render: undefined } : field);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const id = item[config.idField ?? "id"];

  useEffect(() => {
    setGeometry(null);
    if (!config.geometryField || id === undefined) return;
    let cancelled = false;
    void fetchRecordGeometry(config.collection, id as string | number, config.geometryField).then((geom) => {
      if (!cancelled && geom) setGeometry(geom as Geometry);
    });
    return () => { cancelled = true; };
  }, [config.collection, config.geometryField, id]);

  return (
    <aside className="fixed inset-y-[4.25rem] right-0 z-20 w-full max-w-[25rem] overflow-y-auto border-l border-line bg-white shadow-dock sm:absolute sm:inset-y-[4.25rem]">
      <div className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-accent-dark">Chi tiết dữ liệu</p>
          <h2 className="mt-1 text-base font-extrabold text-ink-900">{display(item[config.titleField])}</h2>
        </div>
        <button type="button" onClick={onClose} title="Đóng" className="text-ink-400 transition-colors duration-150 hover:text-accent">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      {geometry && (
        <div className="border-b border-line px-5 py-4">
          <FeatureMiniMap geometry={geometry} color={color} />
          <Link to={`/?focus=${encodeURIComponent(config.collection)}:${encodeURIComponent(String(id))}`} className="mt-3 flex h-9 items-center justify-center gap-2 rounded-md bg-accent text-xs font-bold text-white transition-colors duration-150 hover:bg-accent-dark">
            <span className="material-symbols-outlined text-[16px]">location_on</span>Định vị trên bản đồ
          </Link>
        </div>
      )}
      <div className="space-y-4 px-5 py-5">
        {fields.map((field) => (
          <div key={field.field} className="grid grid-cols-[8rem_1fr] gap-3 text-xs">
            <strong className="text-ink-500">{field.label}</strong>
            <span className="break-words text-ink-700">{field.render ? field.render(item) : display(item[field.field])}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function display(value: unknown): string { return value === null || value === undefined || String(value).trim() === "" ? "-" : String(value); }
function exportCsv(items: CatalogRecord[], config: CatalogCollectionConfig) {
  const rows = [
    config.columns.map((column) => column.label),
    ...items.map((item) => config.columns.map((column) => column.render ? column.render(item) : display(item[column.field]))),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `${config.collection}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
