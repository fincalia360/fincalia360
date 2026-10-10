import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";
import { portalMetadata } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export const metadata = portalMetadata({
  title: "Amarres en venta en Cataluña",
  description: "Amarres náuticos en venta en puertos deportivos de Cataluña. Filtra por puerto, población, precio, eslora y manga de tu barco, tipo de amarre y servicios.",
  path: "/amarres/comprar",
});

export default async function BuyMooringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage category="MOORING" operation="SALE" filters={parseSearch(await searchParams)} />;
}
