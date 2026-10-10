import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { Anchor, ArrowLeft, Building2, CalendarDays, Check, MapPin, Ruler, Ship } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Gallery } from "@/components/portal/Gallery";
import { InquiryForm } from "@/components/portal/InquiryForm";
import { ListingBreadcrumbs, SimilarListings } from "@/components/portal/ListingExtras";
import { getDictionary } from "@/lib/i18n";
import { publicSiteUrl } from "@/lib/site";
import { csv } from "@/lib/utils";
import { getProvince } from "@/services/study/geo";
import {
  MOORING_FEATURES,
  MOORING_TYPES,
  RENT_PERIODS,
  formatMeters,
  formatPrice,
  listingPath,
  photoUrl,
  referenceFromSlug,
  type MooringFeatureCode,
  type MooringTypeCode,
  type RentPeriod,
} from "@/services/listings/catalog";
import { getPublicListing } from "@/services/listings/listings";
import { inquiryConsentText } from "@/services/listings/inquiries";

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
  if (!l || l.category !== "MOORING") return { title: "Amarre no disponible" };
  const description = `${summary(l)}. ${l.description.slice(0, 150).replace(/\s+/g, " ")}`.slice(0, 200);
  const photo = l.photos[0];
  const price = formatPrice(l.price, l.operation, l.rentPeriod);
  return {
    title: `${l.title} · ${price}`,
    description,
    alternates: { canonical: listingPath(l) },
    openGraph: {
      type: "website",
      title: `${l.title} · ${price}`,
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

const longDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

export default async function MooringPage({ params }: Props) {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) notFound();
  // Una vivienda tiene su propia ficha (/inmueble/…)
  if (l.slug !== slug || l.category !== "MOORING") permanentRedirect(listingPath(l));

  const dict = getDictionary("es");
  const rent = l.operation === "RENT";
  const features = csv(l.features) as MooringFeatureCode[];
  const province = getProvince(l.provinceCode)?.name;
  const advertiser = l.agency?.name ?? null;
  const price = formatPrice(l.price, l.operation, l.rentPeriod);
  const available = l.availableFrom && l.availableFrom > new Date() ? `Desde el ${longDate(l.availableFrom)}` : "Inmediata";
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
    <div lang="es">
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="bg-sand-50">
        <div className="container-page py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={rent ? "/amarres/alquilar" : "/amarres/comprar"} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
              <ArrowLeft className="h-4 w-4" /> {rent ? "Amarres en alquiler" : "Amarres en venta"}
            </Link>
            <ListingBreadcrumbs l={l} />
          </div>

          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <Gallery photos={l.photos} title={l.title} />

              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="rounded-full bg-ink-800 px-2.5 py-1 font-semibold text-white">{rent ? "Alquiler" : "Venta"}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-600 ring-1 ring-sand-200">
                    Amarre{l.mooringType ? ` · ${MOORING_TYPES[l.mooringType as MooringTypeCode]}` : ""}
                  </span>
                  {l.status === "RESERVED" && <span className="rounded-full bg-terracotta-500 px-2.5 py-1 font-semibold text-white">Reservado</span>}
                  <span className="text-ink-400">Ref. {l.reference}</span>
                </div>
                <h1 className="mt-3 font-serif text-[30px] font-medium leading-tight tracking-tight text-ink-800 sm:text-4xl">{l.title}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-ink-500">
                  <MapPin className="h-4 w-4" /> {[l.portName, l.zone, l.municipality, province].filter(Boolean).join(", ")}
                </p>
                <p className="mt-4 text-[32px] font-semibold tracking-tight text-ink-800">{price}</p>
                {l.communityFee ? <p className="text-sm text-ink-500">Gastos de mantenimiento: {formatPrice(l.communityFee, "RENT")}</p> : null}

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink-700">
                  {l.berthLength != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Anchor className="h-4 w-4 text-ink-400" /> {formatMeters(l.berthLength)}
                      {l.berthWidth != null ? ` × ${formatMeters(l.berthWidth)}` : ""}
                    </span>
                  )}
                  {l.maxBoatLength != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Ship className="h-4 w-4 text-ink-400" /> Eslora máx. {formatMeters(l.maxBoatLength)}
                    </span>
                  )}
                  {l.builtArea != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler className="h-4 w-4 text-ink-400" /> {l.builtArea} m²
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-ink-400" /> Disponibilidad: {available}
                  </span>
                </div>
              </div>

              {l.description && (
                <section className="mt-8 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Descripción</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{l.description}</p>
                </section>
              )}

              <section className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-sand-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink-800">Medidas</h2>
                  <dl className="mt-2">
                    {l.berthLength != null && <Fact label="Longitud del amarre" value={formatMeters(l.berthLength)} />}
                    {l.berthWidth != null && <Fact label="Anchura del amarre" value={formatMeters(l.berthWidth)} />}
                    {l.maxBoatLength != null && <Fact label="Eslora máxima admitida" value={formatMeters(l.maxBoatLength)} />}
                    {l.maxBoatBeam != null && <Fact label="Manga máxima admitida" value={formatMeters(l.maxBoatBeam)} />}
                    {l.berthDepth != null && <Fact label="Calado" value={formatMeters(l.berthDepth)} />}
                    {l.builtArea != null && <Fact label="Superficie" value={`${l.builtArea} m²`} />}
                  </dl>
                </div>
                <div className="rounded-2xl border border-sand-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink-800">Datos del anuncio</h2>
                  <dl className="mt-2">
                    {l.portName && <Fact label="Puerto" value={l.portName} />}
                    <Fact label="Población" value={province ? `${l.municipality} (${province})` : l.municipality} />
                    {l.mooringType && <Fact label="Tipo de amarre" value={MOORING_TYPES[l.mooringType as MooringTypeCode]} />}
                    <Fact label="Operación" value={rent ? `Alquiler por ${RENT_PERIODS[(l.rentPeriod ?? "MONTH") as RentPeriod]}` : "Venta"} />
                    {l.concessionEnd && <Fact label="Fin de la concesión o derecho de uso" value={l.concessionEnd} />}
                    <Fact label="Disponibilidad" value={available} />
                    <Fact label="Referencia" value={l.reference} />
                  </dl>
                </div>
              </section>

              {features.length > 0 && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Servicios e instalaciones</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[15px] text-ink-700">
                        <Check className="h-4 w-4 text-pine-600" /> {MOORING_FEATURES[f] ?? f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {rent && (l.depositMonths != null || l.minTermMonths != null || l.rentConditions) && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Condiciones del alquiler</h2>
                  <dl className="mt-2 sm:max-w-lg">
                    <Fact label="Precio" value={price} />
                    {l.depositMonths != null && <Fact label="Fianza" value={`${l.depositMonths} ${l.depositMonths === 1 ? "mes" : "meses"}`} />}
                    {l.minTermMonths != null && <Fact label="Duración mínima" value={`${l.minTermMonths} meses`} />}
                  </dl>
                  {l.rentConditions && <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-600">{l.rentConditions}</p>}
                </section>
              )}

              {l.extraInfo && (
                <section className="mt-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-ink-800">Información adicional</h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{l.extraInfo}</p>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold text-ink-800">¿Te interesa este amarre?</h2>
                <p className="mt-1 text-sm text-ink-500">Pide más información o concierta una visita.</p>
                <div className="mt-4">
                  <InquiryForm reference={l.reference} consentText={inquiryConsentText(advertiser, l.reference, l.category)} />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4 text-[13px] text-ink-500">
                <p className="flex items-center gap-2 font-medium text-ink-700">
                  <Building2 className="h-4 w-4" /> Anunciante: {advertiser ?? "FINCALIA360"}
                </p>
                <p className="mt-2 leading-snug">
                  Los datos los facilita el anunciante y se revisan antes de publicar. En la compra de un amarre normalmente se transmite el derecho de uso o la
                  concesión: comprueba su duración, las tasas del puerto y la documentación antes de firmar.
                </p>
                <p className="mt-2 text-ink-400">Actualizado el {l.updatedAt.toLocaleDateString("es-ES")}</p>
              </div>
            </aside>
          </div>
          <SimilarListings l={l} />
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
