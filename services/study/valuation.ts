// Valoración (función pura). Nunca inventa datos: cada estimación indica fuente, fecha,
// método, nivel de confianza y limitaciones. Orden de prioridad:
//   VENTA:    1) valor aportado por el propietario (tasación, valor de referencia catastral, oferta)
//             2) referencia de mercado cargada por el equipo con su fuente (MarketReference)
//             3) €/m² de las compraventas REGISTRADAS del municipio (Cataluña: Generalitat · Registradores)
//             4) valor tasado medio del municipio (Ministerio de Vivienda; municipios > 25.000 hab.)
//             5) módulo de valor medio del Catastro de la zona (referencia secundaria)
//             6) comparables autorizados, precio de compra × IPV, valor tasado provincial
//             7) datos de EJEMPLO (solo si STUDY_EXAMPLE_DATA=true; nunca en producción)
//   ALQUILER: 1) SERPAVI (rentas declaradas, MIVAU), actualizado con el IPVA del INE si existe
//             2) referencia de mercado cargada por el equipo
//             3) datos de EJEMPLO
//   La renta actual del propietario se muestra aparte (es un dato real de SU contrato).
import { serpaviTypology, type AnnexLine, type CatastroValueZone, type Confidence, type Estimate, type Series, type SourceRef, type StudyInput } from "./types";
import type { SerpaviMeta, SerpaviMunicipality } from "./sources/serpavi";
import type { NewContractRent } from "./sources/incasol";
import type { ValorTasadoResult } from "./sources/valorTasado";
import type { RegisteredSalePrice } from "./sources/gencatCompravendes";
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
  /** Valor tasado medio (€/m²) del Ministerio de Vivienda para el municipio o la provincia. */
  valorTasado?: ValorTasadoResult | null;
  /** Cataluña: €/m² de las compraventas registradas del municipio (últimos 12 meses). */
  registeredSale?: RegisteredSalePrice | null;
  /** Renta media de contratos nuevos del municipio (Cataluña, Incasòl). */
  newContractRent?: NewContractRent | null;
  /** Zona del mapa de valores del Catastro (módulo de valor medio de vivienda y garaje). */
  valueZone?: CatastroValueZone | null;
  today?: Date;
}

const RANGE_BY_CONFIDENCE: Record<Confidence, number> = { HIGH: 0.05, MEDIUM: 0.08, LOW: 0.12, VERY_LOW: 0.2, NONE: 0 };

