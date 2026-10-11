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
  ALL_FEATURE_LABELS,
  CONDITIONS,
  ENERGY_RATINGS,
  LAND_CLASSIFICATIONS,
  LAND_USES,
  PROPERTY_TYPES,
  formatMeters,
  kindOf,
  needsEnergyCertificate,
  RENTAL_TYPES,
  formatPrice,
  listingPath,
  photoUrl,
  referenceFromSlug,
  type PropertyTypeCode,
} from "@/services/listings/catalog";
import { getPublicListing, goneListingTarget } from "@/services/listings/listings";
import { cityPath, citiesWithListings, searchPath } from "@/services/listings/seo";
import { inquiryConsentText } from "@/services/listings/inquiries";

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
  if (!l) return { title: "Inmueble no disponible" };
  const description = l.seoDescription || `${summary(l)}. ${l.description.slice(0, 150).replace(/\s+/g, " ")}`.slice(0, 200);
  const photo = l.photos[0];
  return {
    title: l.seoTitle || `${l.title} · ${formatPrice(l.price, l.operation)}`,
    description,
    alternates: { canonical: listingPath(l) },
    openGraph: {
      type: "website",
      title: `${l.title} · ${formatPrice(l.price, l.operation)}`,
      description,
      url: listingPath(l),
      siteName: "FINCALIA360",
      locale: "es_ES",
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
    <div lang="es">
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="bg-sand-50">
        <div className="container-page py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={rent ? "/alquilar" : "/comprar"} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
              <ArrowLeft className="h-4 w-4" /> {rent ? "Inmuebles en alquiler" : "Inmuebles en venta"}
            </Link>
            <ListingBreadcrumbs l={l} />
          </div>

          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <Gallery photos={l.photos} title={l.title} />

              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="rounded-full bg-ink-800 px-2.5 py-1 font-semibold text-white">{rent ? "Alquiler" : "Venta"}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-600 ring-1 ring-sand-200">{PROPERTY_TYPES[l.propertyType as PropertyTypeCode]}</span>
                  {l.status === "RESERVED" && <span className="rounded-full bg-terracotta-500 px-2.5 py-1 font-semibold text-white">Reservado</span>}
                  <span className="text-ink-400">Ref. {l.reference}</span>
                </div>
                <h1 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-tight text-ink-800 sm:text-4xl">{l.title}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-ink-500">
                  <MapPin className="h-4 w-4" /> {[l.zone, l.municipality, province].filter((v, i, all): v is string => Boolean(v) && all.findIndex((x) => x?.toLowerCase() === v?.toLowerCase()) === i).join(", ")}
                </p>
                <p className="mt-4 text-[32px] font-semibold tracking-tight text-ink-800">{formatPrice(l.price, l.operation)}</p>
                {l.communityFee ? <p className="text-sm text-ink-500">Gastos de comunidad: {formatPrice(l.communityFee, "RENT")}</p> : null}

                <KeyFacts
                  items={[
                    { icon: Ruler, label: kind === "LAND" ? "Terreno" : "Superficie", value: l.builtArea != null ? `${l.builtArea.toLocaleString("es-ES")} m²` : null },
                    { icon: MoveHorizontal, label: "Medidas", value: kind === "GARAGE" && l.berthLength ? `${formatMeters(l.berthLength)}${l.berthWidth ? ` × ${formatMeters(l.berthWidth)}` : ""}` : null },
                    { icon: BedDouble, label: "Habitaciones", value: l.bedrooms != null ? String(l.bedrooms) : null },
                    { icon: Bath, label: kind === "COMMERCIAL" ? "Aseos" : "Baños", value: l.bathrooms != null ? String(l.bathrooms) : null },
                    { icon: Layers, label: "Planta", value: l.floor },
                    { icon: Sparkles, label: "Estado", value: l.condition ? CONDITIONS[l.condition as keyof typeof CONDITIONS] : null },
                    { icon: LandPlot, label: "Clasificación", value: l.landClassification ? LAND_CLASSIFICATIONS[l.landClassification as keyof typeof LAND_CLASSIFICATIONS] : null },
                    { icon: Layers, label: "Uso", value: l.landUse ? LAND_USES[l.landUse as keyof typeof LAND_USES] : null },
                  ]}
                />
              </div>

              {l.description && (
                <section className="mt-8 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Descripción</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{l.description}</p>
                </section>
              )}

              {l.distribution && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Distribución</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{l.distribution}</p>
                </section>
              )}

              {features.length > 0 && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Características</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[15px] text-ink-700">
                        <Check className="h-4 w-4 text-pine-600" /> {ALL_FEATURE_LABELS[f] ?? f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-sand-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink-800">Datos básicos</h2>
                  <dl className="mt-2">
                    <Fact label="Tipo" value={PROPERTY_TYPES[l.propertyType as PropertyTypeCode]} />
                    {l.builtArea != null && <Fact label={kind === "LAND" ? "Superficie del terreno" : "Superficie construida"} value={`${l.builtArea.toLocaleString("es-ES")} m²`} />}
                    {kind === "GARAGE" && l.berthLength != null && <Fact label="Largo de la plaza" value={formatMeters(l.berthLength)} />}
                    {kind === "GARAGE" && l.berthWidth != null && <Fact label="Ancho de la plaza" value={formatMeters(l.berthWidth)} />}
                    {l.landClassification && <Fact label="Clasificación urbanística" value={LAND_CLASSIFICATIONS[l.landClassification as keyof typeof LAND_CLASSIFICATIONS]} />}
                    {l.landUse && <Fact label="Uso permitido" value={LAND_USES[l.landUse as keyof typeof LAND_USES]} />}
                    {l.usefulArea != null && <Fact label="Superficie útil" value={`${l.usefulArea} m²`} />}
                    {l.floor && <Fact label="Planta" value={l.floor} />}
                    {l.yearBuilt && <Fact label="Año de construcción" value={l.yearBuilt} />}
                    {l.condition && <Fact label="Estado" value={CONDITIONS[l.condition as keyof typeof CONDITIONS]} />}
                    <Fact label="Referencia" value={l.reference} />
                  </dl>
                </div>
                {(needsEnergyCertificate(kind) || l.energyRating) && (
                  <div className="rounded-2xl border border-sand-200 bg-white p-5">
                    <h2 className="text-lg font-semibold text-ink-800">Certificado energético</h2>
                    <dl className="mt-2">
                      <Fact label="Calificación" value={l.energyRating ? ENERGY_RATINGS[l.energyRating as keyof typeof ENERGY_RATINGS] : "—"} />
                      {l.energyConsumption != null && <Fact label="Consumo" value={`${l.energyConsumption} kWh/m² año`} />}
                      {l.energyEmissions != null && <Fact label="Emisiones" value={`${l.energyEmissions} kg CO₂/m² año`} />}
                    </dl>
                  </div>
                )}
              </section>

              {l.extraInfo && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Información adicional</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{l.extraInfo}</p>
                </section>
              )}

              {rent && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Condiciones del alquiler</h2>
                  <dl className="mt-2 sm:max-w-lg">
                    {l.rentalType && <Fact label="Tipo de alquiler" value={RENTAL_TYPES[l.rentalType as keyof typeof RENTAL_TYPES]} />}
                    <Fact label="Renta mensual" value={formatPrice(l.price, "RENT")} />
                    {l.depositMonths != null && <Fact label="Fianza" value={`${l.depositMonths} ${l.depositMonths === 1 ? "mes" : "meses"}`} />}
                    {l.minTermMonths != null && <Fact label="Duración mínima" value={`${l.minTermMonths} meses`} />}
                    {l.availableFrom && <Fact label="Disponible desde" value={l.availableFrom.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} />}
                    {l.rentalRegistry && <Fact label="Nº Registro Único de Arrendamientos" value={l.rentalRegistry} />}
                  </dl>
                  {l.rentConditions && <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-600">{l.rentConditions}</p>}
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div id="contacto" className="scroll-mt-24 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold text-ink-800">¿Te interesa?</h2>
                <p className="mt-1 text-sm text-ink-500">Pide más información o concierta una visita.</p>
                <div className="mt-4">
                  <InquiryForm reference={l.reference} consentText={inquiryConsentText(advertiser, l.reference)} />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4 text-[13px] text-ink-500">
                <p className="flex items-center gap-2 font-medium text-ink-700">
                  <Building2 className="h-4 w-4" /> Anunciante: {advertiser ?? "FINCALIA360"}
                </p>
                <p className="mt-2 leading-snug">
                  La ubicación es aproximada. Los datos los facilita el anunciante y se revisan antes de publicar. Comprueba la documentación antes de firmar.
                </p>
                <p className="mt-2 text-ink-400">Actualizado el {l.updatedAt.toLocaleDateString("es-ES")}</p>
              </div>
            </aside>
          </div>
          <SimilarListings l={l} />
        </div>
        {/* Espacio para la barra de contacto fija del móvil */}
        <div className="h-20 lg:hidden" aria-hidden />
        <MobileContactBar price={formatPrice(l.price, l.operation)} />
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
