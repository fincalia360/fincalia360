import type { Metadata } from "next";
import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Viviendas en alquiler",
  description: "Pisos, casas y otros inmuebles en alquiler en España, revisados antes de publicarse. Filtra por municipio, precio, habitaciones y superficie.",
  alternates: { canonical: "/alquilar" },
};

export default async function RentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage operation="RENT" filters={parseSearch(await searchParams)} />;
}
