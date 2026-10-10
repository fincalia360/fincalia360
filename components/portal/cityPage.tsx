// Páginas por población del portal (/comprar/girona, /amarres/alquilar/roses…). Solo existen para
// municipios con anuncios publicados; el resto devuelve 404 (nada de páginas vacías para Google).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseSearch } from "@/services/listings/listings";
import { cityCopy, cityPath, findCity, portalMetadata, type Category, type Operation } from "@/services/listings/seo";
import { PortalSearchPage } from "./PortalSearchPage";

type Props = { params: Promise<{ ciudad: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function cityPage(category: Category, operation: Operation) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const city = await findCity(category, operation, (await params).ciudad);
    if (!city) return { title: "Página no disponible" };
    const copy = cityCopy(category, operation, city.name, city.count);
    return portalMetadata({ title: copy.title, description: copy.description, path: cityPath(category, operation, city.name) });
  }

  async function Page({ params, searchParams }: Props) {
    const city = await findCity(category, operation, (await params).ciudad);
    if (!city) notFound();
    const copy = cityCopy(category, operation, city.name, city.count);
    const filters = { ...parseSearch(await searchParams), provincia: city.provinceCode, municipio: city.name };
    return <PortalSearchPage category={category} operation={operation} filters={filters} city={{ name: city.name, ...copy }} />;
  }

  return { generateMetadata, Page };
}
