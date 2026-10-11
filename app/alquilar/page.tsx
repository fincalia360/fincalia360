import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";
import { redirect } from "next/navigation";
import { groupPath, isHomeGroup, portalMetadata } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const m = portalDict(await getSiteLang()).meta.homeRent;
  return portalMetadata({ title: m.title, description: m.description, path: "/alquilar" });
}

export default async function RentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  // «Amarres náuticos» en el filtro de tipo lleva a la búsqueda de amarres (mismo diseño, sus propios filtros)
  if (sp.grupo === "amarres") redirect("/amarres/alquilar");
  // Solo el tipo elegido: su página de categoría, con dirección propia
  const keys = Object.keys(sp).filter((k) => sp[k]);
  if (keys.length === 1 && typeof sp.grupo === "string" && isHomeGroup(sp.grupo)) redirect(groupPath("RENT", sp.grupo));
  return <PortalSearchPage operation="RENT" filters={parseSearch(sp)} />;
}
