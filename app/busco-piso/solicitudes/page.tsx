// Solicitudes «Busco piso» aprobadas por FINCALIA360. Solo campos públicos: nunca datos de contacto.
import Link from "next/link";
import { BedDouble, Bath, MapPin, Ruler, SearchX } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { getDictionary } from "@/lib/i18n";
import { searchTexts, type SearchTexts } from "@/lib/i18n/searchRequests";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { PORTAL_PROVINCE_CODES } from "@/services/listings/catalog";
import { portalMetadata } from "@/services/listings/seo";
import { splitMunicipalities } from "@/services/searchRequests/catalog";
import { listPublicSearchRequests, type PublicSearchRequest } from "@/services/searchRequests/searchRequests";
import { PROVINCES, getProvince } from "@/services/study/geo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = searchTexts(await getSiteLang());
  return portalMetadata({ title: t.metaListTitle, description: t.metaListDescription, path: "/busco-piso/solicitudes" });
}

type Params = { op?: string; prov?: string; pob?: string; desde?: string; hasta?: string };
const amount = (v?: string) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

function SearchCard({ r, t }: { r: PublicSearchRequest; t: SearchTexts }) {
  const money = (n: number) => new Intl.NumberFormat(t.locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) + (r.operation === "RENT" ? t.perMonth : "");
  const budget = r.minPrice ? t.budgetBetween(money(r.minPrice), money(r.maxPrice)) : t.budgetUpTo(money(r.maxPrice));
  const features = (
    [
      ["terrace", t.terrace],
      ["elevator", t.elevator],
      ["parking", t.parking],
      ["exterior", t.exterior],
    ] as const
  )
    .filter(([k]) => r[k] === "YES" || r[k] === "NO")
    .map(([k, label]) => (r[k] === "YES" ? t.withFeature(label) : t.withoutFeature(label)));
  if (r.condition !== "ANY") features.push(t.conditions[r.condition] ?? r.condition);
  const places = splitMunicipalities(r.municipalities).join(", ");

  return (
    <article id={r.reference} className="flex flex-col rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.operation === "RENT" ? "bg-pine-50 text-pine-700" : "bg-terracotta-50 text-terracotta-700"}`}>
          {r.operation === "RENT" ? t.rents : t.buys}
        </span>
        <span className="text-xs text-ink-400">
          {t.reference} {r.reference}
        </span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-ink-800">{t.types[r.propertyType] ?? r.propertyType}</h2>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-600">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <span>
          {places} ({getProvince(r.provinceCode)?.name ?? r.provinceCode}){r.zone ? ` · ${r.zone}` : ""}
        </span>
      </p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-ink-800">{budget}</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-600">
        {r.minBedrooms != null && (
          <li className="inline-flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 text-ink-400" /> {t.bedroomsMin(r.minBedrooms)}
          </li>
        )}
        {r.minBathrooms != null && (
          <li className="inline-flex items-center gap-1.5">
            <Bath className="h-4 w-4 text-ink-400" /> {t.bathroomsMin(r.minBathrooms)}
          </li>
        )}
        {(r.minArea != null || r.maxArea != null) && (
          <li className="inline-flex items-center gap-1.5">
            <Ruler className="h-4 w-4 text-ink-400" /> {t.areaRange(r.minArea, r.maxArea)}
          </li>
        )}
      </ul>
      {features.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {features.map((f) => (
            <li key={f} className="rounded-full bg-sand-100 px-2.5 py-1 text-xs text-ink-600">
              {f}
            </li>
          ))}
        </ul>
      )}
      {r.publicText && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">{r.publicText}</p>}
      {r.publishedAt && (
        <p className="mt-auto pt-4 text-xs text-ink-400">{t.published(new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "long", year: "numeric" }).format(r.publishedAt))}</p>
      )}
    </article>
  );
}

