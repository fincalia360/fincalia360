import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import Link from "next/link";
import { BedDouble, Bath, Ruler, MapPin, Check, ArrowLeft, Building2, Layers, Sparkles, MoveHorizontal, LandPlot } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Gallery } from "@/components/portal/Gallery";
import { InquiryForm } from "@/components/portal/InquiryForm";
import { KeyFacts, MobileContactBar } from "@/components/portal/KeyFacts";
import { ListingBreadcrumbs, SimilarListings } from "@/components/portal/ListingExtras";
import { getDictionary } from "@/lib/i18n";
import { publicSiteUrl } from "@/lib/site";
import { csv } from "@/lib/utils";
import { getProvince } from "@/services/study/geo";
import {
  PROPERTY_TYPES,
  formatMeters,
  kindOf,
  needsEnergyCertificate,
  formatPrice,
  listingPath,
  photoUrl,
  referenceFromSlug,
  type PropertyTypeCode,
} from "@/services/listings/catalog";
import { getPublicListing, goneListingTarget } from "@/services/listings/listings";
import { cityPath, citiesWithListings, searchPath } from "@/services/listings/seo";
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

/** Anuncio vendido, alquilado o retirado: redirige a su población (o a su sección) en vez de dar error. */
async function redirectGone(slug: string) {
  const ref = referenceFromSlug(slug);
  const t = ref ? await goneListingTarget(ref) : null;
  if (!t) return;
  const cities = await citiesWithListings(t.category, t.operation);
  redirect(cities.some((c) => c.name === t.municipality) ? cityPath(t.category, t.operation, t.municipality) : searchPath(t.category, t.operation));
}

