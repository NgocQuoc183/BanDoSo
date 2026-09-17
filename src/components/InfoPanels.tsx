import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { appLanguage, getLocalizedDataValue } from "../i18n/localizedData";
import { PROJECT_CATEGORIES } from "../map/projectLayers";
import type {
  ProjectCategoryId,
  SelectedProject,
  Ward,
} from "../map/types";

export function DataOverviewPanel({
  collectionCounts,
  readableCollections,
  totalCollections,
  loading,
  onClose,
}: {
  collectionCounts: Record<string, number | null>;
  readableCollections: number;
  totalCollections: number;
  loading: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const count = (collection: string) => collectionCounts[collection] ?? null;
  const groups = [
    { icon: "landscape", label: t("overview.landParcels"), value: count("thua_dat") },
    { icon: "factory", label: t("overview.industrialParks"), value: sumCounts(collectionCounts, ["gisportal_HienTrangKhuCongNghiep_P", "gisportal_DinhHuongPhatTrienKhuCongNghiep_P"]) },
    { icon: "delete_sweep", label: t("overview.wasteFacilities"), value: sumCounts(collectionCounts, ["gisportal_HienTrangKhuXuLyChatThai_P", "gisportal_DinhHuongKhuXuLyChatThai_P"]) },
    { icon: "account_balance", label: t("overview.cemeteries"), value: sumCounts(collectionCounts, ["gisportal_HienTrangNghiaTrang_P", "gisportal_DinhHuongNghiaTrang_P"]) },
    { icon: "sensors", label: t("overview.monitoringStations"), value: sumCounts(collectionCounts, ["bts", "rain_water_stations", "water_level_station", "iot_wind_station"]) },
    { icon: "science", label: t("overview.scienceTech"), value: sumCounts(collectionCounts, ["gisportal_DinhHuongKhuCongNgheCao_P", "gisportal_DinhHuongCoSoKHCN_P", "gisportal_HienTrangCoSoKHCN_P"]) },
  ];
  const countValues = Object.values(collectionCounts);
  const totalObjects = countValues.length > 0 && countValues.some((value) => value !== null)
    ? countValues.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;

  return (
    <section className="absolute right-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-[min(21rem,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border border-[#cbd8e8] bg-white/95 shadow-[0_8px_30px_rgba(23,38,60,0.18)] backdrop-blur-sm">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#d5deea] bg-[#f8fafc] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[19px] text-[#0878bd]">analytics</span>
          <h2 className="text-sm font-bold text-[#17263c]">{t("overview.title")}</h2>
        </div>
        <button type="button" onClick={onClose} title={t("common.close")} className="text-[#68778a] hover:text-[#0878bd]">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-px bg-[#e8edf2]">
          <OverviewMetric icon="dataset" label={t("overview.totalObjects")} value={totalObjects} loading={loading} />
          <OverviewMetric icon="verified" label={t("overview.readableCollections")} value={`${readableCollections}/${totalCollections}`} loading={loading} />
        </div>
        <div className="border-t border-[#e8edf2] px-3.5 py-2.5">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6b8092]">{t("overview.detailTitle")}</h3>
          <div className="space-y-1.5">
          {groups.map((stat) => (
            <div key={stat.label} className="bg-white px-3.5 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[17px] text-[#6a879b]">{stat.icon}</span>
                <span className="flex-1 text-xs text-[#31546e]">{stat.label}</span>
                <strong className="text-sm text-[#15324d]">{formatCount(stat.value, loading)}</strong>
              </div>
            </div>
          ))}
          </div>
        </div>
        <p className="border-t border-[#e8edf2] px-4 py-2 text-[10px] leading-4 text-[#718596]">
          {t("overview.note")}
        </p>
      </div>
      <div className="shrink-0 border-t border-[#e8edf2] px-4 py-3">
        <a href="/statics" className="flex h-9 items-center justify-center gap-2 rounded-md bg-[#0878bd] text-xs font-bold text-white hover:bg-[#075f9e]">
          <span className="material-symbols-outlined text-[17px]">open_in_new</span>
          {t("overview.viewDetails")}
        </a>
      </div>
    </section>
  );
}

function OverviewMetric({ icon, label, value, loading }: { icon: string; label: string; value: number | string | null; loading: boolean }) {
  return <div className="bg-white px-3.5 py-3"><span className="material-symbols-outlined text-[18px] text-[#6a879b]">{icon}</span><strong className="mt-1 block text-xl leading-none text-[#15324d]">{typeof value === "string" ? value : formatCount(value, loading)}</strong><span className="mt-1 block text-[10px] leading-4 text-[#718596]">{label}</span></div>;
}

function formatCount(value: number | null, loading: boolean): string {
  if (loading && value === null) return "...";
  return value === null ? "-" : value.toLocaleString();
}

function sumCounts(counts: Record<string, number | null>, collections: string[]): number | null {
  const values = collections.map((collection) => counts[collection]);
  if (values.every((value) => value === null || value === undefined)) return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function CityInfoPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="absolute right-4 top-4 z-10 w-[25rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-[#cbd8e8] bg-white/95 shadow-[0_8px_30px_rgba(23,38,60,0.18)] backdrop-blur-sm">
      <header className="flex items-center justify-between gap-2 border-b border-[#d5deea] bg-[#f8fafc] px-4 py-3">
        <h2 className="font-serif text-base font-bold text-[#17263c]">
          {t("city.title")}
        </h2>
        <CloseButton onClose={onClose} />
      </header>
      <div className="space-y-4 px-4 py-3 text-sm leading-relaxed text-[#17263c]">
        <Item icon="account_balance" label={t("city.administrativeUnits")}>
          {t("city.administrativeValue")}
          <p className="mt-1 text-xs italic text-[#68778a]">
            {t("city.resolution")}
          </p>
        </Item>
        <Item icon="straighten" label={t("city.area")}>
          <strong>4.947,11 km²</strong>
        </Item>
        <Item icon="groups" label={t("city.population")}>
          <strong>1.236.393 {t("city.people")}</strong>
        </Item>
      </div>
    </section>
  );
}

