import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./locales/vi.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import zh from "./locales/zh.json";

export const SUPPORTED_LANGUAGES = ["vi", "en", "fr", "ja", "ko", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const storedLanguage = window.localStorage.getItem("bandoso-language");
const initialLanguage: SupportedLanguage = SUPPORTED_LANGUAGES.includes(storedLanguage as SupportedLanguage)
  ? storedLanguage as SupportedLanguage
  : "vi";

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi }, en: { translation: en }, fr: { translation: fr },
    ja: { translation: ja }, ko: { translation: ko }, zh: { translation: zh },
  },
  lng: initialLanguage,
  fallbackLng: "vi",
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function changeAppLanguage(language: SupportedLanguage): void {
  window.localStorage.setItem("bandoso-language", language);
  void i18n.changeLanguage(language);
}

export default i18n;
