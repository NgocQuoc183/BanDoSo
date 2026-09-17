import { useEffect, useState } from "react";
import type { Geometry } from "geojson";
import { fetchAllCollectionRecords, fetchCollectionRecords, fetchRecordGeometry, type CatalogCollectionConfig, type CatalogRecord, type CollectionDashboardConfig } from "../data/directusClient";
import { FeatureMiniMap } from "./FeatureMiniMap";

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

  return <div className="min-h-dvh bg-[#f5f7fa] text-[#17344d]">
    <header className="flex min-h-[4.25rem] items-center gap-4 border-b border-[#dce5ec] bg-white px-5 shadow-header">
      <a href="/" className="flex min-w-0 items-center gap-3 text-[#132e57] transition-opacity duration-150 hover:opacity-80" title="Về bản đồ"><img src="/images/logo/Logo_IOC.png" alt="IOC Huế" className="h-10 w-14 object-contain" /><span className="truncate text-base font-extrabold uppercase tracking-[-0.02em]">Hệ thống bản đồ số theo dõi dữ liệu số hóa</span></a>
      <div className="ml-auto flex items-center gap-3"><a href="/monitoring" className="flex h-9 items-center gap-2 rounded-md border border-[#d5e0e8] px-3 text-xs font-semibold text-[#526d82] transition-colors duration-150 hover:border-[#b9cbdc] hover:bg-[#f6fafc]"><span className="material-symbols-outlined text-[17px]">sensors</span>Trạm quan trắc</a><a href="/overview" className="flex h-9 items-center gap-2 rounded-md border border-[#d5e0e8] px-3 text-xs font-semibold text-[#526d82] transition-colors duration-150 hover:border-[#b9cbdc] hover:bg-[#f6fafc]"><span className="material-symbols-outlined text-[17px]">analytics</span>Tổng quan thống kê</a><span className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#e6f1fb] text-[#1467ad] sm:flex"><span className="material-symbols-outlined">person</span></span></div>
    </header>
    <div className="relative flex min-h-[calc(100dvh-4.25rem)]">
      <aside className="hidden w-[14.5rem] shrink-0 border-r border-[#e1e8ee] bg-white lg:block"><div className="px-5 py-5 text-[11px] font-bold uppercase tracking-wide text-[#657b8d]">Dữ liệu số hóa</div>{dashboardConfigs.map((item, index) => <button key={item.title} type="button" onClick={() => changeSection(index)} className="w-full text-left"><SidebarLink active={index === activeIndex} icon={item.icon} color={item.color} label={item.title} /></button>)}<div className="absolute bottom-5 hidden w-[14.5rem] border-t border-[#edf1f4] px-5 pt-4 text-xs text-[#718596] lg:block"><span className="material-symbols-outlined mr-2 align-middle text-[16px]">arrow_back</span><a href="/">Về bản đồ</a></div></aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: activeConfig.color }}>{activeConfig.kicker}</p><h1 className="mt-1 text-lg font-extrabold text-[#15324d]">{activeConfig.title}</h1><p className="mt-1 text-xs text-[#718596]">{activeConfig.description}</p></div><button type="button" onClick={() => void handleExport()} disabled={exporting} className="flex h-9 items-center gap-2 rounded-md border border-[#1474b8] px-3 text-xs font-bold text-[#12649d] transition-colors duration-150 hover:bg-[#edf7fd] disabled:opacity-50"><span className="material-symbols-outlined text-[17px]">description</span>{exporting ? "Đang xuất..." : "Xuất báo cáo"}</button></div>
        <div className="mb-3 flex flex-wrap items-center gap-2"><label className="flex h-9 min-w-[15rem] flex-1 items-center gap-2 rounded-md border border-[#d5e0e8] bg-white px-3 transition-colors duration-150 focus-within:border-[#1681c7] sm:max-w-[25rem]"><span className="material-symbols-outlined text-[18px] text-[#7892a4]">search</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={activeConfig.searchPlaceholder} className="min-w-0 flex-1 text-xs outline-none placeholder:text-[#95a6b2]" /></label><select value={collection} onChange={(event) => reset(event.target.value)} className="h-9 min-w-[13rem] rounded-md border border-[#d5e0e8] bg-white px-3 text-xs text-[#526d82] outline-none transition-colors duration-150 hover:border-[#b9cbdc]">{activeConfig.collections.map((item) => <option key={item.collection} value={item.collection}>{item.label}</option>)}</select>{selectedConfig.filterField && <input value={filterInput} onChange={(event) => setFilterInput(event.target.value)} placeholder={selectedConfig.filterLabel} className="h-9 min-w-[10rem] rounded-md border border-[#d5e0e8] bg-white px-3 text-xs text-[#526d82] outline-none transition-colors duration-150 placeholder:text-[#95a6b2] focus:border-[#1681c7]" />}<button type="button" onClick={() => reset()} className="h-9 rounded-md px-2 text-xs font-semibold text-[#687f90] transition-colors duration-150 hover:bg-white">Xóa lọc</button></div>
        <section className="overflow-hidden rounded-lg border border-[#dce5eb] bg-white shadow-card"><div className="flex items-center justify-between border-b border-[#e5edf2] px-3 py-2.5 text-xs text-[#718596]"><span>Hiển thị {result.items.length} trong tổng số {result.total === null ? "-" : result.total.toLocaleString()} kết quả</span><span>Trang {page}/{totalPages}</span></div>{error && <div className="m-3 rounded-md border border-[#f0c7c7] bg-[#fff5f5] px-3 py-2 text-xs text-[#b42318]">{error}</div>}<div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left text-xs"><thead className="bg-[#fbfcfd] text-[10px] font-bold uppercase tracking-wide text-[#62788a]"><tr>{selectedConfig.columns.map((column) => <th key={column.field} className="px-3 py-3">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf1f4]">{loading ? <tr><td colSpan={selectedConfig.columns.length} className="px-3 py-12 text-center text-[#718596]">Đang tải dữ liệu...</td></tr> : result.items.length === 0 ? <tr><td colSpan={selectedConfig.columns.length} className="px-3 py-12 text-center text-[#718596]">Không tìm thấy dữ liệu phù hợp.</td></tr> : result.items.map((item) => <tr key={String(recordId(item))} onClick={() => setSelected(item)} className={`cursor-pointer transition-colors duration-150 hover:bg-[#f4f9fc] ${selected && recordId(selected) === recordId(item) ? "bg-[#eaf5fc] shadow-[inset_2px_0_0_#1681c7]" : ""}`}>{selectedConfig.columns.map((column) => { const value = column.render ? column.render(item) : display(item[column.field]); return <td key={column.field} className="max-w-[15rem] truncate px-3 py-3" title={value}>{value}</td>; })}</tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-[#e5edf2] px-3 py-2.5"><span className="text-[11px] text-[#718596]">{selectedConfig.label}</span><div className="flex gap-1"><PageButton label="chevron_left" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} /><span className="flex h-7 min-w-7 items-center justify-center rounded bg-[#0878bd] px-2 text-[11px] font-bold text-white">{page}</span><PageButton label="chevron_right" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} /></div></div></section>
      </main>
      {selected && <DetailPanel item={selected} config={selectedConfig} color={activeConfig.color} onClose={() => setSelected(null)} />}
    </div>
  </div>;
}