function summary(l: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const parts = [
    PROPERTY_TYPES[l.propertyType as PropertyTypeCode],
    l.operation === "RENT" ? "en alquiler" : "en venta",
    `en ${l.municipality}`,
    l.builtArea ? `${l.builtArea} m²` : null,
    l.bedrooms ? `${l.bedrooms} habitaciones` : null,
    formatPrice(l.price, l.operation),
  ];
  return parts.filter(Boolean).join(" · ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await load((await params).slug);
  if (!l) return { title: "404" };
  const lang = await getSiteLang();
  const tx = localizedTexts(l, lang);
  const spanish = lang === "es";
  const description = (spanish && l.seoDescription) || `${spanish ? summary(l) + ". " : ""}${(tx.description ?? "").slice(0, 150).replace(/\s+/g, " ")}`.slice(0, 200);
  const photo = l.photos[0];
  return {
    title: (spanish && l.seoTitle) || `${tx.title} · ${localPrice(l.price, l.operation, null, catalogLabels(lang), portalDict(lang).locale)}`,
    description,
    alternates: { canonical: listingPath(l) },
    openGraph: {
      type: "website",
      title: `${tx.title} · ${formatPrice(l.price, l.operation)}`,
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

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) {
    await redirectGone(slug);
    notFound();
  }
  // Los amarres tienen su propia ficha (/amarre/…)
  if (l.slug !== slug || l.category === "MOORING") permanentRedirect(listingPath(l));

  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const d = portalDict(lang);
  const t = d.detail;
  const L = catalogLabels(lang);
  const tx = localizedTexts(l, lang);
  const price = (v: number, op: string) => localPrice(v, op, null, L, d.locale);
  const area = (v: number) => `${v.toLocaleString(d.locale)} m²`;
  const rent = l.operation === "RENT";
  const features = csv(l.features);
  const kind = kindOf(l);
  const province = getProvince(l.provinceCode)?.name;
  const advertiser = l.agency?.name ?? null;
  const site = publicSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: l.title,
    description: l.description.slice(0, 500),
    url: `${site}${listingPath(l)}`,
    datePosted: l.publishedAt?.toISOString(),
    image: l.photos.slice(0, 5).map((p) => `${site}${photoUrl(p.key)}`),
    offers: { "@type": "Offer", price: l.price, priceCurrency: "EUR", businessFunction: rent ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell" },
    contentLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: l.municipality, addressRegion: province, addressCountry: "ES", ...(l.postalCode ? { postalCode: l.postalCode } : {}) } },
  };

  return (
    <div>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="bg-sand-50">
        <div className="container-page py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={rent ? "/alquilar" : "/comprar"} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
              <ArrowLeft className="h-4 w-4" /> {rent ? t.backRent : t.backSale}
            </Link>
            <ListingBreadcrumbs l={l} names={{ home: t.home, sale: d.nav.sale, rent: d.nav.rent, mooringSale: t.backMooringSale, mooringRent: t.backMooringRent }} title={tx.title ?? l.title} ariaLabel={d.results.path} />
          </div>

          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <Gallery photos={l.photos} title={tx.title ?? l.title} t={{ prev: t.photoPrev, next: t.photoNext, photoN: Array.from({ length: l.photos.length }, (_, i) => t.photoN(i + 1)), alt: Array.from({ length: l.photos.length }, (_, i) => t.photoAlt(tx.title ?? l.title, i + 1)) }} />

              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="rounded-full bg-ink-800 px-2.5 py-1 font-semibold text-white">{rent ? t.rent : t.sale}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-600 ring-1 ring-sand-200">{L.types[l.propertyType]}</span>
                  {l.status === "RESERVED" && <span className="rounded-full bg-terracotta-500 px-2.5 py-1 font-semibold text-white">{t.reserved}</span>}
                  <span className="text-ink-400">{t.ref} {l.reference}</span>
                </div>
                <h1 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-tight text-ink-800 sm:text-4xl">{tx.title}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-ink-500">
                  <MapPin className="h-4 w-4" /> {[l.zone, l.municipality, province].filter((v, i, all): v is string => Boolean(v) && all.findIndex((x) => x?.toLowerCase() === v?.toLowerCase()) === i).join(", ")}
                </p>
                <p className="mt-4 text-[32px] font-semibold tracking-tight text-ink-800">{price(l.price, l.operation)}</p>
                {l.communityFee ? <p className="text-sm text-ink-500">{t.communityFee}: {price(l.communityFee, "RENT")}</p> : null}

                <KeyFacts
                  items={[
                    { icon: Ruler, label: kind === "LAND" ? t.facts.land : t.facts.size, value: l.builtArea != null ? area(l.builtArea) : null },
                    { icon: MoveHorizontal, label: t.facts.measures, value: kind === "GARAGE" && l.berthLength ? `${formatMeters(l.berthLength)}${l.berthWidth ? ` × ${formatMeters(l.berthWidth)}` : ""}` : null },
                    { icon: BedDouble, label: t.facts.rooms, value: l.bedrooms != null ? String(l.bedrooms) : null },
                    { icon: Bath, label: kind === "COMMERCIAL" ? t.facts.toilets : t.facts.baths, value: l.bathrooms != null ? String(l.bathrooms) : null },
                    { icon: Layers, label: t.facts.floor, value: l.floor },
                    { icon: Sparkles, label: t.facts.condition, value: l.condition ? L.conditions[l.condition] : null },
                    { icon: LandPlot, label: t.facts.landClass, value: l.landClassification ? L.landClasses[l.landClassification] : null },
                    { icon: Layers, label: t.facts.landUse, value: l.landUse ? L.landUses[l.landUse] : null },
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

              {tx.distribution && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.distribution}</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{tx.distribution}</p>
                </section>
              )}

              {features.length > 0 && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.features}</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[15px] text-ink-700">
                        <Check className="h-4 w-4 text-pine-600" /> {L.features[f] ?? f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-sand-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink-800">{t.basicData}</h2>
                  <dl className="mt-2">
                    <Fact label={t.type} value={L.types[l.propertyType]} />
                    {l.builtArea != null && <Fact label={kind === "LAND" ? t.landArea : t.builtArea} value={area(l.builtArea)} />}
                    {kind === "GARAGE" && l.berthLength != null && <Fact label={t.spaceLength} value={formatMeters(l.berthLength)} />}
                    {kind === "GARAGE" && l.berthWidth != null && <Fact label={t.spaceWidth} value={formatMeters(l.berthWidth)} />}
                    {l.landClassification && <Fact label={t.landClass} value={L.landClasses[l.landClassification]} />}
                    {l.landUse && <Fact label={t.landUse} value={L.landUses[l.landUse]} />}
                    {l.usefulArea != null && <Fact label={t.usefulArea} value={area(l.usefulArea)} />}
                    {l.floor && <Fact label={t.floor} value={l.floor} />}
                    {l.yearBuilt && <Fact label={t.year} value={l.yearBuilt} />}
                    {l.condition && <Fact label={t.condition} value={L.conditions[l.condition]} />}
                    <Fact label={t.reference} value={l.reference} />
                  </dl>
                </div>
                {(needsEnergyCertificate(kind) || l.energyRating) && (
                  <div className="rounded-2xl border border-sand-200 bg-white p-5">
                    <h2 className="text-lg font-semibold text-ink-800">{t.energy}</h2>
                    <dl className="mt-2">
                      <Fact label={t.rating} value={l.energyRating ? L.energy[l.energyRating] : "—"} />
                      {l.energyConsumption != null && <Fact label={t.consumption} value={`${l.energyConsumption.toLocaleString(d.locale)} kWh/m²·a`} />}
                      {l.energyEmissions != null && <Fact label={t.emissions} value={`${l.energyEmissions.toLocaleString(d.locale)} kg CO₂/m²·a`} />}
                    </dl>
                  </div>
                )}
              </section>

              {tx.extraInfo && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.extraInfo}</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{tx.extraInfo}</p>
                </section>
              )}

              {rent && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{t.rentConditions}</h2>
                  <dl className="mt-2 sm:max-w-lg">
                    {l.rentalType && <Fact label={t.rentalType} value={L.rentalTypes[l.rentalType]} />}
                    <Fact label={t.monthlyRent} value={price(l.price, "RENT")} />
                    {l.depositMonths != null && <Fact label={t.depositLabel} value={t.deposit(l.depositMonths)} />}
                    {l.minTermMonths != null && <Fact label={t.minTerm} value={t.months(l.minTermMonths)} />}
                    {l.availableFrom && <Fact label={t.availableFrom} value={l.availableFrom.toLocaleDateString(d.locale, { day: "numeric", month: "long", year: "numeric" })} />}
                    {l.rentalRegistry && <Fact label={t.registry} value={l.rentalRegistry} />}
                  </dl>
                  {tx.rentConditions && <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-600">{tx.rentConditions}</p>}
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div id="contacto" className="scroll-mt-24 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold text-ink-800">{t.interested}</h2>
                <p className="mt-1 text-sm text-ink-500">{t.interestedText}</p>
                <div className="mt-4">
                  <InquiryForm reference={l.reference} lang={lang} consentText={d.inquiry.consent(advertiser, "inmueble", l.reference)} />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4 text-[13px] text-ink-500">
                <p className="flex items-center gap-2 font-medium text-ink-700">
                  <Building2 className="h-4 w-4" /> {t.advertiser}: {advertiser ?? "FINCALIA360"}
                </p>
                <p className="mt-2 leading-snug">{t.disclaimer}</p>
                <p className="mt-2 text-ink-400">{t.updated(l.updatedAt.toLocaleDateString(d.locale))}</p>
              </div>
            </aside>
          </div>
          <SimilarListings l={l} lang={lang} />
        </div>
        {/* Espacio para la barra de contacto fija del móvil */}
        <div className="h-20 lg:hidden" aria-hidden />
        <MobileContactBar price={price(l.price, l.operation)} label={t.contact} />
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
