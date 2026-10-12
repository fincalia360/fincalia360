import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site";
import { listingPath } from "@/services/listings/catalog";
import { publicListingsForSitemap } from "@/services/listings/listings";
import { HOME_SEARCH_GROUPS } from "@/services/listings/catalog";
import { cityPath, citiesWithListings, groupCount, groupPath, type Category, type Operation } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const pages: MetadataRoute.Sitemap = ["", "/estudio", "/comprar", "/alquilar", "/amarres/comprar", "/amarres/alquilar", "/publicar", "/busco-piso", "/busco-piso/solicitudes", "/contacto", "/legal", "/privacy", "/cookies", "/condiciones"].map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" }));
  const listings = await publicListingsForSitemap().catch(() => []);
  const sections: Array<[Category, Operation]> = [
    ["HOME", "SALE"],
    ["HOME", "RENT"],
    ["MOORING", "SALE"],
    ["MOORING", "RENT"],
  ];
  const cityPages = (
    await Promise.all(sections.map(([c, o]) => citiesWithListings(c, o).then((cities) => cities.map((city) => cityPath(c, o, city.name))).catch(() => [])))
  ).flat();
  // Páginas por tipo de inmueble: solo las que tienen anuncios (nada de páginas vacías para Google)
  const groupPages = (
    await Promise.all(
      (["SALE", "RENT"] as const).flatMap((op) => HOME_SEARCH_GROUPS.map((g) => groupCount(op, g).then((n) => (n ? groupPath(op, g) : null)).catch(() => null))),
    )
  ).filter((p): p is string => Boolean(p));
  return [
    ...groupPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const })),
    ...pages,
    ...cityPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const })),
    ...listings.map((l) => ({ url: `${base}${listingPath(l)}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const })),
  ];
}
