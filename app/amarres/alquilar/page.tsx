import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";
import { portalMetadata } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export const metadata = portalMetadata({
  title: "Alquiler de amarres en Cataluña",
  description: "Amarres náuticos en alquiler en puertos deportivos de Cataluña, por días, meses, temporada o año. Filtra por puerto, precio, eslora y manga de tu barco y servicios.",
  path: "/amarres/alquilar",
});

export default async function RentMooringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage category="MOORING" operation="RENT" filters={parseSearch(await searchParams)} />;
}
