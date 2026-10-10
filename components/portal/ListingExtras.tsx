// Migas de pan y anuncios parecidos de las fichas (vivienda y amarre): enlaces internos para el
// visitante y para Google.
import Link from "next/link";
import { breadcrumbJsonLd, listingBreadcrumbs, similarListings } from "@/services/listings/seo";
import { ListingCard } from "./ListingCard";

type L = { id: string; category: string; operation: string; municipality: string; provinceCode: string; propertyType: string; title: string; slug: string };

export function ListingBreadcrumbs({ l }: { l: L }) {
  const crumbs = listingBreadcrumbs(l);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)).replace(/</g, "\\u003c") }} />
      <nav aria-label="Ruta" className="text-[13px] text-ink-400">
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

export async function SimilarListings({ l }: { l: L }) {
  const items = await similarListings(l);
  if (!items.length) return null;
  const mooring = l.category === "MOORING";
  return (
    <section aria-labelledby="parecidos" className="mt-12">
      <h2 id="parecidos" className="text-xl font-semibold text-ink-800">
        {mooring ? "Otros amarres que te pueden interesar" : "Otros inmuebles que te pueden interesar"}
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <ListingCard key={s.reference} l={s} />
        ))}
      </div>
    </section>
  );
}
