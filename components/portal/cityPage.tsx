// Páginas de categoría del portal, con el mismo diseño que el buscador:
//  - por tipo de inmueble: /comprar/pisos, /alquilar/locales… (no se indexan mientras no tengan anuncios)
//  - por población: /comprar/girona, /amarres/alquilar/roses… (solo existen si hay anuncios publicados)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseSearch } from "@/services/listings/listings";
import {
  cityCopy,
  cityPath,
  findCity,
  groupCopy,
  groupCount,
  groupPath,
  isHomeGroup,
  portalMetadata,
  type Category,
  type Operation,
} from "@/services/listings/seo";
import { PROPERTY_GROUPS } from "@/services/listings/catalog";
import { PortalSearchPage } from "./PortalSearchPage";

type Props = { params: Promise<{ ciudad: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function cityPage(category: Category, operation: Operation) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const slug = (await params).ciudad;
    if (category === "HOME" && isHomeGroup(slug)) {
      const count = await groupCount(operation, slug);
      const copy = groupCopy(operation, slug, count);
      return { ...portalMetadata({ title: copy.title, description: copy.description, path: groupPath(operation, slug) }), ...(count ? {} : { robots: { index: false, follow: true } }) };
    }
    const city = await findCity(category, operation, slug);
    if (!city) return { title: "Página no disponible" };
    const copy = cityCopy(category, operation, city.name, city.count);
    return portalMetadata({ title: copy.title, description: copy.description, path: cityPath(category, operation, city.name) });
  }

  async function Page({ params, searchParams }: Props) {
    const slug = (await params).ciudad;
    const query = parseSearch(await searchParams);
    if (category === "HOME" && isHomeGroup(slug)) {
      const count = await groupCount(operation, slug);
      const copy = groupCopy(operation, slug, count);
      return (
        <PortalSearchPage
          category="HOME"
          operation={operation}
          filters={{ ...query, grupo: slug }}
          city={{ name: PROPERTY_GROUPS[slug].label, ...copy, path: groupPath(operation, slug) }}
        />
      );
    }
    const city = await findCity(category, operation, slug);
    if (!city) notFound();
    const copy = cityCopy(category, operation, city.name, city.count);
    const filters = { ...query, provincia: city.provinceCode, municipio: city.name };
    return <PortalSearchPage category={category} operation={operation} filters={filters} city={{ name: city.name, ...copy, path: cityPath(category, operation, city.name) }} />;
  }

  return { generateMetadata, Page };
}
