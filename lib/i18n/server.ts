import { cookies } from "next/headers";
import type { Language } from "@/types";
import { LANG_COOKIE, resolveLanguage } from "./index";

/** Idioma de la petición: ?lang=xx → cookie → español. */
export async function getRequestLanguage(searchLang?: string | string[]): Promise<Language> {
  const fromQuery = Array.isArray(searchLang) ? searchLang[0] : searchLang;
  const store = await cookies();
  return resolveLanguage(fromQuery, store.get(LANG_COOKIE)?.value);
}