export function WardInfoPanel({
  ward,
  onClose,
}: {
  ward: Ward;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = appLanguage(i18n.resolvedLanguage ?? i18n.language);
  const name = getLocalizedDataValue(ward.properties, ["nhanBanDo", "nhan", "Nhan", "diaDanh"], language);
  const geographicPosition = getLocalizedDataValue(ward.properties, ["viTriDiaLy"], language);
  const committeeAddress = getLocalizedDataValue(ward.properties, ["diaChiUB"], language);
  const note = getLocalizedDataValue(ward.properties, ["GhiChu"], language);
  const usesFallback = [name, geographicPosition, committeeAddress, note].some((item) => item.value && item.isFallback);
  return (
    <section className="absolute bottom-4 right-4 z-10 max-h-[calc(100%-2rem)] w-96 max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-[#cbd8e8] bg-white/95 shadow-[0_8px_30px_rgba(23,38,60,0.18)] backdrop-blur-sm">
      <header className="flex items-start justify-between gap-2 border-b border-[#d5deea] bg-[#f8fafc] px-4 py-3">
        <h2 className="font-serif text-base font-bold text-[#17263c]">
          {name.value || ward.label || ward.name}
        </h2>
        <CloseButton onClose={onClose} />
      </header>
      <div className="max-h-[calc(100dvh-7rem)] space-y-2.5 overflow-y-auto px-4 py-3 text-xs text-[#17263c]">
        {usesFallback && <SourceLanguageNotice />}
        {ward.code && <Row label={t("ward.code")} value={ward.code} />}
        {ward.area !== null && (
          <Row label={t("ward.area")} value={`${ward.area.toFixed(2)} km²`} />
        )}
        {ward.population && <Row label={t("ward.population")} value={`${ward.population} ${t("ward.people")}`} />}
        {geographicPosition.value && (
          <Detail label={t("ward.geographicPosition")} value={geographicPosition.value} />
        )}
        {committeeAddress.value && (
          <Detail label={t("ward.committeeAddress")} value={committeeAddress.value} />
        )}
        {note.value && <Detail label={t("ward.note")} value={note.value} />}
      </div>
    </section>
  );
}

export function ProjectLegendPanel({
  categoryVisibility,
  onToggleCategory,
  onClose,
}: {
  categoryVisibility: Record<ProjectCategoryId, boolean>;
  onToggleCategory: (id: ProjectCategoryId, visible: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="absolute right-4 top-4 z-10 w-[22rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-[#cbd8e8] bg-white/95 shadow-[0_8px_30px_rgba(23,38,60,0.18)] backdrop-blur-sm">
      <header className="flex items-center justify-between gap-2 border-b border-[#d5deea] bg-[#f8fafc] px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-[#17263c]">
            {t("project.legendTitle")}
          </h2>
          <p className="mt-0.5 text-[10px] text-[#718596]">
            {t("project.legendHint")}
          </p>
        </div>
        <CloseButton onClose={onClose} title={t("project.closeLayer")} />
      </header>
      <div className="divide-y divide-[#e8edf2] px-3 py-1">
        {PROJECT_CATEGORIES.map((category) => (
          <label
            key={category.id}
            className="flex cursor-pointer items-center gap-2.5 py-2 text-[11px] leading-4 text-[#29475e]"
          >
            <input
              type="checkbox"
              checked={categoryVisibility[category.id]}
              onChange={(event) =>
                onToggleCategory(category.id, event.target.checked)
              }
              className="h-3.5 w-3.5 shrink-0 accent-[#0878bd]"
            />
            <img
              src={category.iconUrl}
              alt=""
              className="h-7 w-5 shrink-0 object-contain"
            />
            <span>{t(`projectCategories.${category.id}`)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export function ProjectInfoPanel({
  project,
  onClose,
}: {
  project: SelectedProject;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = appLanguage(i18n.resolvedLanguage ?? i18n.language);
  const properties = project.properties;
  const projectName = getLocalizedDataValue(properties, ["tenDuAn", "name"], language);
  const detailDefinitions: Array<[string, string[], string?]> = [
    ["project.location", ["diaDiem"]],
    ["project.area", ["dienTich"], "ha"],
    ["project.totalInvestment", ["tongMucDauTu"]],
    ["project.investor", ["nhaDauTu", "chuDauTu"]],
    ["project.description", ["moTa"]],
    ["project.information", ["thongTin"]],
    ["project.implementation", ["tinhHinhThucHien"]],
    ["project.progress", ["tienDoThucHien"]],
    ["project.issues", ["vuongMac"]],
    ["project.proposal", ["deXuat"]],
    ["project.note", ["ghiChu"]],
  ];
  const details = detailDefinitions.map(([labelKey, fields, unit]) => {
    const localized = getLocalizedDataValue(properties, fields, language);
    return { label: t(labelKey), value: unit && localized.value ? `${localized.value} ${unit}` : localized.value, isFallback: localized.isFallback };
  });
  const usesFallback = (projectName.value && projectName.isFallback)
    || details.some((detail) => detail.value && detail.isFallback);

  return (
    <section className="absolute bottom-4 right-4 z-20 max-h-[calc(100%-2rem)] w-[28rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-[#cbd8e8] bg-white/97 shadow-[0_10px_34px_rgba(23,38,60,0.22)] backdrop-blur-sm">
      <header className="flex items-start justify-between gap-3 border-b border-[#d5deea] bg-[#f8fafc] px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: project.color }}
            >
              {t(`projectCategories.${project.categoryId}`)}
            </span>
          </div>
          <h2 className="text-sm font-bold leading-5 text-[#17263c]">
            {projectName.value || t("project.defaultTitle")}
          </h2>
        </div>
        <CloseButton onClose={onClose} />
      </header>
      <div className="max-h-[55dvh] space-y-3 overflow-y-auto px-4 py-3">
        {usesFallback && <SourceLanguageNotice />}
        {details.map(({ label, value }) => value
          ? <ProjectDetail key={label} label={label} value={value} />
          : null)}
      </div>
    </section>
  );
}

function ProjectDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6b8092]">
        {label}
      </div>
      <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[#213e55]">
        {value}
      </p>
    </div>
  );
}

function CloseButton({
  onClose,
  title,
}: {
  onClose: () => void;
  title?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClose}
      title={title ?? t("common.close")}
      className="shrink-0 text-[#68778a] hover:text-[#0878bd]"
    >
      <span className="material-symbols-outlined text-[18px]">close</span>
    </button>
  );
}

function SourceLanguageNotice() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-[#fff7e6] px-2.5 py-1.5 text-[10px] font-medium text-[#8a5a00]">
      <span className="material-symbols-outlined text-[15px]">translate</span>
      {t("common.originalVietnamese")}
    </div>
  );
}

function Item({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="material-symbols-outlined text-[18px] text-[#d71920]">
        {icon}
      </span>
      <div>
        <strong>{label}: </strong>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-[#526174]">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong className="text-[#d71920]">{label}</strong>
      <p className="mt-1 leading-relaxed">{value}</p>
    </div>
  );
}
