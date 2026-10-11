/* eslint-disable @next/next/no-img-element -- las fotos ya se sirven optimizadas (WebP redimensionado) */
import Link from "next/link";
import { BedDouble, Bath, Ruler, MapPin, ImageOff, Anchor, Ship, ArrowRight } from "lucide-react";
import { formatMeters, listingPath, photoUrl } from "@/services/listings/catalog";
import es from "@/lib/i18n/portal/es";
import { catalogLabels, type CatalogLabels } from "@/lib/i18n/portal/labels";
import type { PortalDict } from "@/lib/i18n/portal/es";

export interface CardListing {
  slug: string;
  reference: string;
  status: string;
  operation: string;
  title: string;
  propertyType: string;
  price: number;
  municipality: string;
  zone: string | null;
  builtArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  photos: { key: string; width: number; height: number; alt: string | null }[];
  category?: string;
  portName?: string | null;
  berthLength?: number | null;
  berthWidth?: number | null;
  maxBoatLength?: number | null;
  mooringType?: string | null;
  rentPeriod?: string | null;
}

/** Precio con su periodicidad en el idioma de la página («1.400 €/mes», «1,400 €/month»…). */
export function localPrice(price: number, operation: string, rentPeriod: string | null | undefined, labels: CatalogLabels, locale: string) {
  const eur = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);
  return operation === "RENT" ? `${eur}/${labels.rentPeriods[rentPeriod ?? "MONTH"] ?? labels.rentPeriods.MONTH}` : eur;
}

export function ListingCard({
  l,
  t = es.card,
  labels = catalogLabels("es"),
  locale = "es-ES",
}: {
  l: CardListing;
  t?: PortalDict["card"];
  labels?: CatalogLabels;
  locale?: string;
}) {
  const photo = l.photos[0];
  const mooring = l.category === "MOORING";
  return (
    <Link
      href={listingPath(l)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
        {photo ? (
          <img src={photoUrl(photo.key, true)} alt={photo.alt ?? l.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-ink-800 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-sm">{l.operation === "RENT" ? t.rent : t.sale}</span>
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 shadow-sm">
            {mooring ? (l.mooringType ? `${t.mooring} · ${labels.mooringTypes[l.mooringType]}` : t.mooring) : (labels.types[l.propertyType] ?? l.propertyType)}
          </span>
        </span>
        {l.status === "RESERVED" && <span className="absolute right-3 top-3 rounded-full bg-terracotta-500 px-2.5 py-1 text-[11.5px] font-semibold text-white">{t.reserved}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[22px] font-semibold tracking-tight text-ink-800">{localPrice(l.price, l.operation, l.rentPeriod, labels, locale)}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.6em] text-[15px] font-medium leading-snug text-ink-700">{l.title}</h3>
        <p className="mt-1.5 flex items-center gap-1 truncate text-[13px] text-ink-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {(mooring ? [l.portName, l.municipality] : [l.zone, l.municipality]).filter(Boolean).join(", ")}
        </p>
        <div className="mt-auto flex min-h-[2rem] flex-wrap gap-x-4 gap-y-1 border-t border-sand-100 pt-3 text-[13px] text-ink-600">
          {mooring && l.berthLength != null && (
            <span className="inline-flex items-center gap-1">
              <Anchor className="h-3.5 w-3.5" /> {formatMeters(l.berthLength)}
              {l.berthWidth != null ? ` × ${formatMeters(l.berthWidth)}` : ""}
            </span>
          )}
          {mooring && l.maxBoatLength != null && (
            <span className="inline-flex items-center gap-1">
              <Ship className="h-3.5 w-3.5" /> {t.maxLength} {formatMeters(l.maxBoatLength)}
            </span>
          )}
          {!mooring && l.builtArea != null && (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> {l.builtArea} m²
            </span>
          )}
          {l.bedrooms != null && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {l.bedrooms} {t.rooms}
            </span>
          )}
          {l.bathrooms != null && (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" /> {l.bathrooms} {t.bath(l.bathrooms)}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-[13px]">
          <span className="text-[11.5px] text-ink-400">{t.ref} {l.reference}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-terracotta-700">
            {t.view} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
