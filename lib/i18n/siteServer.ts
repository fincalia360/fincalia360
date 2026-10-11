import { cookies } from "next/headers";
import { toSiteLang, type SiteLang } from "./site";

/** Idioma elegido por el visitante (cookie «lang»); español si no ha elegido ninguno. */
export async function getSiteLang(): Promise<SiteLang> {
  return toSiteLang((await cookies()).get("lang")?.value);
}
