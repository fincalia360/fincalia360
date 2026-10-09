// Valoración (función pura). Nunca inventa datos: cada estimación indica fuente, fecha,
// método, nivel de confianza y limitaciones. Orden de prioridad:
//   VENTA:    1) valor aportado por el propietario (tasación, valor de referencia catastral, oferta)
//             2) referencia de mercado cargada por el equipo con su fuente (MarketReference)
//             3) precio de compra actualizado con el IPV del INE (comunidad autónoma)
//             4) datos de EJEMPLO (solo si STUDY_EXAMPLE_DATA=true; nunca en producción)
//   ALQUILER: 1) SERPAVI (rentas declaradas, MIVAU), actualizado con el IPVA del INE si existe
//             2) referencia de mercado cargada por el equipo
//             3) datos de EJEMPLO
//   La renta actual del propietario se muestra aparte (es un dato real de SU contrato).
import { serpaviTypology, type Confidence, type Estimate, type Series, type SourceRef, type StudyInput } from "./types";
import type { SerpaviMeta, SerpaviMunicipality } from "./sources/serpavi";
import { latestSerpaviYear } from "./sources/serpavi";
import type { ComparableListing } from "./sources/idealista";

export interface MarketRef {
  kind: "SALE_M2" | "RENT_M2";
  dataType: "OFFICIAL" | "CLOSED_TRANSACTIONS" | "ASKING_PRICES" | "APPRAISAL";
  value: number;
  low: number | null;
  high: number | null;
  period: string;
  sourceName: string;
  sourceUrl: string | null;
  notes: string | null;
  createdAt: Date | string;
}

export interface ValuationContext {
  serpavi: { municipality: SerpaviMunicipality; meta: SerpaviMeta } | null;
  rentIndex: Series | null; // IPVA municipal
  priceIndexCcaa: Series | null; // IPV CCAA
  marketRefs: MarketRef[];
  exampleData: { saleM2: number; rentM2: number } | null;
  /** Comparables de un proveedor autorizado (precios de anuncio). Vacío si no está configurado. */
  saleComparables?: ComparableListing[];
  rentComparables?: ComparableListing[];
  comparablesSource?: string;
  today?: Date;
}

const RANGE_BY_CONFIDENCE: Record<Confidence, number> = { HIGH: 0.05, MEDIUM: 0.08, LOW: 0.12, VERY_LOW: 0.2, NONE: 0 };

