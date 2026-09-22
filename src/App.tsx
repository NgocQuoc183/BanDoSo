import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { AdministrativeMenu } from "./components/AdministrativeMenu";
import { AppFooter, AppHeader } from "./components/Layout";
import type { HeaderSearchResult } from "./components/Layout";
import { CityInfoPanel, DataOverviewPanel, ProjectInfoPanel, ProjectLegendPanel, WardInfoPanel } from "./components/InfoPanels";
import { MvtInfoPanel } from "./components/MvtInfoPanel";
import { useAdministrativeMap } from "./map/useAdministrativeMap";
import { appLanguage, getLocalizedDataValue } from "./i18n/localizedData";
import { DIRECTUS_COLLECTIONS } from "./data/directusCollections";
import { countCollection } from "./data/directusClient";
import { CollectionDashboard } from "./components/CollectionDashboard";
import { OverviewDashboard } from "./components/OverviewDashboard";
import { MonitoringDashboard } from "./components/MonitoringDashboard";
import { ENVIRONMENT_CONFIG, LAND_CONFIG, MONITORING_CONFIG, PLANNING_CONFIG, SCIENCE_CONFIG, TELECOM_CONFIG } from "./data/dashboardConfigs";

export default function App() {
  return (
    <Routes>
      <Route path="/overview" element={<OverviewDashboard />} />
      <Route path="/monitoring" element={<MonitoringDashboard />} />
      <Route path="/statics" element={<CollectionDashboard configs={[LAND_CONFIG, PLANNING_CONFIG, ENVIRONMENT_CONFIG, MONITORING_CONFIG, SCIENCE_CONFIG, TELECOM_CONFIG]} />} />
      <Route path="/dashboard" element={<CollectionDashboard configs={[LAND_CONFIG, PLANNING_CONFIG, ENVIRONMENT_CONFIG, MONITORING_CONFIG, SCIENCE_CONFIG, TELECOM_CONFIG]} />} />
      <Route path="*" element={<MapApp />} />
    </Routes>
  );
}

