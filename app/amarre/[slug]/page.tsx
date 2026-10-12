import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import Link from "next/link";
import { Anchor, ArrowLeft, Building2, CalendarDays, Check, MapPin, Ruler, Ship } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Gallery } from "@/components/portal/Gallery";
import { InquiryForm } from "@/components/portal/InquiryForm";
import { KeyFacts, MobileContactBar } from "@/components/portal/KeyFacts";
import { ListingViewTracker, ShareButtons } from "@/components/portal/ListingShare";
import { ListingBreadcrumbs, SimilarListings } from "@/components/portal/ListingExtras";
import { getDictionary } from "@/lib/i18n";
import { publicSiteUrl } from "@/lib/site";
import { csv } from "@/lib/utils";
import { getProvince } from "@/services/study/geo";
import {
  formatMeters,
  formatPrice,
  listingPath,
  photoUrl,
  referenceFromSlug,
  type MooringFeatureCode,
} from "@/services/listings/catalog";
import { getPublicListing, goneListingTarget } from "@/services/listings/listings";
import { cityPath, citiesWithListings, searchPath, metaDescription } from "@/services/listings/seo";
import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { catalogLabels } from "@/lib/i18n/portal/labels";
import { localPrice } from "@/components/portal/ListingCard";
import { localizedTexts } from "@/services/listings/translations";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const ref = referenceFromSlug(slug);
  return ref ? getPublicListing(ref) : null;
}

type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

function summary(l: Loaded) {
  const parts = [
    "Amarre",
    l.operation === "RENT" ? "en alquiler" : "en venta",
    l.portName ? `en ${l.portName}` : `en ${l.municipality}`,
    l.berthLength ? `${formatMeters(l.berthLength)}${l.berthWidth ? ` × ${formatMeters(l.berthWidth)}` : ""}` : null,
    formatPrice(l.price, l.operation, l.rentPeriod),
  ];
  return parts.filter(Boolean).join(" · ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await load((await params).slug);
  if (!l || l.category !== "MOORING") return { title: "404" };
  const lang = await getSiteLang();
  const tx = localizedTexts(l, lang);
  const spanish = lang === "es";
  const description = (spanish && l.seoDescription) || metaDescription([spanish ? `${summary(l)}.` : null, tx.description]);
  const photo = l.photos[0];
  const price = localPrice(l.price, l.operation, l.rentPeriod, catalogLabels(lang), portalDict(lang).locale);
  return {
    title: (spanish && l.seoTitle) || `${tx.title} · ${price}`,
    description,
    alternates: { canonical: listingPath(l) },
    openGraph: {
      type: "website",
      title: `${tx.title} · ${price}`,
      description,
      url: listingPath(l),
      siteName: "FINCALIA360",
      locale: portalDict(lang).locale.replace("-", "_"),
      ...(photo ? { images: [{ url: photoUrl(photo.key), width: photo.width, height: photo.height, alt: l.title }] } : {}),
    },
    twitter: { card: photo ? "summary_large_image" : "summary" },
  };
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-sand-100 py-2.5 text-[14.5px]">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-800">{value}</dd>
    </div>
  );
}


