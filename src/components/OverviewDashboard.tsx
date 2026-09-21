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
import { Badge, type BadgeTone } from "./Badge";

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
  const lastUpdatedDates = Object.values(stats)
    .map((stat) => stat.lastUpdated)
    .filter((value): value is string => Boolean(value))
    .sort();
  const overallLastUpdated = lastUpdatedDates.length ? lastUpdatedDates[lastUpdatedDates.length - 1] : null;

  return <div className="min-h-dvh bg-surface text-ink-900">
    <header className="flex min-h-[4.25rem] items-center gap-4 border-b border-line bg-white px-5 shadow-header">
      <a href="/" className="flex min-w-0 items-center gap-3 text-ink-900 transition-opacity duration-150 hover:opacity-80" title="Về bản đồ"><img src="/images/logo/Logo_IOC.png" alt="IOC Huế" className="h-10 w-14 object-contain" /><span className="truncate text-base font-extrabold uppercase tracking-[-0.02em]">Hệ thống bản đồ số theo dõi dữ liệu số hóa</span></a>
      <a href="/statics" className="ml-auto flex h-9 items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold text-ink-500 transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted"><span className="material-symbols-outlined text-[17px]">layers</span>Xem danh sách chi tiết</a>
    </header>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Tổng quan</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink-900">Tổng quan hệ thống dữ liệu số</h1>
          <p className="mt-1.5 max-w-2xl text-xs text-ink-500">Số liệu tổng hợp trực tiếp từ Directus trên {OVERVIEW_COLLECTIONS.length} lớp dữ liệu — quy mô, tình trạng và xu hướng cập nhật.</p>
        </div>
        {overallLastUpdated && (
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-[11px] text-ink-500">
            <span className="material-symbols-outlined text-[16px] text-ink-400">update</span>
            Cập nhật lần cuối:&nbsp;<span className="font-semibold text-ink-700">{formatDateTime(overallLastUpdated)}</span>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="dataset" label="Tổng dữ liệu" value={formatNumber(totalRecords, loading)} color={COLOR_PRIMARY} />
        <StatTile icon="check_circle" label="Đã cập nhật" value={formatNumber(totalUpdated, loading)} color={COLOR_PRIMARY} />
        <StatTile icon="update" label="Chưa cập nhật" value={formatNumber(totalNotUpdated, loading)} color={COLOR_MUTED} />
        <StatTile icon="layers" label="Lớp dữ liệu" value={String(OVERVIEW_COLLECTIONS.length)} color={COLOR_PRIMARY} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Thửa đất theo phường, xã" subtitle="Top 10 phường, xã có nhiều dữ liệu nhất">
          {loading ? <ChartSkeleton /> : wardCounts.length ? <WardBarChart data={wardCounts} /> : <EmptyChart />}
        </ChartCard>
        <ChartCard title="Đã / chưa cập nhật" subtitle="Gộp 3 lớp có theo dõi ngày cập nhật">
          {loading ? <ChartSkeleton /> : (totalUpdated ?? 0) + (totalNotUpdated ?? 0) > 0
            ? <UpdateDonut updated={totalUpdated ?? 0} notUpdated={totalNotUpdated ?? 0} />
            : <EmptyChart />}
        </ChartCard>
      </div>

      <ChartCard title="Xu hướng cập nhật theo ngày" subtitle="Số bản ghi cập nhật mỗi ngày — gộp 3 lớp có theo dõi ngày cập nhật" period={`${TREND_DAYS} ngày gần nhất`} className="mb-5">
        {loading ? <ChartSkeleton height="h-44" /> : trend.length ? <TrendLineChart data={trend} /> : <EmptyChart />}
      </ChartCard>

      <section className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="border-b border-line px-4 py-3.5">
          <h2 className="text-sm font-bold text-ink-900">Tổng hợp theo lớp dữ liệu</h2>
          <p className="mt-0.5 text-[11px] text-ink-400">Thống kê số lượng và tình trạng cập nhật của các lớp dữ liệu.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-[12.5px]">
            <thead className="border-b border-line-strong bg-surface-muted text-[10px] font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Lớp dữ liệu</th>
                <th className="px-4 py-3 text-right">Tổng số</th>
                <th className="px-4 py-3 text-right">Đã cập nhật</th>
                <th className="px-4 py-3 text-right">Chưa cập nhật</th>
                <th className="px-4 py-3">Cập nhật cuối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {OVERVIEW_COLLECTIONS.map((item) => {
                const stat = stats[item.collection];
                const status = !loading ? updateStatus(item.hasUpdateTracking, stat) : null;
                return <tr key={item.collection} className="transition-colors duration-150 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-700">{item.label}</span>
                      {status && <Badge tone={status.tone}>{status.label}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink-900">{loading ? "…" : formatNumber(stat?.count ?? null, false)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{loading ? "…" : item.hasUpdateTracking ? formatNumber(stat?.updated ?? null, false) : <span className="text-ink-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{loading ? "…" : item.hasUpdateTracking ? formatNumber(stat?.notUpdated ?? null, false) : <span className="text-ink-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-400">{loading ? "…" : formatDateTime(stat?.lastUpdated ?? null)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>;
}

// Suy ra trạng thái từ đúng số liệu đã có (updated/notUpdated) — không bịa dữ
// liệu cho các collection không theo dõi ngày cập nhật (trả về null, bảng vẫn
// hiện "—" như cũ cho các collection đó).
function updateStatus(hasUpdateTracking: boolean, stat: CollectionStat | undefined): { label: string; tone: BadgeTone } | null {
  if (!hasUpdateTracking || !stat || stat.updated === null || stat.notUpdated === null) return null;
  const total = stat.updated + stat.notUpdated;
  if (total === 0) return null;
  if (stat.notUpdated === 0) return { label: "Đã cập nhật", tone: "success" };
  if (stat.updated === 0) return { label: "Chưa cập nhật", tone: "neutral" };
  return { label: "Đang cập nhật", tone: "info" };
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
    <div className="rounded-lg border border-line bg-white px-4 py-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">
        <span className="material-symbols-outlined text-[15px]" style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-[1.75rem] font-extrabold leading-none tabular-nums text-ink-900">{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, period, className, children }: { title: string; subtitle: string; period?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-line bg-white p-4 ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-[11px] text-ink-400">{subtitle}</p>
        </div>
        {period && <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-semibold text-ink-500">{period}</span>}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton({ height = "h-52" }: { height?: string }) {
  return <div className={`${height} animate-pulse rounded-md bg-surface-muted`} />;
}

function EmptyChart() {
  return <div className="flex h-32 items-center justify-center text-xs text-ink-300">Chưa có dữ liệu.</div>;
}

function WardBarChart({ data }: { data: GroupedCount[] }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-xs text-ink-500" title={item.label}>{item.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-md bg-[#eef2f6]">
            <div className="h-4 rounded-r-md bg-accent transition-[width] duration-500 ease-out" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-900">{item.count.toLocaleString("vi")}</span>
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
          <span className="text-lg font-bold text-ink-900">{updatedPct.toFixed(0)}%</span>
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
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold tabular-nums text-ink-900">{value.toLocaleString("vi")}</span>
    </div>
  );
}

function TrendLineChart({ data }: { data: DailyCount[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 900;
  const height = 168;
  const paddingLeft = 34;
  const paddingRight = 8;
  const paddingTop = 16;
  const paddingBottom = 24;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const max = Math.max(...data.map((item) => item.count), 1);
  const colWidth = innerWidth / Math.max(data.length - 1, 1);
  const points = data.map((item, index) => {
    const x = paddingLeft + index * colWidth;
    const y = paddingTop + innerHeight - (item.count / max) * innerHeight;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const baselineY = paddingTop + innerHeight;
  const areaPath = `${linePath} L${points[points.length - 1][0]},${baselineY} L${points[0][0]},${baselineY} Z`;
  const last = data[data.length - 1];
  const [lastX, lastY] = points[points.length - 1];
  const tooltip = hoverIndex !== null ? { item: data[hoverIndex], x: points[hoverIndex][0], y: points[hoverIndex][1] } : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Xu hướng cập nhật theo ngày">
        {[0, 0.5, 1].map((step) => {
          const y = paddingTop + innerHeight * (1 - step);
          return (
            <g key={step}>
              <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" fontSize={10} fill="var(--color-ink-300)">{Math.round(max * step).toLocaleString("vi")}</text>
            </g>
          );
        })}
        <path d={areaPath} fill={COLOR_PRIMARY} opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={COLOR_PRIMARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], index) => (
          <circle key={data[index].date} cx={x} cy={y} r={index === hoverIndex || index === points.length - 1 ? 4.5 : 0} fill={COLOR_PRIMARY} stroke="#ffffff" strokeWidth={2} />
        ))}
        {data.map((item, index) => (
          <rect key={item.date} x={paddingLeft + index * colWidth - colWidth / 2} y={paddingTop} width={colWidth} height={innerHeight} fill="transparent"
            onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))} />
        ))}
        <text x={lastX} y={lastY - 12} textAnchor="end" fontSize={11} fontWeight={700} fill="var(--color-ink-900)">{last.count.toLocaleString("vi")}</text>
        <text x={paddingLeft} y={height - 4} fontSize={10} fill="var(--color-ink-300)">{formatShortDate(data[0].date)}</text>
        <text x={width - paddingRight} y={height - 4} textAnchor="end" fontSize={10} fill="var(--color-ink-300)">{formatShortDate(last.date)}</text>
      </svg>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-white px-2.5 py-1.5 text-[11px] shadow-card"
          style={{ left: `${(tooltip.x / width) * 100}%`, top: `${(tooltip.y / height) * 100}%`, transform: "translate(-50%, calc(-100% - 8px))" }}
        >
          <div className="font-semibold text-ink-900">{tooltip.item.count.toLocaleString("vi")} bản ghi</div>
          <div className="text-ink-400">{formatShortDate(tooltip.item.date)}</div>
        </div>
      )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}
