import { useEffect, useState } from "react";
import {
  countCollection,
  fetchDailyTrend,
  fetchGroupedCounts,
  fetchUpdateSplit,
  type DailyCount,
  type GroupedCount,
} from "../data/directusClient";
import { OVERVIEW_COLLECTIONS, TREND_DAYS, UPDATE_DATE_FIELD, WARD_CHART_COLLECTION, WARD_CHART_FIELD } from "../data/overviewConfig";

const COLOR_PRIMARY = "#0878bd";
const COLOR_MUTED = "#7c8ea0";

type CollectionStat = {
  count: number | null;
  updated: number | null;
  notUpdated: number | null;
  lastUpdated: string | null;
};

export function OverviewDashboard() {
  const [stats, setStats] = useState<Record<string, CollectionStat>>({});
  const [wardCounts, setWardCounts] = useState<GroupedCount[]>([]);
  const [trend, setTrend] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    void (async () => {
      const trackedCollections = OVERVIEW_COLLECTIONS.filter((item) => item.hasUpdateTracking);
      const [wardData, trendPerCollection, perCollectionStats] = await Promise.all([
        fetchGroupedCounts(WARD_CHART_COLLECTION, WARD_CHART_FIELD, 10),
        Promise.all(trackedCollections.map((item) => fetchDailyTrend(item.collection, UPDATE_DATE_FIELD, TREND_DAYS))),
        Promise.all(OVERVIEW_COLLECTIONS.map(async (item) => {
          const [count, split] = await Promise.all([
            countCollection(item.collection),
            item.hasUpdateTracking ? fetchUpdateSplit(item.collection, UPDATE_DATE_FIELD) : Promise.resolve(null),
          ]);
          return [item.collection, {
            count,
            updated: split?.updated ?? null,
            notUpdated: split?.notUpdated ?? null,
            lastUpdated: split?.lastUpdated ?? null,
          }] as const;
        })),
      ]);
      if (disposed) return;
      setWardCounts(wardData);
      const dailyTotals = new Map<string, number>();
      trendPerCollection.flat().forEach(({ date, count }) => dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + count));
      setTrend([...dailyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })));
      setStats(Object.fromEntries(perCollectionStats));
      setLoading(false);
    })();
    return () => { disposed = true; };
  }, []);

  const totalRecords = sumStat(stats, "count");
  const totalUpdated = sumStat(stats, "updated");
  const totalNotUpdated = sumStat(stats, "notUpdated");

  return <div className="min-h-dvh bg-[#f5f7fa] text-[#17344d]">
    <header className="flex min-h-[4.25rem] items-center gap-4 border-b border-[#dce5ec] bg-white px-5 shadow-header">
      <a href="/" className="flex min-w-0 items-center gap-3 text-[#132e57] transition-opacity duration-150 hover:opacity-80" title="Về bản đồ"><img src="/images/logo/Logo_IOC.png" alt="IOC Huế" className="h-10 w-14 object-contain" /><span className="truncate text-base font-extrabold uppercase tracking-[-0.02em]">Hệ thống bản đồ số theo dõi dữ liệu số hóa</span></a>
      <a href="/statics" className="ml-auto flex h-9 items-center gap-2 rounded-md border border-[#d5e0e8] px-3 text-xs font-semibold text-[#526d82] transition-colors duration-150 hover:border-[#b9cbdc] hover:bg-[#f6fafc]"><span className="material-symbols-outlined text-[17px]">layers</span>Xem danh sách chi tiết</a>
    </header>
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0878bd]">Thống kê</p><h1 className="mt-1 text-lg font-extrabold text-[#15324d]">Tổng quan dữ liệu số hóa</h1><p className="mt-1 text-xs text-[#718596]">Số liệu tổng hợp trực tiếp từ Directus trên {OVERVIEW_COLLECTIONS.length} collection.</p></div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon="dataset" label="Tổng dữ liệu" value={formatNumber(totalRecords, loading)} color={COLOR_PRIMARY} />
        <StatTile icon="check_circle" label="Đã cập nhật" value={formatNumber(totalUpdated, loading)} color={COLOR_PRIMARY} />
        <StatTile icon="update" label="Chưa cập nhật" value={formatNumber(totalNotUpdated, loading)} color={COLOR_MUTED} />
        <StatTile icon="layers" label="Số lớp dữ liệu" value={String(OVERVIEW_COLLECTIONS.length)} color={COLOR_PRIMARY} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={`Thửa đất theo phường, xã`} subtitle="Top 10 nhiều dữ liệu nhất">
          {loading ? <ChartSkeleton /> : wardCounts.length ? <WardBarChart data={wardCounts} /> : <EmptyChart />}
        </ChartCard>
        <ChartCard title="Đã / chưa cập nhật" subtitle="Gộp 3 lớp có theo dõi ngày cập nhật">
          {loading ? <ChartSkeleton /> : (totalUpdated ?? 0) + (totalNotUpdated ?? 0) > 0
            ? <UpdateDonut updated={totalUpdated ?? 0} notUpdated={totalNotUpdated ?? 0} />
            : <EmptyChart />}
        </ChartCard>
      </div>

      <ChartCard title="Xu hướng cập nhật theo ngày" subtitle={`${TREND_DAYS} ngày gần nhất — gộp 3 lớp có theo dõi ngày cập nhật`} className="mb-5">
        {loading ? <ChartSkeleton height="h-44" /> : trend.length ? <TrendLineChart data={trend} /> : <EmptyChart />}
      </ChartCard>

      <section className="overflow-hidden rounded-lg border border-[#dce5eb] bg-white shadow-card">
        <div className="border-b border-[#e5edf2] px-4 py-3"><h2 className="text-sm font-bold text-[#15324d]">Tổng hợp theo lớp dữ liệu</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-[#fbfcfd] text-[10px] font-bold uppercase tracking-wide text-[#62788a]">
              <tr>
                <th className="px-4 py-3">Lớp dữ liệu</th>
                <th className="px-4 py-3 text-right">Tổng số</th>
                <th className="px-4 py-3 text-right">Đã cập nhật</th>
                <th className="px-4 py-3 text-right">Chưa cập nhật</th>
                <th className="px-4 py-3">Cập nhật cuối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f4]">
              {OVERVIEW_COLLECTIONS.map((item) => {
                const stat = stats[item.collection];
                return <tr key={item.collection} className="transition-colors duration-150 hover:bg-[#f4f9fc]">
                  <td className="px-4 py-3 font-medium text-[#29475e]">{item.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{loading ? "…" : formatNumber(stat?.count ?? null, false)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{loading ? "…" : item.hasUpdateTracking ? formatNumber(stat?.updated ?? null, false) : <span className="text-[#c3ccd6]">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{loading ? "…" : item.hasUpdateTracking ? formatNumber(stat?.notUpdated ?? null, false) : <span className="text-[#c3ccd6]">—</span>}</td>
                  <td className="px-4 py-3 text-[#718596]">{loading ? "…" : formatDateTime(stat?.lastUpdated ?? null)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>;
}

function sumStat(stats: Record<string, CollectionStat>, key: "count" | "updated" | "notUpdated"): number | null {
  const values = Object.values(stats).map((stat) => stat[key]).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function formatNumber(value: number | null, loading: boolean): string {
  if (loading && value === null) return "…";
  return value === null ? "-" : value.toLocaleString("vi");
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const datePart = date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function StatTile({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#e1e8ee] bg-white px-4 py-3.5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1a`, color }}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-[#718596]">{label}</p>
        <p className="text-lg font-bold text-[#15324d] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, className, children }: { title: string; subtitle: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-[#dce5eb] bg-white p-4 shadow-card ${className ?? ""}`}>
      <h2 className="text-sm font-bold text-[#15324d]">{title}</h2>
      <p className="mb-3 text-[11px] text-[#95a6b2]">{subtitle}</p>
      {children}
    </div>
  );
}

function ChartSkeleton({ height = "h-52" }: { height?: string }) {
  return <div className={`${height} animate-pulse rounded-md bg-[#f3f6f8]`} />;
}

function EmptyChart() {
  return <div className="flex h-32 items-center justify-center text-xs text-[#95a6b2]">Chưa có dữ liệu.</div>;
}

function WardBarChart({ data }: { data: GroupedCount[] }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-xs text-[#526d82]" title={item.label}>{item.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-md bg-[#eef2f6]">
            <div className="h-4 rounded-r-md bg-[#0878bd] transition-[width] duration-500 ease-out" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-[#15324d]">{item.count.toLocaleString("vi")}</span>
        </div>
      ))}
    </div>
  );
}

function UpdateDonut({ updated, notUpdated }: { updated: number; notUpdated: number }) {
  const total = updated + notUpdated || 1;
  const updatedPct = (updated / total) * 100;
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${COLOR_PRIMARY} 0% ${updatedPct}%, ${COLOR_MUTED} ${updatedPct}% 100%)` }}>
        <div className="absolute inset-2.5 flex items-center justify-center rounded-full bg-white">
          <span className="text-lg font-bold text-[#15324d]">{updatedPct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="space-y-2 text-xs">
        <LegendRow color={COLOR_PRIMARY} label="Đã cập nhật" value={updated} />
        <LegendRow color={COLOR_MUTED} label="Chưa cập nhật" value={notUpdated} />
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[#526d82]">{label}</span>
      <span className="font-semibold tabular-nums text-[#15324d]">{value.toLocaleString("vi")}</span>
    </div>
  );
}

function TrendLineChart({ data }: { data: DailyCount[] }) {
  const width = 900;
  const height = 176;
  const paddingLeft = 8;
  const paddingRight = 8;
  const paddingTop = 16;
  const paddingBottom = 24;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const max = Math.max(...data.map((item) => item.count), 1);
  const points = data.map((item, index) => {
    const x = paddingLeft + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = paddingTop + innerHeight - (item.count / max) * innerHeight;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const baselineY = paddingTop + innerHeight;
  const areaPath = `${linePath} L${points[points.length - 1][0]},${baselineY} L${points[0][0]},${baselineY} Z`;
  const last = data[data.length - 1];
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Xu hướng cập nhật theo ngày">
      {[0, 0.5, 1].map((step) => {
        const y = paddingTop + innerHeight * (1 - step);
        return <line key={step} x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="#e5edf2" strokeWidth={1} />;
      })}
      <path d={areaPath} fill={COLOR_PRIMARY} opacity={0.1} stroke="none" />
      <path d={linePath} fill="none" stroke={COLOR_PRIMARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={5} fill={COLOR_PRIMARY} stroke="#ffffff" strokeWidth={2} />
      <text x={lastX} y={lastY - 12} textAnchor="end" fontSize={11} fontWeight={700} fill="#15324d">{last.count.toLocaleString("vi")}</text>
      <text x={paddingLeft} y={height - 4} fontSize={10} fill="#95a6b2">{formatShortDate(data[0].date)}</text>
      <text x={width - paddingRight} y={height - 4} textAnchor="end" fontSize={10} fill="#95a6b2">{formatShortDate(last.date)}</text>
    </svg>
  );
}

function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}