function round(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Plazas de garaje indicadas (en estudios antiguos: 1 si se marcó «parking»). */
export function parkingSpaces(input: StudyInput) {
  return input.property.parkingSpaces ?? (input.property.parking ? 1 : 0);
}

/** Ajustes por características (hipótesis del modelo, visibles para el usuario). */
export function characteristicAdjustments(input: StudyInput, operation: "sale" | "rent", opts: { parkingValuedApart?: boolean } = {}) {
  const p = input.property;
  const adj: Array<{ label: string; pct: number }> = [];
  if (p.condition === "NEW") adj.push({ label: "Nueva o reformada", pct: 5 });
  if (p.condition === "TO_REFORM") adj.push({ label: "Necesita reforma", pct: -10 });
  if (p.outdoor === "TERRACE" || p.outdoor === "GARDEN") adj.push({ label: p.outdoor === "GARDEN" ? "Jardín" : "Terraza", pct: 3 });
  if (parkingSpaces(input) > 0 && !(operation === "sale" && opts.parkingValuedApart)) adj.push({ label: "Plaza de aparcamiento", pct: operation === "sale" ? 3 : 2 });
  if (p.pool === "PRIVATE") adj.push({ label: "Piscina privada", pct: serpaviTypology(p.kind) === "VU" ? 5 : 3 });
  if (p.pool === "COMMUNITY") adj.push({ label: "Piscina comunitaria", pct: 2 });
  if (p.elevator === false && (p.floor ?? 0) >= 3) adj.push({ label: "Sin ascensor (3.ª planta o superior)", pct: -5 });
  return adj;
}

/** Trastero sin valor aportado: 25 % del €/m² de la vivienda (hipótesis visible y modificable). */
export const STORAGE_SHARE_OF_DWELLING_M2 = 0.25;

/**
 * Anexos valorados aparte: garaje (valor del propietario o módulo oficial del Catastro), trastero
 * (valor del propietario o hipótesis visible) y amarre (solo con valor aportado: no hay fuente
 * oficial pública de precios de amarres). value = null → falta el dato y no se suma.
 */
export function estimateAnnexes(input: StudyInput, ctx: ValuationContext, dwellingPerM2: number | null): AnnexLine[] {
  const p = input.property;
  const lines: AnnexLine[] = [];
  const spaces = parkingSpaces(input);
  if (spaces > 0) {
    const label = spaces === 1 ? "Plaza de garaje" : `${spaces} plazas de garaje`;
    const garage = ctx.valueZone?.garage;
    if (p.parkingValue) {
      lines.push({ kind: "PARKING", label, value: p.parkingValue, origin: "OWNER", method: "Valor indicado por el propietario." });
    } else if (garage && ctx.valueZone) {
      lines.push({
        kind: "PARKING",
        label,
        value: Math.round((garage.value * spaces) / 500) * 500,
        origin: "OFFICIAL",
        method: `Módulo de valor medio del garaje de la zona (${garage.typology}${garage.sqm ? `, ${garage.sqm} m²` : ""}): ${garage.value.toLocaleString("es-ES")} € por plaza × ${spaces}.`,
        source: ctx.valueZone.source,
      });
    }
  }
  if (p.storage || p.storageSqm || p.storageValue) {
    const label = p.storageSqm ? `Trastero de ${p.storageSqm} m²` : "Trastero";
    if (p.storageValue) {
      lines.push({ kind: "STORAGE", label, value: p.storageValue, origin: "OWNER", method: "Valor indicado por el propietario." });
    } else if (p.storageSqm && dwellingPerM2) {
      lines.push({
        kind: "STORAGE",
        label,
        value: Math.round((p.storageSqm * dwellingPerM2 * STORAGE_SHARE_OF_DWELLING_M2) / 100) * 100,
        origin: "ASSUMPTION",
        method: `Hipótesis: ${p.storageSqm} m² × ${Math.round(dwellingPerM2).toLocaleString("es-ES")} €/m² de la vivienda × ${STORAGE_SHARE_OF_DWELLING_M2 * 100} % (no hay dato oficial de trasteros; indica su valor si lo conoces).`,
      });
    } else {
      lines.push({ kind: "STORAGE", label, value: null, origin: "ASSUMPTION", method: "Sin valorar: indica sus metros o su valor para incluirlo." });
    }
  }
  if (p.mooringLengthM || p.mooringValue) {
    const label = p.mooringLengthM ? `Amarre de ${p.mooringLengthM.toLocaleString("es-ES")} m de eslora` : "Amarre";
    lines.push(
      p.mooringValue
        ? { kind: "MOORING", label, value: p.mooringValue, origin: "OWNER", method: "Valor indicado por el propietario (derecho de uso o concesión del amarre)." }
        : {
            kind: "MOORING",
            label,
            value: null,
            origin: "ASSUMPTION",
            method: "Sin valorar: no hay una fuente oficial pública de precios de amarres. Indica su valor (precio del derecho de uso, ofertas o tasación) y lo incluimos.",
          },
    );
  }
  return lines;
}

/** Suma los anexos valorados a la estimación (salvo al valor aportado por el propietario, que se supone completo). */
function withAnnexes(est: Estimate, input: StudyInput, ctx: ValuationContext): Estimate {
  const lines = estimateAnnexes(input, ctx, est.perM2);
  if (!lines.length) return est;
  if (est.origin === "OWNER") {
    return { ...est, annexes: lines, limitations: [...est.limitations, "Los anexos no se suman al valor que has indicado: suponemos que ya los incluye. Si no es así, súmalos en el simulador."] };
  }
  const total = lines.reduce((sum, l) => sum + (l.value ?? 0), 0);
  return { ...est, dwellingValue: est.value, value: est.value + total, low: est.low + total, high: est.high + total, annexes: lines };
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
  // Si el garaje se valora aparte (valor del propietario o módulo de garaje del Catastro), no se aplica además el % de ajuste
  const annexParkingValued = parkingSpaces(input) > 0 && Boolean(input.property.parkingValue || ctx.valueZone?.garage);
  const saleAdjustments = () => characteristicAdjustments(input, "sale", { parkingValuedApart: annexParkingValued });

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
    const adjustments = saleAdjustments();
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

  // Valor tasado medio oficial (€/m²) del municipio o, si no se publica, de la provincia
  const valorTasadoEstimate = (vt: ValorTasadoResult) => {
    const adjustments = saleAdjustments();
    const municipal = vt.scope === "MUNICIPIO";
    const basisLabel = vt.basis === "HASTA_5" ? "viviendas de hasta 5 años" : vt.basis === "MAS_5" ? "viviendas de más de 5 años" : "todas las antigüedades";
    return makeEstimate({
      value: applyAdjustments(vt.value * sqm, adjustments),
      sqm,
      confidence: municipal ? "LOW" : "VERY_LOW",
      origin: "MODEL",
      method: `Valor tasado medio ${municipal ? `de ${vt.name}` : `de la provincia de ${vt.name}`} (${vt.quarter.replace("-", " ")}, ${basisLabel}): ${vt.value.toLocaleString("es-ES")} €/m² × ${sqm} m²${adjustments.length ? ", con ajustes por características" : ""}.`,
      source: {
        name: vt.meta.source,
        url: municipal ? vt.meta.sourceUrlMunicipios : vt.meta.sourceUrlProvincias,
        period: vt.quarter,
        retrievedAt: vt.meta.importedAt,
        status: "OK",
        note: [vt.appraisals ? `${vt.appraisals.toLocaleString("es-ES")} tasaciones en el trimestre` : null, vt.yearOnYearPct != null ? `variación interanual ${vt.yearOnYearPct.toLocaleString("es-ES")} %` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
      },
      adjustments,
      limitations: [
        "Es la media de las tasaciones hipotecarias del " + (municipal ? "municipio" : "conjunto de la provincia") + ", no una tasación de esta vivienda: no recoge la calle, las vistas, las calidades ni el estado real.",
        ...(municipal ? [] : ["El Ministerio solo publica datos por municipio para los de más de 25.000 habitantes: se usa la media provincial, que puede diferir mucho del precio de tu localidad."]),
        "Para una cifra fiable, indica el precio y año de compra, una tasación o el valor de referencia del Catastro, o solicita una valoración profesional.",
      ],
      step: 1000,
    });
  };

  // 3) Cataluña: €/m² de las compraventas REGISTRADAS del municipio (precios de cierre, últimos 12 meses)
  if (ctx.registeredSale) {
    const rs = ctx.registeredSale;
    const adjustments = saleAdjustments();
    out.push(
      makeEstimate({
        value: applyAdjustments(rs.value * sqm, adjustments),
        sqm,
        confidence: rs.sales >= 100 ? "MEDIUM" : "LOW",
        origin: "OFFICIAL",
        method: `Precio medio de las compraventas ${rs.basis === "USADO" ? "de vivienda usada " : ""}registradas en ${rs.municipality} (${rs.period}, ${rs.sales.toLocaleString("es-ES")} operaciones): ${rs.value.toLocaleString("es-ES")} €/m² construido × ${sqm} m²${adjustments.length ? ", con ajustes por características" : ""}.`,
        source: { name: rs.meta.source, url: rs.meta.sourceUrl, period: rs.period, retrievedAt: rs.meta.importedAt, status: "OK", note: rs.meta.notes },
        adjustments,
        limitations: [
          "Son precios de compraventas reales inscritas en el Registro de la Propiedad (precios de cierre, no de anuncio), pero es la media de todo el municipio: no recoge la calle, las vistas, las calidades ni el estado concretos.",
          "La media mezcla pisos y casas de todos los tamaños; una tasación profesional o comparables de la misma zona afinan la cifra.",
        ],
        step: 1000,
      }),
    );
  }

  // 4) Valor tasado medio del municipio (resto de España; en Cataluña, como contraste)
  if (ctx.valorTasado?.scope === "MUNICIPIO") out.push(valorTasadoEstimate(ctx.valorTasado));

  // 5) Mapa de valores del Catastro: módulo de valor medio de la zona (referencia secundaria)
  const zone = ctx.valueZone;
  if (zone?.residential) {
    const r = zone.residential;
    const adjustments = saleAdjustments();
    const unifamiliar = /unifamiliar/i.test(r.typology);
    const matches = unifamiliar === (serpaviTypology(input.property.kind) === "VU");
    const product = [
      r.typology,
      r.sqm ? `${r.sqm} m²` : null,
      r.category ? `calidad ${r.category.toLowerCase()}` : null,
      r.ageYears != null ? `${r.ageYears} años` : null,
      r.conservation ? `conservación ${r.conservation.toLowerCase()}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    out.push(
      makeEstimate({
        value: applyAdjustments(r.mvmM2 * sqm, adjustments),
        sqm,
        confidence: matches ? "MEDIUM" : "LOW",
        origin: "OFFICIAL",
        method: `Módulo de valor medio del Catastro para la zona ${zone.zone} (${zone.year}): ${r.mvmM2.toLocaleString("es-ES")} €/m² × ${sqm} m²${adjustments.length ? ", con ajustes por características" : ""}.`,
        source: { ...zone.source, note: `${zone.source.note ?? ""} Vivienda representativa de la zona: ${product}${r.dwellings ? ` (${r.dwellings.toLocaleString("es-ES")} viviendas en la zona)` : ""}.`.trim() },
        adjustments,
        limitations: [
          "Es el valor medio de las compraventas reales de la zona para una vivienda representativa, no una tasación de esta vivienda: no recoge las vistas, la orientación, las calidades ni el estado concretos.",
          ...(matches ? [] : [`La vivienda representativa de la zona es «${r.typology}» y la tuya es de otro tipo: la cifra es orientativa.`]),
          "Son precios de compraventa escriturados (cerrados), no precios de anuncio: los anuncios suelen ser más altos que el precio final.",
        ],
        step: 1000,
      }),
    );
  }

  // 6) Comparables de venta de un proveedor autorizado: precios de ANUNCIO (no de cierre)
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

  // 7) Precio de compra actualizado con el IPV (INE) de la comunidad autónoma
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

  // 8) Valor tasado medio de la provincia (municipios sin dato propio)
  if (ctx.valorTasado && ctx.valorTasado.scope !== "MUNICIPIO") out.push(valorTasadoEstimate(ctx.valorTasado));

  // 9) EJEMPLO (desarrollo/demostración)
  if (ctx.exampleData) {
    const adjustments = saleAdjustments();
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
  return out.map((est) => withAnnexes(est, input, ctx));
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

  // Contratos nuevos registrados (Cataluña · Incasòl): renta real firmada, no de anuncio.
  // La media es por contrato (sin superficie): se adapta a esta vivienda con el perfil €/m² de SERPAVI.
  const nc = ctx.newContractRent;
  if (nc) {
    const adjustments = characteristicAdjustments(input, "rent");
    const latest = ctx.serpavi ? latestSerpaviYear(ctx.serpavi.municipality, typology) : null;
    const reliable = nc.contracts >= 30;
    const source = { name: nc.source.name, url: nc.source.url, period: nc.period, retrievedAt: nc.source.retrievedAt, status: "OK" as const, note: `${nc.contracts.toLocaleString("es-ES")} contratos nuevos en el trimestre; renta media ${nc.monthlyRent.toLocaleString("es-ES")} €/mes` };
    if (latest) {
      const d = latest.data;
      // La renta media del Incasòl es de TODOS los contratos del municipio (pisos y casas): se divide por la
      // superficie media de todo el parque alquilado según SERPAVI (ponderada por nº de viviendas de cada tipo),
      // no por la de un solo tipo. El margen P25–P75 se toma del perfil del tipo de esta vivienda.
      const yearData = ctx.serpavi!.municipality.years[latest.year] ?? {};
      const groups = [yearData.VC, yearData.VU].filter((g): g is NonNullable<typeof g> => Boolean(g && g.n > 0 && g.sup > 0));
      const totalN = groups.reduce((s, g) => s + g.n, 0);
      const avgSup = totalN ? groups.reduce((s, g) => s + g.sup * g.n, 0) / totalN : d.sup;
      const perM2 = nc.monthlyRent / avgSup;
      out.push(
        makeEstimate({
          value: applyAdjustments(perM2 * sqm, adjustments),
          low: applyAdjustments(perM2 * (d.p25 / d.m) * sqm, adjustments),
          high: applyAdjustments(perM2 * (d.p75 / d.m) * sqm, adjustments),
          sqm,
          confidence: reliable ? "LOW" : "VERY_LOW",
          origin: "MODEL",
          method: `Renta media de los contratos nuevos de ${nc.municipality} (${nc.period.replace("-", " ")}): ${nc.monthlyRent.toLocaleString("es-ES")} €/mes ÷ ${avgSup.toFixed(0)} m² de superficie media de las viviendas alquiladas del municipio (SERPAVI ${latest.year}, pisos y casas) = ${perM2.toFixed(2)} €/m²; × ${sqm} m².`,
          source,
          adjustments,
          limitations: [
            "Renta media real de los contratos firmados en el municipio (fianzas del Incasòl), no precios de anuncio; no distingue barrios ni calidades.",
            "El dato oficial es la renta media por contrato: la adaptación a la superficie de tu vivienda es una estimación del modelo.",
            "No es la renta máxima legal: en zona tensionada el límite depende del contrato anterior y del tipo de propietario.",
          ],
          step: 10,
        }),
      );
    } else {
      out.push(
        makeEstimate({
          value: nc.monthlyRent,
          sqm,
          confidence: "VERY_LOW",
          origin: "MODEL",
          method: `Renta media de los contratos nuevos de ${nc.municipality} (${nc.period.replace("-", " ")}), sin ajustar a la superficie (no hay perfil SERPAVI del municipio).`,
          source,
          limitations: ["Media de todos los contratos del municipio: no tiene en cuenta la superficie ni las características de tu vivienda."],
          step: 10,
        }),
      );
    }
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
