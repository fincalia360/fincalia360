// Hipótesis por defecto del simulador. Todas son modificables y se muestran etiquetadas.
// Si el propietario aportó un importe, se usa su dato (origen OWNER) en lugar de la hipótesis.
// Un dato desconocido se representa con null (nunca con 0).
import { DEFAULT_RISK_ASSUMPTIONS } from "./risk";
import {
  NEW_CONTRACT_CONDITIONS,
  RENT_CHOICES,
  SALE_CHOICES,
  type AssumptionMeta,
  type StudyAssumptions,
  type StudyInput,
} from "./types";

export const DEFAULT_ASSUMPTIONS = {
  appreciationPct: 2,
  rentGrowthPct: 2,
  costInflationPct: 2,
  vacancyMonths: 1,
  managementPct: 0,
  maintenancePctRent: 5,
  opportunityRatePct: 3,
  agencyFeePct: 3,
  vatPct: 21,
  notaryAndOtherSaleCosts: 900,
  mortgageCancellationCosts: 600,
  earlyRepaymentFeePct: 0.25,
  plusvaliaRatePct: 30,
  marginalRatePct: 30,
  otherCostsYear: 0,
  extraordinaryCosts: 0,
  ...DEFAULT_RISK_ASSUMPTIONS,
};

const COLLECTIVE = ["PISO", "ATICO", "DUPLEX", "ESTUDIO"];

/** Datos oficiales del estudio que sustituyen a una hipótesis genérica (se calculan en el servidor). */
export interface AssumptionHints {
  plusvalia?: { ratePct: number; year: number; sourceName: string } | null;
}

export function hintsFromSnapshot(snapshot: { plusvaliaMunicipal?: { ratePct: number; year: number; source: { name: string } } | null } | null | undefined): AssumptionHints {
  const p = snapshot?.plusvaliaMunicipal;
  return p ? { plusvalia: { ratePct: p.ratePct, year: p.year, sourceName: p.source.name } } : {};
}

export function buildDefaultAssumptions(input: StudyInput, hints: AssumptionHints = {}) {
  const e = input.economics;
  const values: StudyAssumptions = {
    ...DEFAULT_ASSUMPTIONS,
    plusvaliaRatePct: hints.plusvalia?.ratePct ?? DEFAULT_ASSUMPTIONS.plusvaliaRatePct,
    saleChoice: "AUTO",
    saleValue: null,
    rentChoice: "AUTO",
    monthlyRent: null,
    newContractCondition: "GENERAL",
    marginalRatePct: input.owner.marginalRate ?? DEFAULT_ASSUMPTIONS.marginalRatePct,
    communityFeesYear: e.communityFeesYear ?? (COLLECTIVE.includes(input.property.kind) ? 1200 : 0),
    ibiYear: e.ibiYear ?? (e.cadastralValueTotal ? Math.round(e.cadastralValueTotal * 0.006) : null),
    insuranceYear: e.insuranceYear ?? 300,
    otherCostsYear: e.otherCostsYear ?? 0,
  };
  return { values, meta: assumptionMeta(input, hints) };
}

