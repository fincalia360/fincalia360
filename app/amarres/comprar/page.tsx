import type { Metadata } from "next";
import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Amarres en venta",
  description: "Amarres náuticos en venta en puertos deportivos de Cataluña. Filtra por puerto, población, precio, eslora, manga y servicios.",
  alternates: { canonical: "/amarres/comprar" },
};

export default async function BuyMooringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage category="MOORING" operation="SALE" filters={parseSearch(await searchParams)} />;
}
