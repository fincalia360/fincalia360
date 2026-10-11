import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";
import { portalMetadata } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const m = portalDict(await getSiteLang()).meta.mooringRent;
  return portalMetadata({ title: m.title, description: m.description, path: "/amarres/alquilar" });
}

export default async function RentMooringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage category="MOORING" operation="RENT" filters={parseSearch(await searchParams)} />;
}