function SidebarLink({ icon, color, label, href, active = false }: { icon: string; color: string; label: string; href?: string; active?: boolean }) { const content = <div className={`flex items-center gap-3 border-l-2 px-4 py-3 text-xs font-semibold transition-colors duration-150 ${active ? "border-[#1681c7] bg-[#edf6fc] text-[#075f9e]" : "border-transparent text-[#526d82] hover:bg-[#f6fafc]"}`}><span className="material-symbols-outlined text-[19px]" style={{ color }}>{icon}</span>{label}</div>; return href ? <a href={href}>{content}</a> : content; }
function PageButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) { return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded border border-[#d5e0e8] text-[#60798d] transition-colors duration-150 enabled:hover:border-[#1681c7] enabled:hover:text-[#0878bd] disabled:opacity-35"><span className="material-symbols-outlined text-[16px]">{label}</span></button>; }
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

  return <aside className="fixed inset-y-[4.25rem] right-0 z-20 w-full max-w-[25rem] overflow-y-auto border-l border-[#dce5eb] bg-white shadow-dock sm:absolute sm:inset-y-[4.25rem]">
    <div className="flex items-start justify-between border-b border-[#e5edf2] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#1474b8]">Chi tiết dữ liệu</p><h2 className="mt-1 text-base font-extrabold text-[#15324d]">{display(item[config.titleField])}</h2></div><button type="button" onClick={onClose} title="Đóng" className="text-[#718596] transition-colors duration-150 hover:text-[#0878bd]"><span className="material-symbols-outlined">close</span></button></div>
    {geometry && <div className="border-b border-[#e5edf2] px-5 py-4">
      <FeatureMiniMap geometry={geometry} color={color} />
      <a href={`/?focus=${encodeURIComponent(config.collection)}:${encodeURIComponent(String(id))}`} className="mt-3 flex h-9 items-center justify-center gap-2 rounded-md bg-[#0878bd] text-xs font-bold text-white transition-colors duration-150 hover:bg-[#075f9e]">
        <span className="material-symbols-outlined text-[16px]">location_on</span>Định vị trên bản đồ
      </a>
    </div>}
    <div className="space-y-4 px-5 py-5">{fields.map((field) => <div key={field.field} className="grid grid-cols-[8rem_1fr] gap-3 text-xs"><strong className="text-[#526d82]">{field.label}</strong><span className="break-words text-[#31546e]">{field.render ? field.render(item) : display(item[field.field])}</span></div>)}</div>
  </aside>;
}
function display(value: unknown): string { return value === null || value === undefined || String(value).trim() === "" ? "-" : String(value); }
function exportCsv(items: CatalogRecord[], config: CatalogCollectionConfig) {
  const rows = [
    config.columns.map((column) => column.label),
    ...items.map((item) => config.columns.map((column) => column.render ? column.render(item) : display(item[column.field]))),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `${config.collection}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
