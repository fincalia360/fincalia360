// Coincidencias entre una solicitud «Busco piso» y los inmuebles publicados de FINCALIA360.
// Solo LEE los anuncios (nunca crea ni modifica nada) y no contacta con nadie.
// Reglas transparentes:
//  - Obligatorias (si no se cumplen, el inmueble no aparece): misma operación, misma provincia,
//    una de las poblaciones pedidas, precio dentro del presupuesto máximo y tipo de inmueble igual o parecido.
//  - Preferencias (dan el porcentaje): tipo exacto, precio mínimo, habitaciones, baños, superficie,
//    terraza, ascensor, parking, exterior y estado. Si el anuncio no tiene el dato, se indica «no consta»
//    y cuenta como medio punto: nunca se da por supuesto.
import { prisma } from "@/db/client";
import { CONDITIONS, PROPERTY_TYPES, formatPrice, listingPath } from "@/services/listings/catalog";
import { publicVisibility } from "@/services/listings/listings";
import {
  LISTING_TYPES_FOR,
  PREFERENCE_FEATURES,
  RELATED_LISTING_TYPES,
  SEARCH_CONDITIONS,
  SEARCH_TYPES,
  normalizeMunicipality,
  splitMunicipalities,
  type SearchType,
} from "./catalog";

export interface MatchRequest {
  operation: string;
  propertyType: string;
  provinceCode: string;
  municipalities: string;
  minPrice: number | null;
  maxPrice: number;
  minBedrooms: number | null;
  minBathrooms: number | null;
  minArea: number | null;
  maxArea: number | null;
  terrace: string;
  elevator: string;
  parking: string;
  exterior: string;
  condition: string;
}

export interface MatchListing {
  id: string;
  reference: string;
  slug: string;
  category: string;
  title: string;
  operation: string;
  propertyType: string;
  provinceCode: string;
  municipality: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  builtArea: number | null;
  usefulArea: number | null;
  condition: string | null;
  features: string;
}

export type CheckResult = "ok" | "no" | "unknown";
export interface Check {
  label: string;
  result: CheckResult;
  detail: string;
}

export interface MatchResult {
  listing: MatchListing;
  url: string;
  /** Porcentaje de las preferencias cumplidas (lo que no consta cuenta como medio punto). */
  score: number;
  /** Todas las preferencias indicadas se cumplen y constan en el anuncio. */
  full: boolean;
  checks: Check[];
}

const eur = (n: number, op: string) => formatPrice(n, op);

/** Reglas obligatorias. Devuelve el motivo de exclusión o null si el inmueble puede encajar. */
export function exclusionReason(req: MatchRequest, l: MatchListing): string | null {
  if (l.category !== "HOME") return "No es una vivienda o inmueble (amarre)";
  if (l.operation !== req.operation) return req.operation === "SALE" ? "Es un alquiler y se busca compra" : "Es una venta y se busca alquiler";
  if (l.provinceCode !== req.provinceCode) return "Otra provincia";
  const wanted = splitMunicipalities(req.municipalities).map(normalizeMunicipality);
  if (!wanted.includes(normalizeMunicipality(l.municipality))) return "Otra población";
  if (l.price > req.maxPrice) return "Supera el presupuesto máximo";
  const type = req.propertyType as SearchType;
  const exact = LISTING_TYPES_FOR[type] ?? [];
  const related = RELATED_LISTING_TYPES[type] ?? [];
  if (exact.length && !exact.includes(l.propertyType) && !related.includes(l.propertyType)) return "Otro tipo de inmueble";
  return null;
}

