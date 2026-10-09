// Modelo del informe (función pura). La web y el PDF usan EXACTAMENTE este resultado,
// de modo que las cifras del resumen y del PDF coinciden.
import { normalizeAssumptions } from "./assumptions";
import { fmtEur, fmtPct } from "./format";
import { determineRentRegime, type RentRegime } from "./rentRegime";
import { RISK_MONTHS, RISK_TYPES, riskScenario, type RiskResult, type RiskType } from "./risk";
import { resolveMortgage, sensitivity, simulate, type ScenarioResult, type SensitivityItem, type SimContext } from "./simulator";
import { determineRentalReduction, type RentalReduction } from "./taxes";
import { HORIZONS, type Estimate, type StudyAssumptions, type StudyInput, type StudySnapshot } from "./types";

export const RENT_SOURCE_LABELS = {
  OWNER_CURRENT: "Renta de tu contrato vigente",
  MARKET: "Estimación de alquiler de mercado",
  STATISTICAL: "Referencia estadística SERPAVI (aproximación)",
  LEGAL_CAP: "Renta máxima legal aplicable",
  MANUAL: "Renta introducida manualmente",
  NONE: "Sin renta utilizable",
} as const;
export type RentSource = keyof typeof RENT_SOURCE_LABELS;

export interface StudyReport {
  assumptions: StudyAssumptions;
  horizon: number;
  sale: {
    estimate: Estimate | null;
    alternatives: Estimate[];
    used: number | null;
    usedSource: "ESTIMATE" | "MANUAL" | "NONE";
    reliable: boolean;
    message: string;
    needed: string[];
  };
  rent: {
    statistical: Estimate | null;
    market: Estimate | null;
    ownerCurrent: number | null;
    regime: RentRegime;
    requested: number | null; // renta antes de aplicar el tope legal
    used: number | null;
    usedSource: RentSource;
    capped: boolean;
    notes: string[];
  };
  reduction: RentalReduction;
  ctx: SimContext;
  byHorizon: Record<number, ScenarioResult>;
  main: ScenarioResult;
  sensitivity: SensitivityItem[];
  risk: { monthlyRent: number | null; fixedCostsYear: number; monthlyMortgageInterest: number; rows: Array<{ type: RiskType; results: RiskResult[] }> } | null;
  conclusive: boolean;
  blockers: string[];
  headline: string;
  points: string[];
  uncertainties: string[];
  /** Avisos de la captura de datos aún aplicables (p. ej. sin «no se puede valorar» si hay valor manual). */
  snapshotWarnings: string[];
}

function legacyRent(snapshot: StudySnapshot) {
  const statistical = snapshot.rentStatistical !== undefined ? snapshot.rentStatistical : snapshot.rent?.origin === "OFFICIAL" ? snapshot.rent : null;
  const market =
    snapshot.rentMarket !== undefined
      ? snapshot.rentMarket
      : ([snapshot.rent, ...(snapshot.rentAlternatives ?? [])].find((e) => e && e.origin !== "OFFICIAL") ?? null);
  return { statistical, market };
}


