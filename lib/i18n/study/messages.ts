// Diccionario de la herramienta de valoración para un idioma (se usa en el servidor y se pasa al
// navegador solo el del idioma de la página). Las claves son el texto original en español.
import type { SiteLang } from "@/lib/i18n/site";
import table1 from "./table1";
import table2 from "./table2";
import table3 from "./table3";
import table4 from "./table4";
import { translateStudy, type StudyMessages, type StudyVars } from "./translate";

const COLUMN: Record<SiteLang, number> = { es: 0, ca: 1, en: 2, de: 3, fr: 4 };
const cache = new Map<SiteLang, StudyMessages>();

export function studyMessages(lang: SiteLang): StudyMessages {
  if (lang === "es") return {};
  const hit = cache.get(lang);
  if (hit) return hit;
  const col = COLUMN[lang];
  const messages: StudyMessages = {};
  for (const row of [...table1, ...table2, ...table3, ...table4]) messages[row[0]] = row[col];
  cache.set(lang, messages);
  return messages;
}

/** t() para componentes de servidor. */
export function studyT(lang: SiteLang) {
  const messages = studyMessages(lang);
  return (text: string, vars?: StudyVars) => translateStudy(messages, text, vars);
}
