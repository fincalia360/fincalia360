// Negocios en traspaso publicados (Cataluña), con filtros por provincia, población, categoría y precio.
import Link from "next/link";
import { Store } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ListingCard } from "@/components/portal/ListingCard";
import { getDictionary } from "@/lib/i18n";
import { catalogLabels } from "@/lib/i18n/portal/labels";
import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { transferTexts } from "@/lib/i18n/transfers";
import { BUSINESS_TYPES, PORTAL_PROVINCE_CODES } from "@/services/listings/catalog";
import { parseTransferSearch, searchTransfers } from "@/services/listings/listings";
import { portalMetadata } from "@/services/listings/seo";
import { localizedTexts } from "@/services/listings/translations";
import { PROVINCES } from "@/services/study/geo";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  const t = transferTexts(await getSiteLang());
  const filtered = Object.keys(await searchParams).length > 0;
  const meta = portalMetadata({ title: t.metaTitle, description: t.metaDescription, path: "/traspasos" });
  // Las combinaciones de filtros no se indexan (evita contenido duplicado); la página base sí
  return filtered ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function TransfersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const d = portalDict(lang);
  const t = transferTexts(lang);
  const L = catalogLabels(lang);
  const sp = await searchParams;
  const f = parseTransferSearch(sp);
  const { total, items, page, pages, places } = await searchTransfers(f);
  const filtered = Boolean(f.provincia || f.municipio || f.categoria || f.min || f.max);
  const provinces = PROVINCES.filter((p) => PORTAL_PROVINCE_CODES.includes(p.code)).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const towns = places.filter((p) => !f.provincia || p.provinceCode === f.provincia);
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v !== undefined && k !== "pagina") q.set(k, String(v));
    if (n > 1) q.set("pagina", String(n));
    const s = q.toString();
    return `/traspasos${s ? `?${s}` : ""}`;
  };

  return (
    <div lang={lang}>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-8 sm:py-10">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-tight text-ink-800 sm:text-5xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-[15.5px] text-ink-500">{t.intro}</p>
            <Link href="/publicar?tipo=negocio" className="mt-5 inline-flex h-11 items-center rounded-full bg-terracotta-500 px-5 font-semibold text-white hover:bg-terracotta-600">
              {t.publishCta}
            </Link>
          </div>
        </section>

        <div className="container-page py-8">
          <form method="get" className="grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.3fr_0.9fr_0.9fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="field-label">{t.province}</span>
              <select name="provincia" defaultValue={f.provincia ?? ""} className="field">
                <option value="">{t.allProvinces}</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">{t.municipality}</span>
              <select name="municipio" defaultValue={f.municipio ?? ""} className="field">
                <option value="">{t.allMunicipalities}</option>
                {towns.map((p) => (
                  <option key={`${p.provinceCode}-${p.municipality}`} value={p.municipality}>
                    {p.municipality} ({p.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">{t.category}</span>
              <select name="categoria" defaultValue={f.categoria ?? ""} className="field">
                <option value="">{t.allCategories}</option>
                {Object.keys(BUSINESS_TYPES).map((k) => (
                  <option key={k} value={k}>
                    {L.types[k] ?? k}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">{t.minPrice}</span>
              <input name="min" type="number" min={0} step={1000} inputMode="numeric" defaultValue={f.min ?? ""} className="field" />
            </label>
            <label className="block">
              <span className="field-label">{t.maxPrice}</span>
              <input name="max" type="number" min={0} step={1000} inputMode="numeric" defaultValue={f.max ?? ""} className="field" />
            </label>
            <label className="block">
              <span className="field-label">{t.sort}</span>
              <select name="orden" defaultValue={f.orden ?? "recientes"} className="field">
                <option value="recientes">{t.sortRecent}</option>
                <option value="precio-asc">{t.sortCheap}</option>
                <option value="precio-desc">{t.sortExpensive}</option>
              </select>
            </label>
            <div className="flex items-center gap-3">
              <button className="inline-flex h-11 items-center rounded-full bg-ink-800 px-5 font-medium text-white hover:bg-ink-900">{t.apply}</button>
              {filtered && (
                <Link href="/traspasos" className="text-sm text-ink-500 underline">
                  {t.clear}
                </Link>
              )}
            </div>
          </form>

          {total === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
              <Store className="mx-auto h-10 w-10 text-ink-300" />
              <h2 className="mt-4 text-xl font-semibold text-ink-800">{filtered ? t.emptyFiltered : t.emptyTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-ink-500">{t.emptyText}</p>
              <Link href="/publicar?tipo=negocio" className="mt-6 inline-flex h-11 items-center rounded-full bg-terracotta-500 px-5 font-semibold text-white hover:bg-terracotta-600">
                {t.publishCta}
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm font-medium text-ink-600">{t.count(total)}</p>
              <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l) => (
                  <ListingCard key={l.reference} l={{ ...l, title: localizedTexts(l, lang).title ?? l.title }} t={d.card} labels={L} locale={d.locale} shareLabel={d.share.card} />
                ))}
              </div>
              {pages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Paginación">
                  {page > 1 && (
                    <Link href={pageHref(page - 1)} className="rounded-full bg-white px-4 py-2 ring-1 ring-sand-200 hover:bg-sand-50">
                      {t.prev}
                    </Link>
                  )}
                  <span className="text-ink-500">
                    {page} / {pages}
                  </span>
                  {page < pages && (
                    <Link href={pageHref(page + 1)} className="rounded-full bg-white px-4 py-2 ring-1 ring-sand-200 hover:bg-sand-50">
                      {t.next}
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
