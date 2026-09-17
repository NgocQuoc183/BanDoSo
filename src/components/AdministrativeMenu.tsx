import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DynamicMapLayerConfig } from "../map/layerRegistry";
import type { Ward } from "../map/types";

type Props = {
  wards: Ward[];
  hiddenWardIds: ReadonlySet<string>;
  selectedWardId: string | null;
  loading: boolean;
  error: string | null;
  cityVisible: boolean;
  citySelected: boolean;
  projectLayerVisible: boolean;
  mvtLayers: readonly DynamicMapLayerConfig[];
  visibleMvtCollections: ReadonlySet<string>;
  onClose: () => void;
  onToggleCity: (visible: boolean) => void;
  onSelectCity: () => void;
  onToggleProjectLayer: (visible: boolean) => void;
  onActivateProjectLayer: () => void;
  onToggleAll: (visible: boolean) => void;
  onViewAll: () => void;
  onToggleMvtLayer: (config: DynamicMapLayerConfig, visible: boolean) => void;
};

type LayerGroup = {
  id: string;
  titleKey: string;
  icon: string;
  color: string;
  itemKeys: string[];
};

const layerGroups: LayerGroup[] = [
  {
    id: "public",
    titleKey: "menu.public",
    icon: "campaign",
    color: "#1b9b52",
    itemKeys: ["menu.auction"],
  },
  {
    id: "planning",
    titleKey: "menu.planning",
    icon: "map",
    color: "#0878bd",
    itemKeys: [
      "menu.generalPlanning",
      "menu.zoningPlanning",
      "menu.detailedPlanning",
      "menu.landUsePlanning",
    ],
  },
  {
    id: "status",
    titleKey: "menu.status",
    icon: "location_city",
    color: "#68778a",
    itemKeys: ["menu.landUseStatus", "menu.populationStatus"],
  },
  {
    id: "infrastructure",
    titleKey: "menu.infrastructure",
    icon: "account_tree",
    color: "#8b5cf6",
    itemKeys: ["menu.transportInfrastructure", "menu.technicalInfrastructure"],
  },
  {
    id: "specialized",
    titleKey: "menu.specialized",
    icon: "dataset",
    color: "#e78018",
    itemKeys: ["menu.environment", "menu.cultureTourism"],
  },
  //{ id: "base", title: "Lớp nền", icon: "layers", color: "#526174", items: ["Bản đồ nền sáng", "Ảnh vệ tinh"] },
];

