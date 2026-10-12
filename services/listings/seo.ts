// SEO del portal (viviendas y amarres): metadatos para compartir, páginas por ciudad, datos
// estructurados para Google y enlaces internos. No se usa en la sección de valoración.
import type { Metadata } from "next";
import { prisma } from "@/db/client";
import { PORTAL_OG_IMAGE, publicSiteUrl } from "@/lib/site";
import { HOME_SEARCH_GROUPS, PROPERTY_GROUPS, PROPERTY_TYPES, type PropertyGroup, type PropertyTypeCode, slugify } from "./catalog";
import { PUBLIC_SELECT, publicVisibility } from "./listings";

export type Category = "HOME" | "MOORING";
export type Operation = "SALE" | "RENT";

/** Título, descripción, dirección canónica e imagen para compartir de una página del portal. */
export function portalMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", title: `${title} · FINCALIA360`, description, url: path, siteName: "FINCALIA360", locale: "es_ES", images: [PORTAL_OG_IMAGE] },
    twitter: { card: "summary_large_image", title: `${title} · FINCALIA360`, description, images: [PORTAL_OG_IMAGE.url] },
  };
}

export function searchPath(category: Category, operation: Operation) {
  if (category === "MOORING") return operation === "RENT" ? "/amarres/alquilar" : "/amarres/comprar";
  return operation === "RENT" ? "/alquilar" : "/comprar";
}

export function cityPath(category: Category, operation: Operation, municipality: string) {
  return `${searchPath(category, operation)}/${slugify(municipality)}`;
}

export interface CityWithListings {
  name: string;
  slug: string;
  provinceCode: string;
  count: number;
}