export function buildStudyReport(input: StudyInput, snapshot: StudySnapshot, rawAssumptions: unknown, horizon?: number): StudyReport {
  const a = normalizeAssumptions(rawAssumptions as Record<string, unknown>, input);
  const h = horizon ?? input.owner.horizon;
  const owner = input.owner as StudyInput["owner"] & Partial<Pick<StudyInput["owner"], "landlordBracket" | "rentedLast5Years" | "previousRent" | "rentalContractStart">>;

  // ---------------- Valor de venta ----------------
  const estimate = snapshot.sale;
  let used: number | null = null;
  let usedSource: StudyReport["sale"]["usedSource"] = "NONE";
  if (a.saleChoice === "MANUAL" && a.saleValue != null && a.saleValue > 0) {
    used = a.saleValue;
    usedSource = "MANUAL";
  } else if (estimate) {
    used = estimate.value;
    usedSource = "ESTIMATE";
  }
  const reliable = usedSource === "MANUAL" || (estimate != null && estimate.origin !== "EXAMPLE" && estimate.confidence !== "VERY_LOW" && estimate.confidence !== "NONE");
  const needed = snapshot.saleStatus?.needed ?? ["Tasación reciente", "Valor de referencia del Catastro", "Precio y año de compra"];
  const saleMessage =
    usedSource === "NONE"
      ? "No es posible valorar el inmueble con fiabilidad con los datos disponibles. Indica una tasación, el valor de referencia catastral o el precio y año de compra."
      : usedSource === "MANUAL"
        ? "Valor de venta introducido por el propietario."
        : estimate!.origin === "EXAMPLE"
          ? "Valor de EJEMPLO (modo demostración): no permite conclusiones."
          : `Estimación a partir de ${estimate!.source.name}${estimate!.source.period ? ` (${estimate!.source.period})` : ""}. No es una tasación de la vivienda.`;

  // ---------------- Alquiler ----------------
  const { statistical, market } = legacyRent(snapshot);
  const currentlyRented = input.property.currentUse === "RENTED";
  const ownerCurrent = currentlyRented ? (snapshot.ownerCurrentRent ?? input.owner.currentRent ?? null) : null;
  const regime = determineRentRegime({
    tensioned: snapshot.tensioned,
    currentlyRented,
    currentRent: ownerCurrent,
    landlordBracket: owner.landlordBracket ?? "UNDISCLOSED",
    rentedLast5Years: currentlyRented ? "YES" : (owner.rentedLast5Years ?? "UNKNOWN"),
    previousRent: currentlyRented ? ownerCurrent : (owner.previousRent ?? null),
  });
  const rentNotes: string[] = [];
  let requested: number | null = null;
  let rentSource: RentSource = "NONE";
  const pick = (choice: StudyAssumptions["rentChoice"]): [number | null, RentSource] => {
    switch (choice) {
      case "OWNER_CURRENT":
        return [ownerCurrent, ownerCurrent != null ? "OWNER_CURRENT" : "NONE"];
      case "MARKET":
        return [market?.value ?? null, market ? "MARKET" : "NONE"];
      case "STATISTICAL":
        return [statistical?.value ?? null, statistical ? "STATISTICAL" : "NONE"];
      case "LEGAL_CAP":
        return [regime.capMonthly, regime.capMonthly != null ? "LEGAL_CAP" : "NONE"];
      case "MANUAL":
        return [a.monthlyRent, a.monthlyRent != null && a.monthlyRent > 0 ? "MANUAL" : "NONE"];
      default:
        if (ownerCurrent != null) return [ownerCurrent, "OWNER_CURRENT"];
        if (market) return [market.value, "MARKET"];
        if (statistical) return [statistical.value, "STATISTICAL"];
        return [null, "NONE"];
    }
  };
  [requested, rentSource] = pick(a.rentChoice);
  if (rentSource === "STATISTICAL")
    rentNotes.push("Se usa la referencia estadística SERPAVI como aproximación: refleja contratos vigentes, no la renta de un contrato nuevo ni el límite legal.");
  if (market?.origin === "EXAMPLE" && rentSource === "MARKET") rentNotes.push("La estimación de mercado es un dato de EJEMPLO (modo demostración).");
  let usedRent = requested;
  let capped = false;
  if (usedRent != null && regime.capMonthly != null && regime.status !== "EXISTING_CONTRACT" && usedRent > regime.capMonthly) {
    rentNotes.push(
      `La renta elegida (${fmtEur(usedRent)}/mes) supera la renta máxima aplicable: se usa ${regime.status === "CAP_REFERENCE_INDEX" ? "el límite superior conocido" : "el tope legal"} de ${fmtEur(regime.capMonthly)}/mes.`,
    );
    usedRent = regime.capMonthly;
    capped = true;
  }
  if (regime.status === "UNKNOWN" || regime.status === "CAP_REFERENCE_INDEX")
    rentNotes.push("No se ha podido determinar la renta máxima legal: la renta utilizada podría no ser aplicable en un contrato nuevo.");

  // ---------------- Reducción IRPF ----------------
  const reduction = determineRentalReduction({
    residence: input.owner.taxResidence,
    ccaaCode: input.location.ccaaCode,
    currentlyRented,
    contractStart: owner.rentalContractStart ?? null,
    newContractCondition: a.newContractCondition,
    tensionedStatus: snapshot.tensioned.status,
    rentedLast5Years: currentlyRented ? "YES" : (owner.rentedLast5Years ?? "UNKNOWN"),
  });

  // ---------------- Simulaciones ----------------
  const ctx: SimContext = { saleValue: used, monthlyRent: usedRent, rentalReductionPct: reduction.pct };
  const byHorizon: Record<number, ScenarioResult> = {};
  for (const hz of HORIZONS) byHorizon[hz] = simulate(input, a, hz, ctx);
  const main = byHorizon[h] ?? simulate(input, a, h, ctx);
  const sens = sensitivity(input, a, h, ctx);

  // ---------------- Riesgos ----------------
  const mortgage = resolveMortgage(input);
  const fixedCostsYear = (a.communityFeesYear ?? 0) + (a.ibiYear ?? 0) + (a.insuranceYear ?? 0) + a.otherCostsYear;
  const monthlyMortgageInterest = mortgage ? (mortgage.balance * mortgage.annualRatePct) / 100 / 12 : 0;
  const risk =
    usedRent != null
      ? {
          monthlyRent: usedRent,
          fixedCostsYear,
          monthlyMortgageInterest,
          rows: RISK_TYPES.map((type) => ({
            type,
            results: RISK_MONTHS.map((months) =>
              riskScenario({ type, months, monthlyRent: usedRent!, fixedCostsYear, monthlyMortgageInterest, opportunityRatePct: a.opportunityRatePct, assumptions: a }),
            ),
          })),
        }
      : null;

  // ---------------- Conclusiones ----------------
  const blockers: string[] = [];
  if (used == null) blockers.push("no hay una valoración de venta fiable");
  else if (!reliable)
    blockers.push(
      estimate?.origin === "EXAMPLE"
        ? "la valoración de venta es un dato de ejemplo"
        : "la valoración de venta es solo orientativa (media de la provincia, sin dato del municipio ni de la vivienda)",
    );
  if (usedRent == null) blockers.push("no hay una renta utilizable");
  if (main.sellNow?.breakdown.gainTax.status === "NOT_COMPUTABLE") blockers.push("no se puede calcular el impuesto de la venta (falta el precio de compra)");
  const conclusive = blockers.length === 0;

  const points: string[] = [];
  if (snapshot.tensioned.status === "DECLARED" || snapshot.tensioned.status === "PARTIAL") points.push("Zona de mercado residencial tensionado: la renta de un nuevo contrato puede estar limitada (ver régimen legal).");
  if (["ARREARS", "LITIGATION", "POSSESSION_RECOVERY"].includes(input.owner.tenancyIssue)) points.push("Conviene resolver o valorar jurídicamente la incidencia con el arrendamiento actual antes de decidir.");
  if (input.owner.goal === "INCOME") points.push("Tu objetivo son ingresos periódicos: compara el flujo de caja anual del alquiler con lo que rendiría el dinero de la venta.");

  let headline: string;
  if (!conclusive) {
    headline = `No es posible concluir qué opción es mejor: ${blockers.join("; ")}.`;
    points.push("Completa los datos indicados o solicita una valoración profesional para obtener una comparación fiable.");
  } else {
    const A = main.sellNow!.wealth;
    const B = main.rentThenSell!.wealth;
    const gap = B - A;
    const rel = Math.abs(gap) / Math.max(1, Math.abs(A));
    const years = `${h} ${h === 1 ? "año" : "años"}`;
    headline =
      rel < 0.05
        ? `A ${years}, vender y alquilar dan un patrimonio muy parecido (diferencia de ${fmtEur(Math.abs(gap))}, menos del 5 %). La decisión depende más de tus preferencias de liquidez, gestión y riesgo.`
        : `Con estas hipótesis, a ${years} ${gap > 0 ? "alquilar y vender al final" : "vender ahora"} deja unos ${fmtEur(Math.abs(gap))} más de patrimonio. El resultado cambia si cambian las hipótesis.`;
    const top = sens.filter((s) => s.available && (s.impact ?? 0) >= 1).slice(0, 2);
    if (top.length) points.push(`Variables que más influyen: ${top.map((s) => s.label.toLowerCase()).join(" y ")}.`);
    if (main.yields.netAfterTax != null && main.yields.netAfterTax * 100 < a.opportunityRatePct)
      points.push(`La rentabilidad neta del alquiler tras impuestos (${fmtPct(main.yields.netAfterTax)} anual sobre el valor de venta) es inferior a la rentabilidad alternativa supuesta (${fmtPct(a.opportunityRatePct / 100)}).`);
  }
  if (main.incomplete.length) points.push("Hay cálculos incompletos: revisa la lista de incertidumbres.");
  points.push("Una valoración profesional presencial puede afinar el precio de venta y la renta aplicable.");

  const uncertainties = [
    ...blockers.map((b) => `Bloqueante: ${b}.`),
    ...sens.filter((s) => s.available && (s.impact ?? 0) >= 1).slice(0, 3).map((s) => `${s.label}: mueve la diferencia B − A en hasta ${fmtEur(s.impact!)}.`),
    ...(regime.status === "UNKNOWN" || regime.status === "CAP_REFERENCE_INDEX" ? [`Renta legal: ${regime.summary}`] : []),
    ...(reduction.status === "UNKNOWN" ? [`Reducción IRPF del alquiler: ${reduction.basis}`] : []),
    ...main.incomplete.filter((i) => !i.startsWith("Valor de venta") && !i.startsWith("Renta mensual")),
    ...rentNotes.filter((n) => n.startsWith("Se usa la referencia")),
  ];

  return {
    assumptions: a,
    horizon: h,
    sale: { estimate, alternatives: snapshot.saleAlternatives ?? [], used, usedSource, reliable, message: saleMessage, needed: usedSource === "NONE" ? needed : [] },
    rent: { statistical, market, ownerCurrent, regime, requested, used: usedRent, usedSource: rentSource, capped, notes: rentNotes },
    reduction,
    ctx,
    byHorizon,
    main,
    sensitivity: sens,
    risk,
    conclusive,
    blockers,
    headline,
    points,
    uncertainties: [...new Set(uncertainties)],
    snapshotWarnings: snapshot.warnings.filter((w) => !(used != null && w.startsWith("No es posible valorar"))),
  };
}