export function AdministrativeMenu({
  wards,
  hiddenWardIds,
  selectedWardId,
  loading,
  error,
  cityVisible,
  citySelected,
  projectLayerVisible,
  mvtLayers,
  visibleMvtCollections,
  onClose,
  onToggleCity,
  onSelectCity,
  onToggleProjectLayer,
  onActivateProjectLayer,
  onToggleAll,
  onViewAll,
  onToggleMvtLayer,
}: Props) {
  const { t } = useTranslation();
  const [adminOpen, setAdminOpen] = useState(true);
  const [mvtOpen, setMvtOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [layerNotice, setLayerNotice] = useState(false);
  const noticeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const allVisible = hiddenWardIds.size === 0;
  const partial = hiddenWardIds.size > 0 && hiddenWardIds.size < wards.length;

  const toggleGroup = (id: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const notifyUpdating = () => {
    setLayerNotice(true);
    if (noticeTimerRef.current !== null)
      window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(
      () => setLayerNotice(false),
      2000,
    );
  };

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null)
        window.clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  return (
    <aside className="relative flex h-full w-[17.5rem] max-w-[86vw] shrink-0 flex-col overflow-hidden border-r border-[#d5e1eb] bg-white shadow-[3px_0_14px_rgba(23,38,60,0.12)]">
      <div className="flex h-11 shrink-0 items-center gap-2 bg-gradient-to-r from-[#075a9b] to-[#087fc1] px-3.5 text-white">
        <span className="material-symbols-outlined text-[18px]">layers</span>
        <h2 className="flex-1 text-[11px] font-bold uppercase tracking-[0.035em]">
          {t("menu.title")}
        </h2>
        <button
          type="button"
          aria-label={t("common.closeMenu")}
          title={t("common.closeMenu")}
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/15"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto pb-4">
        <LayerHeader
          title={t("menu.administrative")}
          icon="public"
          color="#0769aa"
          open={adminOpen}
          onClick={() => setAdminOpen((open) => !open)}
        />
        {adminOpen && (
          <div className="border-b border-[#e2e9ef] bg-[#fbfdff]">
            {loading && <StatusLoading />}
            {!loading && error && (
              <div className="p-3 text-xs leading-relaxed text-red-500">
                {error}
              </div>
            )}
            {!loading && !error && (
              <>
                <div
                  className={`flex items-center gap-2 border-t border-[#edf1f5] px-3.5 py-2 text-[12px] font-medium ${citySelected ? "bg-[#eaf5fc] text-[#0769aa] shadow-[inset_3px_0_0_#0878bd]" : "text-[#29475e]"}`}
                >
                  <input
                    type="checkbox"
                    checked={cityVisible}
                    onChange={(event) => onToggleCity(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#0878bd]"
                  />
                  <button
                    type="button"
                    onClick={onSelectCity}
                    className="flex-1 text-left"
                  >
                    {t("menu.city")}
                  </button>
                </div>
                <div
                  className={`flex items-center gap-2 border-t border-[#edf1f5] px-3.5 py-2 text-[12px] font-semibold ${selectedWardId === null ? "bg-[#eaf5fc] text-[#0769aa]" : "text-[#29475e]"}`}
                >
                  <input
                    type="checkbox"
                    checked={allVisible}
                    ref={(input) => {
                      if (input) input.indeterminate = partial;
                    }}
                    onChange={(event) => onToggleAll(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#0878bd]"
                  />
                  <button
                    type="button"
                    onClick={onViewAll}
                    className="flex flex-1 items-center gap-1.5 text-left"
                  >
                    {t("menu.wards")}
                    
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="border-b border-[#e2e9ef]">
          <LayerHeader
            title="Lớp dữ liệu MVT"
            icon="layers"
            color="#075f9e"
            open={mvtOpen}
            onClick={() => setMvtOpen((open) => !open)}
          />
          {mvtOpen && (
            <div className="bg-[#fbfdff] py-0.5">
              {mvtLayers.map((layer) => (
                <label key={layer.collection} className="flex cursor-pointer items-start gap-2 px-3.5 py-2 text-[11px] text-[#526d82] hover:bg-[#edf6fc]">
                  <input
                    type="checkbox"
                    checked={visibleMvtCollections.has(layer.collectionKey)}
                    onChange={(event) => onToggleMvtLayer(layer, event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#0878bd]"
                  />
                  <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[12px] font-semibold text-[#29475e]">{layer.label}</b>
                    <code className="block truncate text-[10px] text-[#718596]">{layer.collection}</code>
                  </span>
                  <span className="shrink-0 text-[10px] text-[#718596]">z≥{layer.minZoom}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {layerGroups.map((group) => {
          const open = openGroups.has(group.id);
          return (
            <div key={group.id} className="border-b border-[#e2e9ef]">
              <LayerHeader
                title={t(group.titleKey)}
                icon={group.icon}
                color={group.color}
                open={open}
                onClick={() => toggleGroup(group.id)}
              />
              {open && (
                <div className="bg-[#fbfdff] py-0.5">
                  {group.id === "public" && (
                    <div
                      className={`flex items-start gap-2 px-3.5 py-2 text-[12px] leading-4 ${projectLayerVisible ? "bg-[#eaf5fc] text-[#0769aa] shadow-[inset_3px_0_0_#0878bd]" : "text-[#526d82] hover:bg-[#edf6fc]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={projectLayerVisible}
                        onChange={(event) =>
                          onToggleProjectLayer(event.target.checked)
                        }
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#0878bd]"
                      />
                      <button
                        type="button"
                        onClick={onActivateProjectLayer}
                        className="flex-1 text-left text-[12px]"
                      >
                        {t("menu.investmentProjects")}
                      </button>
                    </div>
                  )}
                  {group.itemKeys.map((itemKey) => (
                    <button
                      type="button"
                      key={itemKey}
                      onClick={notifyUpdating}
                      className="flex w-full items-start gap-2 px-3.5 py-1.5 text-left text-[10px] leading-4 text-[#657b8d] hover:bg-[#edf6fc] hover:text-[#0769aa]"
                    >
                      <span
                        className="mt-0.5 h-3 w-3 shrink-0  border border-[#9aabb8] bg-white"
                        aria-hidden="true"
                      />
                      <span className="text-[12px]">{t(itemKey)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {layerNotice && (
        <div
          role="status"
          className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 rounded-lg bg-[#153b59] px-3 py-2.5 text-[11px] font-medium text-white shadow-lg"
        >
          <span className="material-symbols-outlined text-[17px] text-[#8ed4ff]">
            info
          </span>
          {t("menu.updating")}
        </div>
      )}
    </aside>
  );
}

function LayerHeader({
  title,
  icon,
  color,
  open,
  onClick,
}: {
  title: string;
  icon: string;
  color: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[11px] font-semibold text-[#29475e] hover:bg-[#f4f8fb]"
    >
      <span
        className="material-symbols-outlined shrink-0 text-[17px]"
        style={{ color }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap">{title}</span>
      <span
        className={`material-symbols-outlined shrink-0 text-[16px] text-[#75899a] transition-transform ${open ? "rotate-180" : ""}`}
      >
        expand_more
      </span>
    </button>
  );
}

function StatusLoading() {
  const { t } = useTranslation();
  return (
    <div className="p-4 text-center text-xs text-[#526174]">
      <div className="mb-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0878bd] border-t-transparent" />
      <p>{t("common.loading")}</p>
    </div>
  );
}
