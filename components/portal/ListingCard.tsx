/* eslint-disable @next/next/no-img-element -- las fotos ya se sirven optimizadas (WebP redimensionado) */
import Link from "next/link";
import { BedDouble, Bath, Ruler, MapPin, ImageOff } from "lucide-react";
import { PROPERTY_TYPES, formatPrice, listingPath, photoUrl, type PropertyTypeCode } from "@/services/listings/catalog";

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
}

export function ListingCard({ l }: { l: CardListing }) {
  const photo = l.photos[0];
  return (
    <Link href={listingPath(l)} className="group flex flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
        {photo ? (
          <img src={photoUrl(photo.key, true)} alt={photo.alt ?? l.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 shadow-sm">
          {PROPERTY_TYPES[l.propertyType as PropertyTypeCode] ?? l.propertyType}
        </span>
        {l.status === "RESERVED" && <span className="absolute right-3 top-3 rounded-full bg-terracotta-500 px-2.5 py-1 text-[11.5px] font-semibold text-white">Reservado</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[22px] font-semibold tracking-tight text-ink-800">{formatPrice(l.price, l.operation)}</p>
        <h3 className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug text-ink-700">{l.title}</h3>
        <p className="mt-1.5 flex items-center gap-1 text-[13px] text-ink-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {[l.zone, l.municipality].filter(Boolean).join(", ")}
        </p>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-sand-100 pt-3 text-[13px] text-ink-500">
          {l.builtArea != null && (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> {l.builtArea} m²
            </span>
          )}
          {l.bedrooms != null && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {l.bedrooms} hab.
            </span>
          )}
          {l.bathrooms != null && (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" /> {l.bathrooms} {l.bathrooms === 1 ? "baño" : "baños"}
            </span>
          )}
          <span className="ml-auto text-[11.5px] text-ink-300">{l.reference}</span>
        </div>
      </div>
    </Link>
  );
}