export function assumptionMeta(input: StudyInput, hints: AssumptionHints = {}): Record<keyof StudyAssumptions, AssumptionMeta> {
  const e = input.economics;
  const h = (label: string, note?: string): AssumptionMeta => ({ label, origin: "ASSUMPTION", note });
  return {
    saleChoice: h("Origen del valor de venta"),
    saleValue: h("Valor de venta introducido manualmente"),
    rentChoice: h("Renta utilizada en la simulación"),
    monthlyRent: h("Renta mensual introducida manualmente"),
    newContractCondition: h("Condiciones del nuevo contrato (reducción IRPF)"),
    appreciationPct: h("Revalorización anual de la vivienda", "No está garantizada: prueba también 0 % o valores negativos."),
    rentGrowthPct: h("Subida anual del alquiler", "La actualización de contratos vigentes está limitada por ley."),
    costInflationPct: h("Subida anual de gastos fijos"),
    vacancyMonths: h("Meses sin inquilino al año"),
    managementPct: h("Gestión del alquiler (% de la renta)", "0 % si lo gestionas tú."),
    maintenancePctRent: e.maintenanceYear != null ? { label: "Mantenimiento (importe aportado, no se usa el %)", origin: "OWNER" } : h("Mantenimiento y reparaciones (% de la renta)"),
    opportunityRatePct: h("Rentabilidad neta alternativa del dinero", "Lo que rendiría el dinero de la venta invertido en otra cosa. Se aplica igual a los flujos del alquiler."),
    agencyFeePct: h("Honorarios de agencia en la venta (sin IVA)", "0 % si vendes sin intermediario."),
    vatPct: { label: "IVA sobre honorarios", origin: "OFFICIAL", note: "Tipo general del IVA (21 %)." },
    notaryAndOtherSaleCosts: h("Notaría, gestoría, certificado energético y cédula (vendedor)"),
    mortgageCancellationCosts: h("Cancelación registral de la hipoteca"),
    earlyRepaymentFeePct: h("Comisión por amortización anticipada", "Revisa tu escritura (límites de la Ley 5/2019)."),
    plusvaliaRatePct: hints.plusvalia
      ? {
          label: "Tipo de la plusvalía municipal",
          origin: "OFFICIAL",
          note: `Tipo de tu ayuntamiento según ${hints.plusvalia.sourceName}: es el último dato publicado por Hacienda y puede haber cambiado; confírmalo en su ordenanza fiscal.`,
        }
      : h("Tipo de la plusvalía municipal", "Sin dato oficial de tu ayuntamiento: se usa el 30 %, el máximo legal; puede aplicar menos o no cobrarla."),
    marginalRatePct: input.owner.marginalRate != null ? { label: "Tu tipo marginal del IRPF", origin: "OWNER" } : h("Tu tipo marginal del IRPF"),
    communityFeesYear: e.communityFeesYear != null ? { label: "Comunidad (€/año)", origin: "OWNER" } : h("Comunidad (€/año)", "Estimación: sustitúyela por tu importe real."),
    ibiYear:
      e.ibiYear != null
        ? { label: "IBI (€/año)", origin: "OWNER" }
        : e.cadastralValueTotal
          ? h("IBI (€/año)", "Estimado como 0,6 % del valor catastral: sustitúyelo por tu recibo.")
          : h("IBI (€/año)", "Desconocido: no se incluye en los gastos hasta que lo indiques."),
    insuranceYear: e.insuranceYear != null ? { label: "Seguro (€/año)", origin: "OWNER" } : h("Seguro (€/año)"),
    otherCostsYear: e.otherCostsYear != null ? { label: "Otros gastos (€/año)", origin: "OWNER" } : h("Otros gastos (€/año)"),
    extraordinaryCosts: h("Gastos extraordinarios en el periodo (derramas, reformas)"),
    riskLegalArrears: h("Costes jurídicos · impago sin juicio"),
    riskLegalEviction: h("Costes jurídicos · desahucio por impago"),
    riskLegalRecovery: h("Costes jurídicos · recuperación por otras causas"),
    riskLegalSquatting: h("Costes jurídicos · ocupación sin título"),
    riskRepairsArrears: h("Reparaciones · impago sin juicio"),
    riskRepairsEviction: h("Reparaciones · desahucio"),
    riskRepairsRecovery: h("Reparaciones · recuperación"),
    riskRepairsSquatting: h("Reparaciones · ocupación"),
    riskReletMonths: h("Meses hasta volver a alquilar tras la incidencia"),
    riskDepositMonths: h("Fianza y garantías aplicables (meses de renta)"),
  };
}

/**
 * Normaliza hipótesis guardadas (incluidos estudios antiguos): completa campos nuevos con
 * los valores por defecto y descarta los valores de venta/renta «0» heredados del motor anterior.
 */
export function normalizeAssumptions(raw: Record<string, unknown> | null | undefined, input: StudyInput): StudyAssumptions {
  const defaults = buildDefaultAssumptions(input).values;
  const r = raw ?? {};
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const v = r[key];
    if (v === undefined) continue;
    out[key] = v;
  }
  // Estudios anteriores: no tenían elección explícita; el 0 significaba «desconocido».
  if (!(SALE_CHOICES as readonly string[]).includes(String(r.saleChoice))) {
    out.saleChoice = "AUTO";
    out.saleValue = null;
  }
  if (!(RENT_CHOICES as readonly string[]).includes(String(r.rentChoice))) {
    out.rentChoice = "AUTO";
    out.monthlyRent = null;
  }
  if (!(NEW_CONTRACT_CONDITIONS as readonly string[]).includes(String(out.newContractCondition))) out.newContractCondition = "GENERAL";
  if (out.saleValue === 0) out.saleValue = null;
  if (out.monthlyRent === 0 && out.rentChoice !== "MANUAL") out.monthlyRent = null;
  return out as unknown as StudyAssumptions;
}