/** Municipios con anuncios publicados (solo para ellos existe página de ciudad). */
export async function citiesWithListings(category: Category, operation: Operation): Promise<CityWithListings[]> {
  const rows = await prisma.listing.groupBy({ by: ["municipality", "provinceCode"], where: { ...publicVisibility(category), operation }, _count: true });
  const bySlug = new Map<string, CityWithListings>();
  for (const r of rows) {
    const slug = slugify(r.municipality);
    if (!slug) continue;
    const prev = bySlug.get(slug);
    if (prev) prev.count += r._count;
    else bySlug.set(slug, { name: r.municipality, slug, provinceCode: r.provinceCode, count: r._count });
  }
  return [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

export async function findCity(category: Category, operation: Operation, slug: string) {
  return (await citiesWithListings(category, operation)).find((c) => c.slug === slug) ?? null;
}

/** Título y texto de la página de una ciudad. */
export function cityCopy(category: Category, operation: Operation, city: string, count: number) {
  const rent = operation === "RENT";
  if (category === "MOORING") {
    return {
      title: `${rent ? "Alquiler de amarres" : "Amarres en venta"} en ${city}`,
      description: `${count} ${count === 1 ? "amarre" : "amarres"} ${rent ? "en alquiler" : "en venta"} en ${city}: medidas, eslora y manga admitidas, servicios del puerto, precio y fotos. Anuncios revisados.`,
    };
  }
  return {
    title: `${rent ? "Pisos y casas en alquiler" : "Pisos y casas en venta"} en ${city}`,
    description: `${count} ${count === 1 ? "vivienda" : "viviendas"} ${rent ? "en alquiler" : "en venta"} en ${city}: precio, superficie, habitaciones, fotos y características. Anuncios revisados antes de publicarse.`,
  };
}

// ---------------------------------------------------------------------------
// Datos estructurados (schema.org)
// ---------------------------------------------------------------------------

export function organizationJsonLd() {
  const site = publicSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "FINCALIA360",
    url: site,
    logo: `${site}/brand/fincalia360-logo.png`,
    image: `${site}${PORTAL_OG_IMAGE.url}`,
    areaServed: { "@type": "AdministrativeArea", name: "Cataluña" },
    description: "Portal de viviendas y amarres en venta y alquiler en Cataluña, publicación gratuita para propietarios y estudio gratuito para decidir entre vender o alquilar.",
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  const site = publicSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${site}${it.path}` })),
  };
}

/** Migas de pan de una ficha: Inicio › Comprar › Girona › anuncio. */
export function listingBreadcrumbs(l: { category: string; operation: string; municipality: string; title: string; slug: string }) {
  const category = (l.category === "MOORING" ? "MOORING" : "HOME") as Category;
  const operation = (l.operation === "RENT" ? "RENT" : "SALE") as Operation;
  const section =
    category === "MOORING" ? (operation === "RENT" ? "Amarres en alquiler" : "Amarres en venta") : operation === "RENT" ? "Alquiler" : "Venta";
  return [
    { name: "Inicio", path: "/" },
    { name: section, path: searchPath(category, operation) },
    { name: l.municipality, path: cityPath(category, operation, l.municipality) },
    { name: l.title, path: category === "MOORING" ? `/amarre/${l.slug}` : `/inmueble/${l.slug}` },
  ];
}

/** Anuncios parecidos: misma sección y operación; primero el mismo municipio, luego la provincia y luego Cataluña. */
export async function similarListings(l: { id: string; category: string; operation: string; municipality: string; provinceCode: string; propertyType: string }, take = 3) {
  const category = (l.category === "MOORING" ? "MOORING" : "HOME") as Category;
  const base = { ...publicVisibility(category), operation: l.operation, NOT: { id: l.id } };
  const same = await prisma.listing.findMany({ where: { ...base, municipality: l.municipality }, orderBy: { publishedAt: "desc" }, take, select: PUBLIC_SELECT });
  if (same.length >= take) return same;
  const found = [...same];
  for (const scope of [{ provinceCode: l.provinceCode }, {}]) {
    if (found.length >= take) break;
    found.push(
      ...(await prisma.listing.findMany({
        where: { ...base, ...scope, id: { notIn: [l.id, ...found.map((s) => s.id)] } },
        orderBy: { publishedAt: "desc" },
        take: take - found.length,
        select: PUBLIC_SELECT,
      })),
    );
  }
  return found;
}

export function typeLabel(propertyType: string) {
  return PROPERTY_TYPES[propertyType as PropertyTypeCode] ?? "Inmueble";
}

// ---------------------------------------------------------------------------
// Páginas por tipo de inmueble (/comprar/pisos, /alquilar/locales…)
// ---------------------------------------------------------------------------

export function isHomeGroup(slug: string): slug is PropertyGroup {
  return (HOME_SEARCH_GROUPS as string[]).includes(slug);
}

export function groupPath(operation: Operation, group: PropertyGroup) {
  return group === "amarres" ? searchPath("MOORING", operation) : `${searchPath("HOME", operation)}/${group}`;
}

export async function groupCount(operation: Operation, group: PropertyGroup) {
  return prisma.listing.count({ where: { ...publicVisibility("HOME"), operation, propertyType: { in: [...PROPERTY_GROUPS[group].types] } } });
}

export function groupCopy(operation: Operation, group: PropertyGroup, count: number) {
  const label = PROPERTY_GROUPS[group].label;
  const op = operation === "RENT" ? "en alquiler" : "en venta";
  return {
    title: `${label} ${op} en Cataluña`,
    description: count
      ? `${count} ${count === 1 ? "anuncio" : "anuncios"} de ${label.toLowerCase()} ${op} en Barcelona, Girona, Lleida y Tarragona, con fotos, precio y características. Anuncios revisados antes de publicarse.`
      : `${label} ${op} en Barcelona, Girona, Lleida y Tarragona. Anuncios revisados antes de publicarse.`,
  };
}

/** Descripción para Google: une las partes y corta en una palabra completa (≈160 caracteres, lo que muestra Google). */
export function metaDescription(parts: Array<string | null | undefined>, max = 160) {
  const text = parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:·-]+$/, "")}…`;
}