function round(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Ajustes por características (hipótesis del modelo, visibles para el usuario). */
export function characteristicAdjustments(input: StudyInput, operation: "sale" | "rent") {
  const p = input.property;
  const adj: Array<{ label: string; pct: number }> = [];
  if (p.condition === "NEW") adj.push({ label: "Nueva o reformada", pct: 5 });
  if (p.condition === "TO_REFORM") adj.push({ label: "Necesita reforma", pct: -10 });
  if (p.outdoor === "TERRACE" || p.outdoor === "GARDEN") adj.push({ label: p.outdoor === "GARDEN" ? "Jardín" : "Terraza", pct: 3 });
  if (p.parking) adj.push({ label: "Plaza de aparcamiento", pct: operation === "sale" ? 3 : 2 });
  if (p.elevator === false && (p.floor ?? 0) >= 3) adj.push({ label: "Sin ascensor (3.ª planta o superior)", pct: -5 });
  return adj;
}

function applyAdjustments(value: number, adj: Array<{ pct: number }>) {
  return adj.reduce((v, a) => v * (1 + a.pct / 100), value);
}

function seriesValue(series: Series | null, period: string) {
  return series?.points.find((p) => p.period === period)?.value ?? null;
}

function lastPoint(series: Series | null) {
  return series?.points[series.points.length - 1] ?? null;
}

function makeEstimate(params: {
  value: number;
  sqm: number;
  confidence: Confidence;
  origin: Estimate["origin"];
  method: string;
  source: SourceRef;
  adjustments?: Estimate["adjustments"];
  limitations: string[];
  low?: number;
  high?: number;
  step: number;
}): Estimate {
  const spread = RANGE_BY_CONFIDENCE[params.confidence];
  return {
    value: round(params.value, params.step),
    low: round(params.low ?? params.value * (1 - spread), params.step),
    high: round(params.high ?? params.value * (1 + spread), params.step),
    perM2: Math.round((params.value / params.sqm) * 100) / 100,
    origin: params.origin,
    method: params.method,
    confidence: params.confidence,
    source: params.source,
    adjustments: params.adjustments ?? [],
    limitations: params.limitations,
  };
}

export function estimateSale(input: StudyInput, ctx: ValuationContext): Estimate[] {
  const sqm = input.property.sqm;
  const out: Estimate[] = [];
  const e = input.economics;

  // 1) Valor aportado por el propietario
  if (e.ownerValuation) {
    const kind = e.ownerValuation.kind;
    out.push(
      makeEstimate({
        value: e.ownerValuation.value,
        sqm,
        confidence: kind === "APPRAISAL" ? "HIGH" : "MEDIUM",
        origin: "OWNER",
        method:
          kind === "APPRAISAL"
            ? "Tasación aportada por el propietario."
            : kind === "CADASTRAL_REFERENCE_VALUE"
              ? "Valor de referencia del Catastro aportado por el propietario."
              : "Oferta firme recibida por el propietario.",
        source: { name: "Dato aportado por el propietario", status: "OK" },
        limitations: [
          kind === "CADASTRAL_REFERENCE_VALUE"
            ? "El valor de referencia catastral es un valor administrativo; puede diferir del precio de mercado."
            : "No verificado por nuestro equipo.",
        ],
        step: 1000,
      }),
    );
  }

  // 2) Referencias de mercado cargadas por el equipo (con fuente)
  const saleRef = ctx.marketRefs.filter((r) => r.kind === "SALE_M2").sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  if (saleRef) {
    const adjustments = characteristicAdjustments(input, "sale");
    const asking = saleRef.dataType === "ASKING_PRICES";
    out.push(
      makeEstimate({
        value: applyAdjustments(saleRef.value * sqm, adjustments),
        low: saleRef.low ? applyAdjustments(saleRef.low * sqm, adjustments) : undefined,
        high: saleRef.high ? applyAdjustments(saleRef.high * sqm, adjustments) : undefined,
        sqm,
        confidence: asking ? "LOW" : "MEDIUM",
        origin: saleRef.dataType === "OFFICIAL" || saleRef.dataType === "CLOSED_TRANSACTIONS" ? "OFFICIAL" : asking ? "MARKET_OBSERVED" : "MODEL",
        method: `€/m² de referencia del municipio (${saleRef.period}) × ${sqm} m², con ajustes por características.`,
        source: { name: saleRef.sourceName, url: saleRef.sourceUrl ?? undefined, period: saleRef.period, status: "OK", note: saleRef.notes ?? undefined },
        adjustments,
        limitations: [
          asking
            ? "Son precios de ANUNCIO (oferta), no precios de compraventa cerrados: suelen ser superiores al precio final."
            : "Referencia media del municipio: no recoge la ubicación exacta, vistas, calidades ni el estado real.",
        ],
        step: 1000,
      }),
    );
  }

  // 2b) Comparables de venta de un proveedor autorizado: precios de ANUNCIO (no de cierre)
  const saleComps = (ctx.saleComparables ?? []).filter((c) => c.sqm >= sqm * 0.7 && c.sqm <= sqm * 1.3);
  if (saleComps.length >= 5) {
    const perM2 = saleComps.map((c) => c.pricePerM2).sort((x, y) => x - y);
    const q = (p: number) => perM2[Math.min(perM2.length - 1, Math.floor(p * (perM2.length - 1)))];
    out.push(
      makeEstimate({
        value: q(0.5) * sqm,
        low: q(0.25) * sqm,
        high: q(0.75) * sqm,
        sqm,
        confidence: "LOW",
        origin: "MARKET_OBSERVED",
        method: `Mediana de ${saleComps.length} anuncios comparables (±30 % de superficie), P25–P75.`,
        source: { name: ctx.comparablesSource ?? "Proveedor de comparables", status: "OK", retrievedAt: saleComps[0].observedAt },
        limitations: ["Son precios de ANUNCIO, no de compraventa cerrada: el precio final suele ser inferior."],
        step: 1000,
      }),
    );
  }

  // 3) Precio de compra actualizado con el IPV (INE) de la comunidad autónoma
  if (e.purchasePrice && e.purchaseYear && ctx.priceIndexCcaa) {
    const base = seriesValue(ctx.priceIndexCcaa, String(e.purchaseYear));
    const last = lastPoint(ctx.priceIndexCcaa);
    if (base && last) {
      const improvements = e.improvementsCost ?? 0;
      const value = e.purchasePrice * (last.value / base) + improvements;
      out.push(
        makeEstimate({
          value,
          sqm,
          confidence: "LOW",
          origin: "MODEL",
          method: `Precio de compra (${e.purchaseYear}) × IPV ${last.period}/${e.purchaseYear} de la comunidad autónoma (${(last.value / base).toFixed(3)})${improvements ? " + reformas declaradas" : ""}.`,
          source: { ...ctx.priceIndexCcaa.source, period: `${e.purchaseYear}–${last.period}` },
          limitations: [
            "El IPV es un índice de la comunidad autónoma, no del municipio ni de la vivienda concreta.",
            "Supone que la vivienda ha evolucionado como la media; no recoge mejoras o deterioros no declarados.",
          ],
          step: 1000,
        }),
      );
    }
  }

  // 4) EJEMPLO (desarrollo/demostración)
  if (ctx.exampleData) {
    const adjustments = characteristicAdjustments(input, "sale");
    out.push(
      makeEstimate({
        value: applyAdjustments(ctx.exampleData.saleM2 * sqm, adjustments),
        sqm,
        confidence: "VERY_LOW",
        origin: "EXAMPLE",
        method: "€/m² de EJEMPLO para demostración × superficie, con ajustes por características.",
        source: { name: "Datos de EJEMPLO (no reales)", status: "NOT_CONFIGURED", note: "Desactivar con STUDY_EXAMPLE_DATA=false en producción." },
        adjustments,
        limitations: ["Valor de EJEMPLO para demostrar la herramienta: no es un dato de mercado y no debe usarse para decidir."],
        step: 1000,
      }),
    );
  }
  return out;
}

/**
 * Alquiler: separa la REFERENCIA ESTADÍSTICA (SERPAVI, contratos vigentes declarados, sin ajustes)
 * de las ESTIMACIONES DE MERCADO (fuentes de mercado autorizadas o referencias del equipo).
 * Ninguna de las dos es la renta legalmente aplicable: eso lo determina rentRegime.ts.
 */
export function estimateRent(input: StudyInput, ctx: ValuationContext): { statistical: Estimate | null; market: Estimate[] } {
  const sqm = input.property.sqm;
  const out: Estimate[] = [];
  let statistical: Estimate | null = null;
  const typology = serpaviTypology(input.property.kind);

  if (ctx.serpavi) {
    const latest = latestSerpaviYear(ctx.serpavi.municipality, typology);
    if (latest) {
      // Actualización con IPVA del INE (si el municipio tiene índice y hay años posteriores)
      const idxBase = seriesValue(ctx.rentIndex, latest.year);
      const idxLast = lastPoint(ctx.rentIndex);
      const factor = idxBase && idxLast && idxLast.period > latest.year ? idxLast.value / idxBase : 1;
      // La actualización IPVA ya va en `factor`: se muestra en la lista pero no se vuelve a aplicar.
      const shown = factor !== 1 ? [{ label: `Actualización IPVA ${latest.year}→${idxLast!.period}`, pct: Math.round((factor - 1) * 1000) / 10 }] : [];
      const d = latest.data;
      const limitations = [
        "Referencia estadística: rentas declaradas en el IRPF de contratos vigentes (no precios de anuncio ni la renta de un contrato nuevo).",
        "No es la renta máxima legal: en zona tensionada el límite depende del contrato anterior y del tipo de arrendador.",
        "Dato medio del municipio: no distingue calles, vistas ni calidades.",
        `Superficie mediana de las viviendas comparadas: ${d.sup} m². Las viviendas pequeñas suelen tener €/m² más alto.`,
      ];
      if (d.n < 30) limitations.push(`Muestra reducida (${d.n} viviendas): el dato es menos representativo.`);
      if (typology === "VU" && ["VILLA", "CASA_INDEPENDIENTE"].includes(input.property.kind))
        limitations.push("La categoría «unifamiliar» mezcla casas rurales y adosados: una villa puede alquilarse muy por encima.");
      statistical = makeEstimate({
          value: d.m * factor * sqm,
          low: d.p25 * factor * sqm,
          high: d.p75 * factor * sqm,
          sqm,
          confidence: d.n >= 30 ? "MEDIUM" : "LOW",
          origin: "OFFICIAL",
          method: `Referencia estadística: mediana SERPAVI ${latest.year} (${typology === "VC" ? "vivienda colectiva" : "vivienda unifamiliar"}) ${d.m.toFixed(2)} €/m²/mes × ${sqm} m²; intervalo P25–P75${factor !== 1 ? "; actualizada con el IPVA del INE" : ""}.`,
          source: {
            name: ctx.serpavi.meta.source,
            url: ctx.serpavi.meta.sourceUrl,
            period: latest.year,
            retrievedAt: ctx.serpavi.meta.importedAt,
            status: "OK",
            note: `${d.n} viviendas con alquiler declarado`,
          },
          adjustments: shown,
          limitations,
          step: 10,
        });
    }
  }

  const rentRef = ctx.marketRefs.filter((r) => r.kind === "RENT_M2").sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  if (rentRef) {
    const adjustments = characteristicAdjustments(input, "rent");
    const asking = rentRef.dataType === "ASKING_PRICES";
    out.push(
      makeEstimate({
        value: applyAdjustments(rentRef.value * sqm, adjustments),
        low: rentRef.low ? applyAdjustments(rentRef.low * sqm, adjustments) : undefined,
        high: rentRef.high ? applyAdjustments(rentRef.high * sqm, adjustments) : undefined,
        sqm,
        confidence: "LOW",
        origin: asking ? "MARKET_OBSERVED" : "OFFICIAL",
        method: `€/m² de referencia (${rentRef.period}) × ${sqm} m².`,
        source: { name: rentRef.sourceName, url: rentRef.sourceUrl ?? undefined, period: rentRef.period, status: "OK", note: rentRef.notes ?? undefined },
        adjustments,
        limitations: [asking ? "Precios de anuncio, no rentas firmadas." : "Referencia media del municipio."],
        step: 10,
      }),
    );
  }

  // Comparables de mercado (proveedor autorizado, p. ej. Idealista): precios de ANUNCIO
  const rentComps = (ctx.rentComparables ?? []).filter((c) => c.sqm >= sqm * 0.7 && c.sqm <= sqm * 1.3);
  if (rentComps.length >= 5) {
    const perM2 = rentComps.map((c) => c.pricePerM2).sort((x, y) => x - y);
    const q = (p: number) => perM2[Math.min(perM2.length - 1, Math.floor(p * (perM2.length - 1)))];
    out.push(
      makeEstimate({
        value: q(0.5) * sqm,
        low: q(0.25) * sqm,
        high: q(0.75) * sqm,
        sqm,
        confidence: "LOW",
        origin: "MARKET_OBSERVED",
        method: `Mediana de ${rentComps.length} anuncios de alquiler comparables (±30 % de superficie).`,
        source: { name: ctx.comparablesSource ?? "Proveedor de comparables", status: "OK", retrievedAt: rentComps[0].observedAt },
        limitations: ["Precios de anuncio: no son rentas firmadas."],
        step: 10,
      }),
    );
  }

  if (ctx.exampleData) {
    out.push(
      makeEstimate({
        value: ctx.exampleData.rentM2 * sqm,
        sqm,
        confidence: "VERY_LOW",
        origin: "EXAMPLE",
        method: "€/m² de EJEMPLO para demostración × superficie.",
        source: { name: "Datos de EJEMPLO (no reales)", status: "NOT_CONFIGURED" },
        limitations: ["Valor de EJEMPLO: no es un dato de mercado."],
        step: 10,
      }),
    );
  }
  return { statistical, market: out };
}

/** Rentabilidad bruta anual = renta anual / valor de venta. */
export function grossYield(monthlyRent: number, saleValue: number) {
  return saleValue > 0 ? (monthlyRent * 12) / saleValue : null;
}
