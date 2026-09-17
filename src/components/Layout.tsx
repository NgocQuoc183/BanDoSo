import { useState } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";

type HeaderProps = {
  search: string;
  searchResults: HeaderSearchResult[];
  totalSearchResults: number;
  onSearchChange: (value: string) => void;
  onSearchResultSelect: (result: HeaderSearchResult) => void;
  onMenuToggle: () => void;
};

export type HeaderSearchResult = {
  id: string;
  kind: "ward" | "project";
  title: string;
  layer: string;
  detail: string;
  color: string;
};

export function AppHeader({
  search,
  searchResults,
  totalSearchResults,
  onSearchChange,
  onSearchResultSelect,
  onMenuToggle,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const [notice, setNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const share = async () => {
    try {
      if (navigator.share)
        await navigator.share({
          title: document.title,
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setNotice(t("header.copied"));
        window.setTimeout(() => setNotice(""), 1800);
      }
    } catch {
      /* Người dùng có thể chủ động đóng hộp thoại chia sẻ. */
    }
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };
  return (
    <header className="relative z-50 flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-[#d9e4ee] bg-white/95 px-3 shadow-header backdrop-blur-sm sm:px-5">
      <button
        type="button"
        aria-label={t("header.toggleMenu")}
        title={t("header.toggleMenu")}
        onClick={onMenuToggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#075f9e] transition-colors duration-150 hover:bg-[#edf6fc] active:bg-[#dcf0fc]"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
      <div className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3">
        <div className="flex h-12 w-14 items-center justify-center overflow-hidden sm:w-16">
          <img
            src="/images/logo/Logo_IOC.png"
            alt="Logo IOC Huế"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="hidden min-w-0 sm:block">
          <h1 className="truncate text-base font-extrabold uppercase tracking-[-0.025em] text-[#075b9b] lg:text-xl">
            {t("header.title")}
          </h1>
          <p className="mt-0.5 hidden text-[10px] font-medium tracking-[0.035em] text-[#60798d] md:block">
            {t("header.slogan")}
          </p>
        </div>
      </div>
      <div
        className="relative ml-auto min-w-0 max-w-md flex-1"
        onFocusCapture={() => setSearchOpen(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setSearchOpen(false);
        }}
      >
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[#d7e1ea] bg-[#f8fafc] px-3 transition-all duration-150 focus-within:border-[#0782c8] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(7,130,200,0.1)]">
          <span className="material-symbols-outlined text-[20px] text-[#648096]">
            search
          </span>
          <input
            value={search}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setSearchOpen(true);
            }}
            placeholder={t("header.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-xs text-[#17344d] outline-none placeholder:text-[#8295a5] sm:text-sm"
          />
          {search && (
            <button
              type="button"
              aria-label={t("header.clearSearch")}
              onClick={() => onSearchChange("")}
              className="text-[#7890a3] transition-colors duration-150 hover:text-[#0878bd]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </label>
        {searchOpen && search.trim() && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(28rem,70dvh)] overflow-y-auto rounded-xl border border-[#d5e1eb] bg-white shadow-panel">
            <div className="flex items-center justify-between border-b border-[#e4ebf1] px-3 py-2 text-[10px] text-[#718596]">
              <span>{t("header.searchResults")}</span>
              <span>{t("header.resultCount", { count: totalSearchResults })}</span>
            </div>
            {searchResults.length ? (
              <div className="divide-y divide-[#edf1f5]">
                {searchResults.map((result) => (
                  <button
                    type="button"
                    key={`${result.kind}-${result.id}`}
                    onClick={() => {
                      onSearchResultSelect(result);
                      setSearchOpen(false);
                    }}
                    className="flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-[#f0f7fc]"
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: result.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#708596]">
                        {result.layer}
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold leading-4 text-[#17344d]">
                        {result.title}
                      </span>
                      {result.detail && (
                        <span className="mt-0.5 block truncate text-[10px] text-[#718596]">
                          {result.detail}
                        </span>
                      )}
                    </span>
                    <span className="material-symbols-outlined self-center text-[17px] text-[#8aa0b1]">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-xs text-[#718596]">
                {t("header.noResults")}
              </div>
            )}
            {totalSearchResults > searchResults.length && (
              <div className="border-t border-[#e4ebf1] px-3 py-2 text-center text-[10px] text-[#718596]">
                {t("header.showingFirst", { count: searchResults.length })}
              </div>
            )}
          </div>
        )}
      </div>
      <LanguageSwitcher
        language={(i18n.resolvedLanguage ?? "vi").split("-")[0] as SupportedLanguage}
        onChange={changeAppLanguage}
      />
      <nav
        className="hidden shrink-0 items-center gap-1 xl:flex"
        aria-label={t("header.utilities")}
      >
        <HeaderAction icon="share" label={t("header.share")} onClick={share} />
        <HeaderAction
          icon="fullscreen"
          label={t("header.fullscreen")}
          onClick={toggleFullscreen}
        />
      </nav>
      {notice && (
        <div className="absolute right-5 top-[calc(100%+0.5rem)] rounded-lg bg-[#153b59] px-3 py-2 text-xs text-white shadow-panel">
          {notice}
        </div>
      )}
    </header>
  );
}

function LanguageSwitcher({
  language,
  onChange,
}: {
  language: SupportedLanguage;
  onChange: (language: SupportedLanguage) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="relative flex h-10 shrink-0 items-center rounded-lg border border-[#d7e1ea] bg-white pl-2 text-[#31546e] transition-colors duration-150 hover:border-[#8bbbd8]">
      <span className="material-symbols-outlined text-[18px]">language</span>
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={language}
        onChange={(event) => onChange(event.target.value as SupportedLanguage)}
        aria-label={t("language.label")}
        className="h-full max-w-[5.5rem] cursor-pointer bg-transparent px-1.5 text-[11px] font-semibold outline-none sm:max-w-[7.5rem]"
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>{t(`language.${code}`)}</option>
        ))}
      </select>
    </label>
  );
}

function HeaderAction({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#31546e] transition-colors duration-150 hover:bg-[#edf6fc] hover:text-[#0769aa] active:bg-[#dcf0fc]"
    >
      <span className="material-symbols-outlined text-[19px]">{icon}</span>
      {label}
    </button>
  );
}

export function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="relative z-40 hidden min-h-[4.75rem] shrink-0 items-center gap-5 bg-gradient-to-r from-[#063f70] via-[#07518e] to-[#0878bd] px-6 py-3 text-white shadow-[0_-1px_0_rgba(255,255,255,0.08)] md:flex">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src="/images/logo/Logo_IOC.png"
          alt="IOC Huế"
          className="h-11 w-14 rounded bg-white/95 object-contain p-1"
        />
        <div className="text-sm font-bold tracking-wide">
          {t("footer.organization")}
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 text-xs text-white/85">
        <a
          href="tel:19001075"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-[18px]">call</span>
          {t("footer.hotline")}
        </a>
        <a
          href="mailto:dttm@hue.gov.vn"
          className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:bg-white/10 hover:text-white lg:flex"
        >
          <span className="material-symbols-outlined text-[18px]">mail</span>
          dttm@hue.gov.vn
        </a>
        <a
          href="https://bandoso.hue.gov.vn"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:bg-white/10 hover:text-white xl:flex"
        >
          <span className="material-symbols-outlined text-[18px]">
            language
          </span>
          bandoso.hue.gov.vn
        </a>
      </div>
    </footer>
  );
}
