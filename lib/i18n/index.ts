import { LANGUAGES, type Language } from "@/types";
import ca from "./dictionaries/ca";
import de from "./dictionaries/de";
import en from "./dictionaries/en";
import es from "./dictionaries/es";
import fr from "./dictionaries/fr";
import it from "./dictionaries/it";
import nl from "./dictionaries/nl";
import pt from "./dictionaries/pt";
import type { Dictionary } from "./types";

export type { Dictionary } from "./types";

const dictionaries: Record<Language, Dictionary> = { es, ca, en, fr, de, nl, it, pt };

export const LANG_COOKIE = "lang";

/** Locale BCP-47 para formatear fechas y números. */
export const LOCALES: Record<Language, string> = {
  es: "es-ES",
  ca: "ca-ES",
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
  nl: "nl-NL",
  it: "it-IT",
  pt: "pt-PT",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function resolveLanguage(...candidates: Array<string | null | undefined>): Language {
  for (const c of candidates) {
    if (isLanguage(c)) return c;
  }
  return "es";
}

export function getDictionary(lang: Language): Dictionary {
  return dictionaries[lang] ?? es;
}

/** Sustituye {placeholders} en un texto. */
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}

export function formatEstimate(value: number, lang: Language): string {
  return new Intl.NumberFormat(LOCALES[lang], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
