import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";
import { redirect } from "next/navigation";
import { groupPath, isHomeGroup, portalMetadata } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export const metadata = portalMetadata({
  title: "Inmuebles en venta en Cataluña",
  description: "Pisos, casas, locales, oficinas, garajes, terrenos y amarres en venta en Barcelona, Girona, Lleida y Tarragona, revisados antes de publicarse. Filtra por tipo, población, precio y características.",
  path: "/comprar",
});

export default async function BuyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  // «Amarres náuticos» en el filtro de tipo lleva a la búsqueda de amarres (mismo diseño, sus propios filtros)
  if (sp.grupo === "amarres") redirect("/amarres/comprar");
  // Solo el tipo elegido: su página de categoría, con dirección propia
  const keys = Object.keys(sp).filter((k) => sp[k]);
  if (keys.length === 1 && typeof sp.grupo === "string" && isHomeGroup(sp.grupo)) redirect(groupPath("SALE", sp.grupo));
  return <PortalSearchPage operation="SALE" filters={parseSearch(sp)} />;
}
