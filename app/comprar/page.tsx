import type { Metadata } from "next";
import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Viviendas en venta",
  description: "Pisos, casas y otros inmuebles en venta en Cataluña (Barcelona, Girona, Lleida y Tarragona), revisados antes de publicarse. Filtra por municipio, precio, habitaciones y superficie.",
  alternates: { canonical: "/comprar" },
};

export default async function BuyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage operation="SALE" filters={parseSearch(await searchParams)} />;
}