export default async function PublishedSearchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const t = searchTexts(lang);
  const p = await searchParams;
  const filters = {
    operation: p.op === "SALE" || p.op === "RENT" ? p.op : undefined,
    provinceCode: p.prov && PORTAL_PROVINCE_CODES.includes(p.prov) ? p.prov : undefined,
    municipality: p.pob?.trim().slice(0, 80) || undefined,
    budgetMin: amount(p.desde),
    budgetMax: amount(p.hasta),
  };
  const filtered = Object.values(filters).some((v) => v !== undefined);
  const [items, all] = await Promise.all([listPublicSearchRequests(filters), filtered ? listPublicSearchRequests() : null]);
  const municipalities = [...new Set((all ?? items).flatMap((r) => splitMunicipalities(r.municipalities)))].sort((a, b) => a.localeCompare(b, "es"));
  const provinces = PROVINCES.filter((x) => PORTAL_PROVINCE_CODES.includes(x.code)).sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div lang={lang}>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-8 sm:py-10">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-tight text-ink-800 sm:text-5xl">{t.listTitle}</h1>
            <p className="mt-3 max-w-2xl text-[15.5px] text-ink-500">{t.listIntro}</p>
            <Link href="/busco-piso" className="mt-5 inline-flex h-11 items-center rounded-full bg-terracotta-500 px-5 font-semibold text-white hover:bg-terracotta-600">
              {t.publishYours}
            </Link>
          </div>
        </section>

        <div className="container-page py-8">
          <form method="get" className="grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="field-label">{t.filterOperation}</span>
              <select name="op" defaultValue={filters.operation ?? ""} className="field">
                <option value="">{t.all}</option>
                <option value="SALE">{t.buy}</option>
                <option value="RENT">{t.rent}</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">{t.filterProvince}</span>
              <select name="prov" defaultValue={filters.provinceCode ?? ""} className="field">
                <option value="">{t.allProvinces}</option>
                {provinces.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">{t.filterMunicipality}</span>
              <input name="pob" defaultValue={filters.municipality ?? ""} list="bp-filter-muni" maxLength={80} autoComplete="off" className="field" />
              <datalist id="bp-filter-muni">
                {municipalities.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="field-label">{t.budgetFrom}</span>
              <input name="desde" type="number" min={0} inputMode="numeric" defaultValue={filters.budgetMin ?? ""} className="field" />
            </label>
            <label className="block">
              <span className="field-label">{t.budgetTo}</span>
              <input name="hasta" type="number" min={0} inputMode="numeric" defaultValue={filters.budgetMax ?? ""} className="field" />
            </label>
            <div className="flex items-center gap-3">
              <button className="inline-flex h-11 items-center rounded-full bg-ink-800 px-5 font-medium text-white hover:bg-ink-900">{t.apply}</button>
              {filtered && (
                <Link href="/busco-piso/solicitudes" className="text-sm text-ink-500 underline">
                  {t.clear}
                </Link>
              )}
            </div>
          </form>

          {items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
              <SearchX className="mx-auto h-10 w-10 text-ink-300" />
              <h2 className="mt-4 text-xl font-semibold text-ink-800">{filtered ? t.emptyFiltered : t.emptyTitle}</h2>
              {!filtered && <p className="mx-auto mt-2 max-w-md text-ink-500">{t.emptyText}</p>}
              <Link href="/busco-piso" className="mt-6 inline-flex h-11 items-center rounded-full bg-terracotta-500 px-5 font-semibold text-white hover:bg-terracotta-600">
                {t.publishYours}
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm font-medium text-ink-600">{t.count(items.length)}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => (
                  <SearchCard key={r.reference} r={r} t={t} />
                ))}
              </div>
              <p className="mt-8 rounded-2xl bg-white p-5 text-sm text-ink-600 ring-1 ring-sand-200">
                {t.haveProperty}{" "}
                <Link href="/contacto" className="font-semibold text-ink-800 underline">
                  {t.contact}
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
