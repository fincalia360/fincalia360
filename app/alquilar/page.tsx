import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";
import { portalMetadata } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export const metadata = portalMetadata({
  title: "Pisos y casas en alquiler en Cataluña",
  description: "Pisos, casas y otros inmuebles en alquiler en Barcelona, Girona, Lleida y Tarragona, revisados antes de publicarse. Filtra por población, precio, habitaciones, baños y características.",
  path: "/alquilar",
});

export default async function RentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage operation="RENT" filters={parseSearch(await searchParams)} />;
}
