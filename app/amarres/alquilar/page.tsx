import type { Metadata } from "next";
import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Amarres en alquiler",
  description: "Amarres náuticos en alquiler en puertos deportivos de Cataluña, por días, meses, temporada o año. Filtra por puerto, precio, eslora, manga y servicios.",
  alternates: { canonical: "/amarres/alquilar" },
};

export default async function RentMooringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage category="MOORING" operation="RENT" filters={parseSearch(await searchParams)} />;
}