/** Preferencias, con el motivo de cada una. */
export function preferenceChecks(req: MatchRequest, l: MatchListing): Check[] {
  const checks: Check[] = [];
  const type = req.propertyType as SearchType;
  const listingType = PROPERTY_TYPES[l.propertyType as keyof typeof PROPERTY_TYPES] ?? l.propertyType;

  // Obligatorias que se cumplen (se muestran como motivos)
  checks.push({ label: "Operación", result: "ok", detail: req.operation === "RENT" ? "Alquiler" : "Compra" });
  checks.push({ label: "Ubicación", result: "ok", detail: l.municipality });
  checks.push({ label: "Precio", result: "ok", detail: `${eur(l.price, l.operation)} (máximo ${eur(req.maxPrice, req.operation)})` });

  const exact = LISTING_TYPES_FOR[type] ?? [];
  if (exact.length) {
    if (exact.includes(l.propertyType)) {
      checks.push({
        label: "Tipo",
        result: "ok",
        detail: type === "ADOSADA" ? `${listingType} (el anuncio no indica si es adosada)` : listingType,
      });
    } else {
      checks.push({ label: "Tipo", result: "no", detail: `${listingType} (se busca ${SEARCH_TYPES[type].toLowerCase()})` });
    }
  }

  if (req.minPrice != null) {
    checks.push(
      l.price >= req.minPrice
        ? { label: "Precio mínimo", result: "ok", detail: `Desde ${eur(req.minPrice, req.operation)}` }
        : { label: "Precio mínimo", result: "no", detail: `Por debajo del mínimo indicado (${eur(req.minPrice, req.operation)})` },
    );
  }

  const atLeast = (label: string, wanted: number | null, value: number | null, unit: string) => {
    if (wanted == null) return;
    if (value == null) checks.push({ label, result: "unknown", detail: "No consta en el anuncio" });
    else checks.push({ label, result: value >= wanted ? "ok" : "no", detail: `${value}${unit} (mínimo ${wanted}${unit})` });
  };
  atLeast("Habitaciones", req.minBedrooms, l.bedrooms, "");
  atLeast("Baños", req.minBathrooms, l.bathrooms, "");

  if (req.minArea != null || req.maxArea != null) {
    const area = l.builtArea ?? l.usefulArea;
    const range = [req.minArea != null ? `mín. ${req.minArea} m²` : null, req.maxArea != null ? `máx. ${req.maxArea} m²` : null].filter(Boolean).join(", ");
    if (area == null) checks.push({ label: "Superficie", result: "unknown", detail: "No consta en el anuncio" });
    else {
      const ok = (req.minArea == null || area >= req.minArea) && (req.maxArea == null || area <= req.maxArea);
      checks.push({ label: "Superficie", result: ok ? "ok" : "no", detail: `${area} m² (${range})` });
    }
  }

  const features = new Set(l.features.split(",").filter(Boolean));
  const prefLabels = { terrace: "Terraza", elevator: "Ascensor", parking: "Parking", exterior: "Exterior" } as const;
  for (const key of Object.keys(PREFERENCE_FEATURES) as Array<keyof typeof PREFERENCE_FEATURES>) {
    const wanted = req[key];
    if (wanted !== "YES" && wanted !== "NO") continue;
    const has = features.has(PREFERENCE_FEATURES[key]);
    if (wanted === "YES") {
      checks.push(has ? { label: prefLabels[key], result: "ok", detail: "Sí" } : { label: prefLabels[key], result: "unknown", detail: "No consta en el anuncio" });
    } else {
      checks.push(has ? { label: prefLabels[key], result: "no", detail: "El anuncio lo tiene y se busca sin" } : { label: prefLabels[key], result: "unknown", detail: "No consta en el anuncio" });
    }
  }

  if (req.condition !== "ANY") {
    const wanted = SEARCH_CONDITIONS[req.condition as keyof typeof SEARCH_CONDITIONS];
    if (!l.condition) checks.push({ label: "Estado", result: "unknown", detail: "No consta en el anuncio" });
    else {
      const actual = CONDITIONS[l.condition as keyof typeof CONDITIONS] ?? l.condition;
      checks.push({ label: "Estado", result: l.condition === req.condition ? "ok" : "no", detail: `${actual} (se busca ${wanted.toLowerCase()})` });
    }
  }
  return checks;
}

const MANDATORY = new Set(["Operación", "Ubicación", "Precio"]);

export function evaluateMatch(req: MatchRequest, l: MatchListing): MatchResult | null {
  if (exclusionReason(req, l)) return null;
  const checks = preferenceChecks(req, l);
  const prefs = checks.filter((c) => !MANDATORY.has(c.label));
  const points = prefs.reduce((s, c) => s + (c.result === "ok" ? 1 : c.result === "unknown" ? 0.5 : 0), 0);
  const score = prefs.length ? Math.round((points / prefs.length) * 100) : 100;
  return { listing: l, url: listingPath(l), score, full: prefs.every((c) => c.result === "ok"), checks };
}

/** Inmuebles publicados que encajan con la solicitud, del más adecuado al menos (empate: más barato). */
export async function findMatches(req: MatchRequest): Promise<MatchResult[]> {
  const candidates = await prisma.listing.findMany({
    where: { ...publicVisibility("HOME"), operation: req.operation, provinceCode: req.provinceCode, price: { lte: req.maxPrice } },
    select: {
      id: true,
      reference: true,
      slug: true,
      category: true,
      title: true,
      operation: true,
      propertyType: true,
      provinceCode: true,
      municipality: true,
      price: true,
      bedrooms: true,
      bathrooms: true,
      builtArea: true,
      usefulArea: true,
      condition: true,
      features: true,
    },
    take: 2000,
  });
  return candidates
    .map((l) => evaluateMatch(req, l))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => Number(b.full) - Number(a.full) || b.score - a.score || a.listing.price - b.listing.price);
}
