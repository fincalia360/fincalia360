// Idiomas de la web pública: español (base), catalán, inglés, alemán y francés.
// El idioma se elige con el selector de la cabecera (?lang=xx); el middleware lo guarda en la cookie «lang».
import type { PortalDict } from "./portal/es";
import es from "./portal/es";
import ca from "./portal/ca";
import en from "./portal/en";
import de from "./portal/de";
import fr from "./portal/fr";

export const SITE_LANGUAGES = ["es", "ca", "en", "de", "fr"] as const;
export type SiteLang = (typeof SITE_LANGUAGES)[number];

export const SITE_LANGUAGE_NAMES: Record<SiteLang, string> = { es: "Español", ca: "Català", en: "English", de: "Deutsch", fr: "Français" };

export function toSiteLang(value: unknown): SiteLang {
  return typeof value === "string" && (SITE_LANGUAGES as readonly string[]).includes(value) ? (value as SiteLang) : "es";
}

const DICTS: Record<SiteLang, PortalDict> = { es, ca, en, de, fr };

export function portalDict(lang: SiteLang): PortalDict {
  return DICTS[lang] ?? es;
}
