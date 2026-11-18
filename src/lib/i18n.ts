import { create } from "zustand";
import { z } from "zod";
import spanish from "./translations/es.json" with { type: "json" };

export type Language = "en" | "es";
export const LANGUAGE_KEY = "ohb.language.v1";
const messages: Record<string, string> = spanish;

function savedLanguage(): Language {
  try {
    return typeof window !== "undefined" &&
      window.localStorage?.getItem(LANGUAGE_KEY) === "es"
      ? "es"
      : "en";
  } catch {
    return "en";
  }
}

export function applyLanguage(language: Language) {
  if (typeof document !== "undefined") document.documentElement.lang = language;
  z.config(language === "es" ? z.locales.es() : z.locales.en());
}

export const useLanguageStore = create<{
  language: Language;
  setLanguage: (language: Language) => void;
}>((set) => ({
  language: savedLanguage(),
  setLanguage: (language) => {
    try {
      if (typeof window !== "undefined")
        window.localStorage?.setItem(LANGUAGE_KEY, language);
    } catch {
      // Language still changes for this session when storage is unavailable.
    }
    applyLanguage(language);
    set({ language });
  },
}));

const patterns = Object.entries(messages).flatMap(([source, translated]) => {
  const names = [...source.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  if (!names.length) return [];
  const escaped = source
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{\w+\\\}/g, "([\\s\\S]*?)");
  return [{ regex: new RegExp(`^${escaped}$`), names, translated }];
});

export function translate(
  source: string,
  values: Record<string, unknown> = {},
  language: Language = useLanguageStore.getState().language,
): string {
  let template = language === "es" ? messages[source] : source;
  if (language === "es" && template === undefined) {
    // Stored progress/error messages stay canonical English until displayed.
    for (const pattern of patterns) {
      const match = pattern.regex.exec(source);
      if (match) {
        template = pattern.translated;
        values = Object.fromEntries(
          pattern.names.map((name, i) => [name, match[i + 1]]),
        );
        break;
      }
    }
  }
  return (template ?? source).replace(/\{(\w+)\}/g, (whole, name) =>
    Object.hasOwn(values, name) ? String(values[name] ?? "") : whole,
  );
}

export function useTranslation() {
  useLanguageStore((state) => state.language);
  return translate;
}
