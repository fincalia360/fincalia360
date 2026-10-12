// Ficha pública de un negocio en traspaso (/traspaso/<slug>). Mismo diseño y componentes que las
// demás fichas; el precio es el del traspaso y el alquiler del local se muestra aparte.
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Check, KeyRound, MapPin, Ruler, Store } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Gallery } from "@/components/portal/Gallery";
import { InquiryForm } from "@/components/portal/InquiryForm";
import { KeyFacts, MobileContactBar } from "@/components/portal/KeyFacts";
import { ListingViewTracker, ShareButtons } from "@/components/portal/ListingShare";
import { localPrice } from "@/components/portal/ListingCard";
import { getDictionary } from "@/lib/i18n";
import { catalogLabels } from "@/lib/i18n/portal/labels";
import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { transferTexts } from "@/lib/i18n/transfers";
import { publicSiteUrl } from "@/lib/site";
import { csv } from "@/lib/utils";
import { BUSINESS_TYPES, formatPrice, listingPath, photoUrl, referenceFromSlug, type BusinessTypeCode } from "@/services/listings/catalog";
import { getPublicListing } from "@/services/listings/listings";
import { metaDescription, portalMetadata } from "@/services/listings/seo";
import { localizedTexts } from "@/services/listings/translations";
import { getProvince } from "@/services/study/geo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const ref = referenceFromSlug(slug);
  return ref ? getPublicListing(ref, "BUSINESS") : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await load((await params).slug);
  if (!l) return { title: "404" };
  const lang = await getSiteLang();
  const tt = transferTexts(lang);
  const tx = localizedTexts(l, lang);
  const spanish = lang === "es";
  const type = catalogLabels(lang).types[l.propertyType] ?? BUSINESS_TYPES[l.propertyType as BusinessTypeCode];
  const price = localPrice(l.price, "TRANSFER", null, catalogLabels(lang), portalDict(lang).locale);
  const description =
    (spanish && l.seoDescription) ||
    metaDescription([spanish ? `Traspaso de ${type.toLowerCase()} en ${l.municipality} · ${formatPrice(l.price, "TRANSFER")}.` : `${type} · ${l.municipality} · ${price}.`, tx.description]);
  const photo = l.photos[0];
  const base = portalMetadata({ title: (spanish && l.seoTitle) || tt.pageTitle(tx.title ?? l.title, price), description, path: listingPath(l) });
  return {
    ...base,
    openGraph: { ...base.openGraph, ...(photo ? { images: [{ url: photoUrl(photo.key), width: photo.width, height: photo.height, alt: l.title }] } : {}) },
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

export default async function TransferPage({ params }: Props) {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) {
    // Traspasado o retirado: a la lista de traspasos (nunca un error)
    if (referenceFromSlug(slug)) redirect("/traspasos");
    notFound();
  }
  if (l.slug !== slug) permanentRedirect(listingPath(l));

  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const d = portalDict(lang);
  const t = d.detail;
  const tt = transferTexts(lang);
  const L = catalogLabels(lang);
  const tx = localizedTexts(l, lang);
  const price = localPrice(l.price, "TRANSFER", null, L, d.locale);
  const eurMonth = (v: number) => `${localPrice(v, "SALE", null, L, d.locale)}${tt.perMonth}`;
  const province = getProvince(l.provinceCode)?.name;
  const features = csv(l.features);
  const advertiser = l.agency?.name ?? null;
  const type = L.types[l.propertyType] ?? l.propertyType;
  const site = publicSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: l.title,
    description: l.description.slice(0, 500),
    url: `${site}${listingPath(l)}`,
    image: l.photos.slice(0, 5).map((p) => `${site}${photoUrl(p.key)}`),
    price: l.price,
    priceCurrency: "EUR",
    itemOffered: { "@type": "LocalBusiness", name: l.title, address: { "@type": "PostalAddress", addressLocality: l.municipality, addressRegion: province, addressCountry: "ES" } },
  };

  return (
    <div lang={lang}>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="bg-sand-50">
        <div className="container-page py-6 sm:py-8">
          <Link href="/traspasos" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
            <ArrowLeft className="h-4 w-4" /> {tt.back}
          </Link>

          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <Gallery
                photos={l.photos}
                title={tx.title ?? l.title}
                t={{ prev: t.photoPrev, next: t.photoNext, photoN: Array.from({ length: l.photos.length }, (_, i) => t.photoN(i + 1)), alt: Array.from({ length: l.photos.length }, (_, i) => t.photoAlt(tx.title ?? l.title, i + 1)) }}
              />

              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="rounded-full bg-ink-800 px-2.5 py-1 font-semibold text-white">{d.card.transfer}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-600 ring-1 ring-sand-200">{type}</span>
                  {l.status === "RESERVED" && <span className="rounded-full bg-terracotta-500 px-2.5 py-1 font-semibold text-white">{t.reserved}</span>}
                  <span className="text-ink-400">
                    {t.ref} {l.reference}
                  </span>
                </div>
                <h1 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-tight text-ink-800 sm:text-4xl">{tx.title}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-ink-500">
                  <MapPin className="h-4 w-4" /> {[l.zone, l.municipality, province].filter((v, i, all): v is string => Boolean(v) && all.findIndex((x) => x?.toLowerCase() === v?.toLowerCase()) === i).join(", ")}
                </p>
                <p className="mt-4 text-sm font-medium uppercase tracking-wide text-ink-500">{tt.transferPrice}</p>
                <p className="text-[32px] font-semibold tracking-tight text-ink-800">{price}</p>
                <p className="text-sm text-ink-500">{tt.transferPriceNote}</p>
                {l.premisesRent ? (
                  <p className="mt-1 text-sm text-ink-600">
                    {tt.premisesRent}: <strong>{eurMonth(l.premisesRent)}</strong>
                  </p>
                ) : null}
                <div className="mt-4">
                  <ShareButtons listingId={l.id} url={`${site}${listingPath(l)}`} message={`${tx.title} · ${tt.transferPrice} ${price}`} t={d.share} />
                </div>
                <ListingViewTracker listingId={l.id} />

                <KeyFacts
                  items={[
                    { icon: Store, label: tt.businessCategory, value: type },
                    { icon: Ruler, label: tt.area, value: l.builtArea ? `${l.builtArea.toLocaleString(d.locale)} m²` : null },
                    { icon: KeyRound, label: tt.premisesRent, value: l.premisesRent ? eurMonth(l.premisesRent) : null },
                  ]}
                />
              </div>

              {!tx.translated && lang !== "es" && <p className="mt-4 text-xs text-ink-400">{t.original}</p>}

              <section className="mt-6 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-ink-800">{tt.description}</h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{tx.description}</p>
              </section>

              <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-ink-800">{t.adData}</h2>
                <dl className="mt-3">
                  <Fact label={tt.businessCategory} value={type} />
                  <Fact label={tt.transferPrice} value={price} />
                  {l.premisesRent ? <Fact label={tt.premisesRent} value={eurMonth(l.premisesRent)} /> : null}
                  {l.builtArea ? <Fact label={tt.area} value={`${l.builtArea.toLocaleString(d.locale)} m²`} /> : null}
                  {l.bathrooms != null ? <Fact label={tt.toilets} value={l.bathrooms} /> : null}
                  {l.floor ? <Fact label={tt.floor} value={l.floor} /> : null}
                  {l.condition ? <Fact label={tt.condition} value={L.conditions[l.condition] ?? l.condition} /> : null}
                </dl>
              </section>

              {features.length > 0 && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{tt.features}</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[15px] text-ink-700">
                        <Check className="h-4 w-4 shrink-0 text-pine-600" /> {L.features[f] ?? f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {l.distribution && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{tt.distribution}</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{l.distribution}</p>
                </section>
              )}

              {tx.extraInfo && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">{tt.info}</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{tx.extraInfo}</p>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div id="contacto" className="scroll-mt-24 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold text-ink-800">{tt.interest}</h2>
                <p className="mt-1 text-sm text-ink-500">{tt.interestText}</p>
                <div className="mt-4">
                  <InquiryForm reference={l.reference} lang={lang} consentText={d.inquiry.consent(advertiser, "inmueble", l.reference)} />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4 text-[13px] text-ink-500">
                <p className="flex items-center gap-2 font-medium text-ink-700">
                  <Building2 className="h-4 w-4" /> {t.advertiser}: {advertiser ?? "FINCALIA360"}
                </p>
                <p className="mt-2 text-ink-400">{t.updated(l.updatedAt.toLocaleDateString(d.locale))}</p>
              </div>
            </aside>
          </div>
        </div>
        <div className="h-20 lg:hidden" aria-hidden />
        <MobileContactBar price={price} label={t.contact} />
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