export default async function MooringPage({ params }: Props) {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) {
    // Vendido, alquilado o retirado: a su población o a su sección, en vez de dar error
    const ref = referenceFromSlug(slug);
    const t = ref ? await goneListingTarget(ref) : null;
    if (t) {
      const cities = await citiesWithListings(t.category, t.operation);
      redirect(cities.some((c) => c.name === t.municipality) ? cityPath(t.category, t.operation, t.municipality) : searchPath(t.category, t.operation));
    }
    notFound();
  }
  // Una vivienda tiene su propia ficha (/inmueble/…)
  if (l.slug !== slug || l.category !== "MOORING") permanentRedirect(listingPath(l));

  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const d = portalDict(lang);
  const t = d.detail;
  const L = catalogLabels(lang);
  const tx = localizedTexts(l, lang);
  const longDate = (v: Date) => v.toLocaleDateString(d.locale, { day: "numeric", month: "long", year: "numeric" });
  const rent = l.operation === "RENT";
  const features = csv(l.features) as MooringFeatureCode[];
  const province = getProvince(l.provinceCode)?.name;
  const advertiser = l.agency?.name ?? null;
  const price = localPrice(l.price, l.operation, l.rentPeriod, L, d.locale);
  const available = l.availableFrom && l.availableFrom > new Date() ? t.fromDate(longDate(l.availableFrom)) : t.immediate;
  const site = publicSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.description.slice(0, 500),
    url: `${site}${listingPath(l)}`,
    image: l.photos.slice(0, 5).map((p) => `${site}${photoUrl(p.key)}`),
    offers: { "@type": "Offer", price: l.price, priceCurrency: "EUR", businessFunction: rent ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell" },
  };

  return (
    <div>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="bg-sand-50">
        <div className="container-page py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={rent ? "/amarres/alquilar" : "/amarres/comprar"} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
              <ArrowLeft className="h-4 w-4" /> {rent ? t.backMooringRent : t.backMooringSale}
            </Link>
            <ListingBreadcrumbs l={l} names={{ home: t.home, sale: d.nav.sale, rent: d.nav.rent, mooringSale: t.backMooringSale, mooringRent: t.backMooringRent }} title={tx.title ?? l.title} ariaLabel={d.results.path} />
          </div>

          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <Gallery photos={l.photos} title={tx.title ?? l.title} t={{ prev: t.photoPrev, next: t.photoNext, photoN: Array.from({ length: l.photos.length }, (_, i) => t.photoN(i + 1)), alt: Array.from({ length: l.photos.length }, (_, i) => t.photoAlt(tx.title ?? l.title, i + 1)) }} />

              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="rounded-full bg-ink-800 px-2.5 py-1 font-semibold text-white">{rent ? t.rent : t.sale}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-600 ring-1 ring-sand-200">
                    {d.card.mooring}
                    {l.mooringType ? ` · ${L.mooringTypes[l.mooringType]}` : ""}
                  </span>
                  {l.status === "RESERVED" && <span className="rounded-full bg-terracotta-500 px-2.5 py-1 font-semibold text-white">{t.reserved}</span>}
                  <span className="text-ink-400">{t.ref} {l.reference}</span>
                </div>
                <h1 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-tight text-ink-800 sm:text-4xl">{tx.title}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-ink-500">
                  <MapPin className="h-4 w-4" /> {[l.portName, l.zone, l.municipality, province].filter(Boolean).join(", ")}
                </p>
                <p className="mt-4 text-[32px] font-semibold tracking-tight text-ink-800">{price}</p>
                {l.communityFee ? <p className="text-sm text-ink-500">{t.maintenanceFee}: {localPrice(l.communityFee, "RENT", "MONTH", L, d.locale)}</p> : null}
                <div className="mt-4">
                  <ShareButtons listingId={l.id} url={`${site}${listingPath(l)}`} message={`${tx.title} · ${price}`} t={d.share} />
                </div>
                <ListingViewTracker listingId={l.id} />

                <KeyFacts
                  items={[
                    { icon: Anchor, label: t.facts.measures, value: l.berthLength != null ? `${formatMeters(l.berthLength)}${l.berthWidth != null ? ` × ${formatMeters(l.berthWidth)}` : ""}` : null },
                    { icon: Ship, label: t.facts.maxLength, value: formatMeters(l.maxBoatLength) },
                    { icon: Ship, label: t.facts.maxBeam, value: formatMeters(l.maxBoatBeam) },
                    { icon: Ruler, label: t.facts.size, value: l.builtArea != null ? `${l.builtArea} m²` : null },
                    { icon: CalendarDays, label: t.facts.availability, value: available },
                  ]}
                />
              </div>

              {tx.description && (
                <section className="mt-8 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.description}</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600" lang={tx.translated ? lang : "es"}>
                    {tx.description}
                  </p>
                  {lang !== "es" && !tx.translated && <p className="mt-3 text-xs italic text-ink-400">{t.original}</p>}
                </section>
              )}

              <section className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-sand-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink-800">{t.measures}</h2>
                  <dl className="mt-2">
                    {l.berthLength != null && <Fact label={t.berthLength} value={formatMeters(l.berthLength)} />}
                    {l.berthWidth != null && <Fact label={t.berthWidth} value={formatMeters(l.berthWidth)} />}
                    {l.maxBoatLength != null && <Fact label={t.maxBoatLength} value={formatMeters(l.maxBoatLength)} />}
                    {l.maxBoatBeam != null && <Fact label={t.maxBoatBeam} value={formatMeters(l.maxBoatBeam)} />}
                    {l.berthDepth != null && <Fact label={t.depth} value={formatMeters(l.berthDepth)} />}
                    {l.builtArea != null && <Fact label={t.area} value={`${l.builtArea} m²`} />}
                  </dl>
                </div>
                <div className="rounded-2xl border border-sand-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink-800">{t.adData}</h2>
                  <dl className="mt-2">
                    {l.portName && <Fact label={t.port} value={l.portName} />}
                    <Fact label={t.town} value={province ? `${l.municipality} (${province})` : l.municipality} />
                    {l.mooringType && <Fact label={t.mooringType} value={L.mooringTypes[l.mooringType]} />}
                    <Fact label={t.operation} value={rent ? t.rentPer(L.rentPeriods[l.rentPeriod ?? "MONTH"]) : t.sale} />
                    {l.concessionEnd && <Fact label={t.concessionEnd} value={l.concessionEnd} />}
                    <Fact label={t.availability} value={available} />
                    <Fact label={t.reference} value={l.reference} />
                  </dl>
                </div>
              </section>

              {features.length > 0 && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.services}</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[15px] text-ink-700">
                        <Check className="h-4 w-4 text-pine-600" /> {L.features[f] ?? f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {rent && (l.depositMonths != null || l.minTermMonths != null || tx.rentConditions) && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.rentConditions}</h2>
                  <dl className="mt-2 sm:max-w-lg">
                    <Fact label={t.price} value={price} />
                    {l.depositMonths != null && <Fact label={t.depositLabel} value={t.deposit(l.depositMonths)} />}
                    {l.minTermMonths != null && <Fact label={t.minTerm} value={t.months(l.minTermMonths)} />}
                  </dl>
                  {tx.rentConditions && <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-600">{tx.rentConditions}</p>}
                </section>
              )}

              {tx.extraInfo && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.extraInfo}</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{tx.extraInfo}</p>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div id="contacto" className="scroll-mt-24 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold text-ink-800">{t.interestedMooring}</h2>
                <p className="mt-1 text-sm text-ink-500">{t.interestedText}</p>
                <div className="mt-4">
                  <InquiryForm reference={l.reference} lang={lang} consentText={d.inquiry.consent(advertiser, "amarre", l.reference)} />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4 text-[13px] text-ink-500">
                <p className="flex items-center gap-2 font-medium text-ink-700">
                  <Building2 className="h-4 w-4" /> {t.advertiser}: {advertiser ?? "FINCALIA360"}
                </p>
                <p className="mt-2 leading-snug">{t.mooringDisclaimer}</p>
                <p className="mt-2 text-ink-400">{t.updated(l.updatedAt.toLocaleDateString(d.locale))}</p>
              </div>
            </aside>
          </div>
          <SimilarListings l={l} lang={lang} />
        </div>
        {/* Espacio para la barra de contacto fija del móvil */}
        <div className="h-20 lg:hidden" aria-hidden />
        <MobileContactBar price={price} label={t.contact} />
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
