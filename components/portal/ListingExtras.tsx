// Migas de pan y anuncios parecidos de las fichas (vivienda y amarre): enlaces internos para el
// visitante y para Google, en el idioma de la página.
import Link from "next/link";
import { catalogLabels } from "@/lib/i18n/portal/labels";
import { portalDict, type SiteLang } from "@/lib/i18n/site";
import { breadcrumbJsonLd, cityPath, searchPath, similarListings, type Category, type Operation } from "@/services/listings/seo";
import { localizedTexts } from "@/services/listings/translations";
import { ListingCard } from "./ListingCard";

type L = { id: string; category: string; operation: string; municipality: string; provinceCode: string; propertyType: string; title: string; slug: string };

export function ListingBreadcrumbs({
  l,
  names,
  title,
  ariaLabel,
}: {
  l: L;
  names: { home: string; sale: string; rent: string; mooringSale: string; mooringRent: string };
  title: string;
  ariaLabel: string;
}) {
  const category = (l.category === "MOORING" ? "MOORING" : "HOME") as Category;
  const operation = (l.operation === "RENT" ? "RENT" : "SALE") as Operation;
  const section = category === "MOORING" ? (operation === "RENT" ? names.mooringRent : names.mooringSale) : operation === "RENT" ? names.rent : names.sale;
  const crumbs = [
    { name: names.home, path: "/" },
    { name: section, path: searchPath(category, operation) },
    { name: l.municipality, path: cityPath(category, operation, l.municipality) },
    { name: title, path: category === "MOORING" ? `/amarre/${l.slug}` : `/inmueble/${l.slug}` },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)).replace(/</g, "\\u003c") }} />
      <nav aria-label={ariaLabel} className="text-[13px] text-ink-400">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {crumbs.slice(0, -1).map((c, i) => (
            <li key={c.path} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>›</span>}
              <Link href={c.path} className="hover:text-ink-700 hover:underline">
                {c.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

export async function SimilarListings({ l, lang = "es" }: { l: L; lang?: SiteLang }) {
  const items = await similarListings(l);
  if (!items.length) return null;
  const d = portalDict(lang);
  const labels = catalogLabels(lang);
  const mooring = l.category === "MOORING";
  return (
    <section aria-labelledby="parecidos" className="mt-12">
      <h2 id="parecidos" className="text-xl font-semibold text-ink-800">
        {mooring ? d.detail.similarMoorings : d.detail.similarHomes}
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <ListingCard key={s.reference} l={{ ...s, title: localizedTexts(s, lang).title ?? s.title }} t={d.card} labels={labels} locale={d.locale} shareLabel={d.share.card} />
        ))}
      </div>
    </section>
  );
}
