// Páginas de categoría del portal, con el mismo diseño que el buscador:
//  - por tipo de inmueble: /comprar/pisos, /alquilar/locales… (no se indexan mientras no tengan anuncios)
//  - por población: /comprar/girona, /amarres/alquilar/roses… (solo existen si hay anuncios publicados)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { parseSearch } from "@/services/listings/listings";
import { cityPath, findCity, groupCount, groupPath, isHomeGroup, portalMetadata, type Category, type Operation } from "@/services/listings/seo";
import { PortalSearchPage } from "./PortalSearchPage";

type Props = { params: Promise<{ ciudad: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function cityPage(category: Category, operation: Operation) {
  const rent = operation === "RENT";
  const mooring = category === "MOORING";

  async function copyFor(slug: string) {
    const d = portalDict(await getSiteLang());
    if (category === "HOME" && isHomeGroup(slug)) {
      const count = await groupCount(operation, slug);
      const label = d.groups[slug];
      return { kind: "group" as const, count, name: label, title: d.results.titleGroup(label, rent), description: d.results.groupDescription(count, label, rent), path: groupPath(operation, slug) };
    }
    const city = await findCity(category, operation, slug);
    if (!city) return null;
    return {
      kind: "city" as const,
      city,
      count: city.count,
      name: city.name,
      title: d.results.cityTitle(mooring, rent, city.name),
      description: d.results.cityDescription(city.count, mooring, rent, city.name),
      path: cityPath(category, operation, city.name),
    };
  }

  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const copy = await copyFor((await params).ciudad);
    if (!copy) return { title: "404" };
    const meta = portalMetadata({ title: copy.title, description: copy.description, path: copy.path });
    return copy.kind === "group" && !copy.count ? { ...meta, robots: { index: false, follow: true } } : meta;
  }

  async function Page({ params, searchParams }: Props) {
    const slug = (await params).ciudad;
    const query = parseSearch(await searchParams);
    const copy = await copyFor(slug);
    if (!copy) notFound();
    const city = { name: copy.name, title: copy.title, description: copy.description, path: copy.path };
    if (copy.kind === "group") return <PortalSearchPage category="HOME" operation={operation} filters={{ ...query, grupo: slug }} city={city} />;
    const filters = { ...query, provincia: copy.city.provinceCode, municipio: copy.city.name };
    return <PortalSearchPage category={category} operation={operation} filters={filters} city={city} />;
  }

  return { generateMetadata, Page };
}