function MapApp() {
  const { t, i18n } = useTranslation();
  const language = appLanguage(i18n.resolvedLanguage ?? i18n.language);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number | null>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const countsLoadedRef = useRef(false);
  const map = useAdministrativeMap(containerRef);
  useEffect(() => {
    if (!overviewOpen || countsLoadedRef.current) return;
    countsLoadedRef.current = true;
    let disposed = false;
    setCountsLoading(true);
    void Promise.all(DIRECTUS_COLLECTIONS.map(async (collection) => [collection, await countCollection(collection)] as const))
      .then((entries) => {
        if (!disposed) setCollectionCounts(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!disposed) setCountsLoading(false);
      });
    return () => { disposed = true; };
  }, [overviewOpen]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("header.title");
  }, [language, t]);
  const allSearchResults = useMemo<HeaderSearchResult[]>(() => {
    const query = normalizeSearch(search);
    if (!query) return [];

    const wardResults = map.wards.map((ward) => {
      const title = getLocalizedDataValue(ward.properties, ["nhanBanDo", "nhan", "Nhan", "diaDanh"], language).value || ward.label || ward.name;
      const type = getLocalizedDataValue(ward.properties, ["danhTuChung", "danhTuChun"], language).value || ward.type;
      return { ward, title, type };
    }).filter(({ ward, title, type }) =>
      normalizeSearch([title, ward.name, ward.label, ward.code, type].join(" ")).includes(query),
    ).map(({ ward, title, type }) => ({
        id: ward.id,
        kind: "ward" as const,
        title,
        layer: t("search.administrativeLayer"),
        detail: ward.code ? t("search.unitCode", { code: ward.code }) : type,
        color: "#0878bd",
      }));

    const projectResults = map.projects.map((project) => {
      const name = getLocalizedDataValue(project.properties, ["tenDuAn", "name"], language).value || project.name;
      const location = getLocalizedDataValue(project.properties, ["diaDiem"], language).value || project.location;
      const investor = getLocalizedDataValue(project.properties, ["nhaDauTu", "chuDauTu"], language).value || project.investor;
      const category = t(`projectCategories.${project.categoryId}`);
      return { project, name, location, investor, category };
    }).filter(({ project, name, location, investor, category }) =>
      normalizeSearch([name, location, investor, category, project.name, project.location].join(" ")).includes(query),
    ).map(({ project, name, location, investor, category }) => ({
        id: `${project.categoryId}:${project.id}`,
        kind: "project" as const,
        title: name,
        layer: t("search.projectLayer", { category }),
        detail: location || investor,
        color: project.color,
      }));

    return [...wardResults, ...projectResults];
  }, [language, map.projects, map.wards, search, t]);

  const selectSearchResult = (result: HeaderSearchResult) => {
    setSearch(result.title);
    if (result.kind === "ward") {
      const ward = map.wards.find((item) => item.id === result.id);
      if (ward) map.selectWard(ward);
      return;
    }
    const separator = result.id.indexOf(":");
    const categoryId = result.id.slice(0, separator);
    const projectId = result.id.slice(separator + 1);
    const project = map.projects.find(
      (item) => item.categoryId === categoryId && item.id === projectId,
    );
    if (project) map.selectProject(project);
  };

  return <div className="flex h-dvh min-h-[32rem] w-full flex-col overflow-hidden bg-[#f3f7fb] text-[#15324d]">
    <AppHeader search={search} searchResults={allSearchResults.slice(0, 12)} totalSearchResults={allSearchResults.length} onSearchChange={setSearch} onSearchResultSelect={selectSearchResult} onMenuToggle={() => setMenuOpen((open) => !open)} />
    <main className="relative flex min-h-0 flex-1 overflow-hidden">
      {menuOpen && <button type="button" aria-label={t("common.closeMenu")} onClick={() => setMenuOpen(false)} className="absolute inset-0 z-30 bg-[#102f4c]/35 backdrop-blur-[1px] lg:hidden" />}
      {menuOpen && <div className="absolute inset-y-0 left-0 z-40 lg:static lg:z-20">
        <AdministrativeMenu wards={map.wards} hiddenWardIds={map.hiddenWardIds} selectedWardId={map.selectedWard?.id ?? null} loading={map.loading} error={map.error} cityVisible={map.cityVisible} citySelected={map.citySelected} projectLayerVisible={map.projectLayerVisible} mvtLayers={map.mvtLayers} visibleMvtCollections={map.visibleMvtCollections} onClose={() => setMenuOpen(false)} onToggleCity={map.toggleCity} onSelectCity={map.selectCity} onToggleProjectLayer={map.toggleProjectLayer} onActivateProjectLayer={map.activateProjectLayer} onToggleAll={map.toggleAll} onViewAll={map.clearSelection} onToggleMvtLayer={map.toggleMvtLayer} />
      </div>}
      <section className="relative min-w-0 flex-1 overflow-hidden" aria-label={t("map.ariaLabel")}>
        <div ref={containerRef} className="h-full w-full" />
        {!overviewOpen && !map.citySelected && !map.projectLayerVisible && !map.selectedWard && !map.selectedProject && !map.selectedMvtFeature && (
          <button type="button" onClick={() => setOverviewOpen(true)} title={t("overview.open")} className="absolute right-4 top-4 z-20 flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-[#075f9e] shadow-[0_5px_18px_rgba(15,65,101,0.22)] hover:bg-[#f2f8fc]">
            <span className="material-symbols-outlined text-[18px]">analytics</span>{t("overview.button")}
          </button>
        )}
        {overviewOpen && <DataOverviewPanel collectionCounts={collectionCounts} readableCollections={Object.values(collectionCounts).filter((count) => count !== null).length} totalCollections={DIRECTUS_COLLECTIONS.length} loading={countsLoading} onClose={() => setOverviewOpen(false)} />}
        {map.citySelected && <CityInfoPanel onClose={map.clearSelection} />}
        {map.projectLayerVisible && <ProjectLegendPanel categoryVisibility={map.projectCategoryVisibility} onToggleCategory={map.toggleProjectCategory} onClose={() => map.toggleProjectLayer(false)} />}
        {map.loading && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/60"><div className="flex flex-col items-center gap-3 rounded-xl border border-[#d5deea] bg-white px-6 py-4 shadow-lg"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0878bd] border-t-transparent" /><p className="text-sm text-[#526174]">{t("map.loading")}</p></div></div>}
        {!map.loading && map.error && <div className="absolute left-1/2 top-14 z-20 max-w-sm -translate-x-1/2 rounded-lg border border-[#d71920] bg-white/95 px-4 py-2 text-center text-xs text-[#b71319] shadow-lg">{map.error}</div>}
        {map.selectedWard && <WardInfoPanel ward={map.selectedWard} onClose={map.clearSelection} />}
        {map.selectedProject && <ProjectInfoPanel project={map.selectedProject} onClose={map.clearSelection} />}
        {map.selectedMvtFeature && <MvtInfoPanel feature={map.selectedMvtFeature} onClose={map.clearSelection} />}
        {!menuOpen && <button type="button" aria-label={t("common.openMenu")} onClick={() => setMenuOpen(true)} className="absolute bottom-4 left-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#0769aa] text-white shadow-[0_6px_20px_rgba(7,105,170,0.35)]"><span className="material-symbols-outlined">layers</span></button>}
      </section>
    </main>
    <AppFooter />
  </div>;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .trim();
}
