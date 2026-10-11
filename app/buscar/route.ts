// Buscador de la portada: lleva a la página de resultados adecuada (venta o alquiler, tipo, población).
// Funciona sin JavaScript (formulario GET). La población se reconoce sin importar mayúsculas ni acentos.
import { NextResponse } from "next/server";
import { HOME_SEARCH_GROUPS, slugify, type PropertyGroup } from "@/services/listings/catalog";
import { cityPath, citiesWithListings, groupPath, searchPath } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op") === "RENT" ? "RENT" : "SALE";
  const grupo = url.searchParams.get("grupo") ?? "";
  const typed = (url.searchParams.get("municipio") ?? "").trim().slice(0, 80);
  const category = grupo === "amarres" ? "MOORING" : "HOME";
  const homeGroup = (HOME_SEARCH_GROUPS as string[]).includes(grupo) ? (grupo as PropertyGroup) : null;

  // Población con anuncios publicados (nombre oficial)
  const city = typed ? (await citiesWithListings(category, op)).find((c) => c.slug === slugify(typed)) : undefined;

  let target: string;
  if (city && !homeGroup) target = cityPath(category, op, city.name);
  else if (city && homeGroup) target = `${searchPath("HOME", op)}?grupo=${homeGroup}&provincia=${city.provinceCode}&municipio=${encodeURIComponent(city.name)}`;
  else if (typed) {
    // Sin anuncios en esa población: se muestran los resultados (vacíos) con el filtro, para no engañar
    const params = new URLSearchParams({ ...(homeGroup ? { grupo: homeGroup } : {}), municipio: typed });
    target = `${searchPath(category, op)}?${params.toString()}`;
  } else target = homeGroup ? groupPath(op, homeGroup) : searchPath(category, op);
  return NextResponse.redirect(new URL(target, url.origin), 303);
}
