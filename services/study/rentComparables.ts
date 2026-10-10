// Comparables de alquiler registrados por el equipo (anuncios consultados a mano con enlace y fecha).
// Son PRECIOS ANUNCIADOS (oferta), no rentas de contratos firmados. Se usan solo para el apartado
// «Rango de alquiler» del informe: NO cambian la renta que utiliza el simulador.
import { z } from "zod";
import { prisma } from "@/db/client";
import { PROPERTY_KINDS, serpaviTypology, type PropertyKind, type StudyInput } from "./types";

export const MAX_AGE_MONTHS = 12;
export const MIN_FOR_RANGE = 3;

export interface ComparableRow {
  id: string;
  municipalityName: string;
  zone: string | null;
  propertyKind: string | null;
  monthlyRent: number;
  builtArea: number | null;
  usefulArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean | null;
  features: string | null;
  sourceName: string;
  url: string | null;
  observedAt: Date;
}

export interface ComparableSummary {
  rows: Array<ComparableRow & { perM2: number | null; differences: string[] }>;
  used: number;
  perM2: { p25: number; p50: number; p75: number } | null;
  monthly: { conservative: number; market: number; high: number } | null;
  latest: Date | null;
  confidence: "MEDIUM" | "LOW" | "VERY_LOW" | "NONE";
  note: string;
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Diferencias visibles entre el comparable y la vivienda del estudio (no se convierten en % inventados). */
function differences(c: ComparableRow, input: StudyInput) {
  const p = input.property;
  const out: string[] = [];
  if (c.builtArea) {
    const d = Math.round(((c.builtArea - p.sqm) / p.sqm) * 100);
    if (Math.abs(d) >= 10) out.push(`${d > 0 ? "+" : ""}${d} % de superficie`);
  }
  if (c.bedrooms != null && c.bedrooms !== p.bedrooms) out.push(`${c.bedrooms} hab. (la tuya ${p.bedrooms})`);
  if (c.bathrooms != null && c.bathrooms !== p.bathrooms) out.push(`${c.bathrooms} baños (la tuya ${p.bathrooms})`);
  if (c.furnished === true) out.push("amueblado");
  if (c.propertyKind && c.propertyKind !== p.kind) out.push("otro tipo de vivienda");
  return out;
}

/**
 * Resumen de comparables para una vivienda: mismos municipio, tipo (colectiva/unifamiliar) y tamaño
 * parecido (±35 %), consultados en los últimos 12 meses. Rango = P25 / mediana / P75 del €/m² × superficie.
 * Sin al menos 3 comparables válidos no se da rango (se muestran igualmente los registrados).
 */
export function summarizeComparables(all: ComparableRow[], input: StudyInput, today = new Date()): ComparableSummary {
  const limit = new Date(today);
  limit.setMonth(limit.getMonth() - MAX_AGE_MONTHS);
  const group = serpaviTypology(input.property.kind);
  const sqm = input.property.sqm;
  const valid = all
    .filter((c) => c.observedAt >= limit)
    .filter((c) => !c.propertyKind || !(PROPERTY_KINDS as readonly string[]).includes(c.propertyKind) || serpaviTypology(c.propertyKind as PropertyKind) === group)
    .filter((c) => !c.builtArea || (c.builtArea >= sqm * 0.65 && c.builtArea <= sqm * 1.35))
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  const rows = valid.map((c) => ({ ...c, perM2: c.builtArea ? c.monthlyRent / c.builtArea : null, differences: differences(c, input) }));
  const perM2s = rows.map((r) => r.perM2).filter((v): v is number => v != null).sort((a, b) => a - b);
  const latest = rows[0]?.observedAt ?? null;
  if (perM2s.length < MIN_FOR_RANGE) {
    return {
      rows,
      used: perM2s.length,
      perM2: null,
      monthly: null,
      latest,
      confidence: "NONE",
      note: rows.length
        ? `Hay ${rows.length} comparable(s) registrado(s), pero se necesitan al menos ${MIN_FOR_RANGE} con superficie para dar un rango.`
        : "No hay comparables registrados para esta zona y tipo de vivienda en los últimos 12 meses.",
    };
  }
  const q = { p25: quantile(perM2s, 0.25), p50: quantile(perM2s, 0.5), p75: quantile(perM2s, 0.75) };
  const round10 = (v: number) => Math.round(v / 10) * 10;
  return {
    rows,
    used: perM2s.length,
    perM2: q,
    monthly: { conservative: round10(q.p25 * sqm), market: round10(q.p50 * sqm), high: round10(q.p75 * sqm) },
    latest,
    confidence: perM2s.length >= 8 ? "MEDIUM" : perM2s.length >= 5 ? "LOW" : "VERY_LOW",
    note: `Rango con ${perM2s.length} anuncios comparables: percentiles 25, 50 y 75 del €/m² anunciado × ${sqm} m² construidos. Son precios de anuncio, no rentas firmadas.`,
  };
}

/** Comparables registrados del municipio (por código INE o, si falta, por nombre y provincia). */
export async function loadComparablesFor(input: StudyInput): Promise<ComparableRow[]> {
  const loc = input.location;
  const or = [
    ...(loc.municipalityCode ? [{ municipalityCode: loc.municipalityCode }] : []),
    { provinceCode: loc.provinceCode, municipalityName: loc.municipalityName },
  ];
  return prisma.rentComparable.findMany({ where: { OR: or }, orderBy: { observedAt: "desc" }, take: 200 });
}

// --------------------------------------------------------------------- Alta desde el panel
const optInt = (max: number) => z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(max).nullable());

export const comparableSchema = z.object({
  provinceCode: z.string().regex(/^\d{2}$/, "Elige la provincia"),
  municipalityName: z.string().trim().min(2, "Indica el municipio").max(80),
  municipalityCode: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{5}$/, "Código INE de 5 cifras").nullable().optional()),
  zone: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(80).nullable().optional()),
  propertyKind: z.preprocess((v) => (v === "" ? null : v), z.enum(PROPERTY_KINDS).nullable().optional()),
  monthlyRent: z.coerce.number({ invalid_type_error: "Renta no válida" }).int("Sin decimales").min(50, "Renta demasiado baja").max(100_000),
  builtArea: optInt(5000),
  usefulArea: optInt(5000),
  bedrooms: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(20).nullable()),
  bathrooms: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(15).nullable()),
  furnished: z.preprocess((v) => (v === "" || v == null ? null : v === "true" || v === true), z.boolean().nullable()),
  features: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(300).nullable().optional()),
  sourceName: z.string().trim().min(2, "Indica la fuente (portal o inmobiliaria)").max(80),
  url: z.preprocess((v) => (v === "" ? null : v), z.string().trim().url("Enlace no válido").max(500).nullable().optional()),
  observedAt: z.coerce.date({ invalid_type_error: "Fecha de consulta no válida" }).refine((d) => d <= new Date(Date.now() + 86400_000), "La fecha no puede ser futura"),
  notes: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(500).nullable().optional()),
});
