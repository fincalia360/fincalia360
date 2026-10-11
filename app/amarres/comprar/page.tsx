import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { PortalSearchPage } from "@/components/portal/PortalSearchPage";
import { parseSearch } from "@/services/listings/listings";
import { portalMetadata } from "@/services/listings/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const m = portalDict(await getSiteLang()).meta.mooringSale;
  return portalMetadata({ title: m.title, description: m.description, path: "/amarres/comprar" });
}

export default async function BuyMooringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PortalSearchPage category="MOORING" operation="SALE" filters={parseSearch(await searchParams)} />;
}
