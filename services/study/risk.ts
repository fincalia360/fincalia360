// Escenarios adversos del alquiler (funciones puras). Son ILUSTRATIVOS:
// - No se asignan probabilidades ni plazos judiciales (no hay datos fiables por zona y perfil):
//   la duración (3, 6 o 12 meses) es un supuesto elegido por el usuario.
// - Costes jurídicos, reparaciones y meses hasta volver a alquilar son HIPÓTESIS MANUALES
//   modificables (se guardan en las hipótesis del estudio y se reflejan igual en el PDF).
// - Se distinguen supuestos jurídicamente distintos que no deben confundirse.
import type { StudyAssumptions } from "./types";

export const RISK_TYPES = ["ARREARS", "EVICTION_ARREARS", "RECOVERY_OTHER", "SQUATTING"] as const;
export type RiskType = (typeof RISK_TYPES)[number];
export const RISK_MONTHS = [3, 6, 12] as const;

export const RISK_INFO: Record<RiskType, { title: string; short: string; description: string; legal: string }> = {
  ARREARS: {
    title: "Impago del alquiler (sin procedimiento judicial)",
    short: "Impago sin juicio",
    description: "El inquilino deja de pagar durante un tiempo y la situación se resuelve por acuerdo, pago de la deuda o entrega voluntaria de la vivienda.",
    legal: "La fianza legal (una mensualidad en vivienda, art. 36 LAU) y las garantías adicionales pactadas pueden cubrir parte de la deuda.",
  },
  EVICTION_ARREARS: {
    title: "Desahucio por falta de pago",
    short: "Desahucio por impago",
    description: "Procedimiento judicial (juicio verbal de desahucio) para recuperar la vivienda y reclamar las rentas debidas.",
    legal: "La duración depende del juzgado, de la oposición del inquilino y, en su caso, de la valoración de vulnerabilidad. Suele requerir abogado y procurador.",
  },
  RECOVERY_OTHER: {
    title: "Recuperación de la posesión por otras causas",
    short: "Recuperación (otras causas)",
    description: "Fin del contrato, necesidad del arrendador u otras causas legales, cuando el inquilino no entrega la vivienda voluntariamente.",
    legal: "Normalmente el inquilino sigue pagando la renta; el coste principal es jurídico y de retraso.",
  },
  SQUATTING: {
    title: "Ocupación sin título",
    short: "Ocupación sin título",
    description: "Ocupación por personas sin contrato ni consentimiento del propietario. Aplicable a viviendas sin inquilino legítimo (vacías o de segunda residencia).",
    legal: "Puede tramitarse por vía civil (recuperación de la posesión) o penal, según el caso. No es lo mismo que el impago de un inquilino con contrato.",
  },
};

export const DEFAULT_RISK_ASSUMPTIONS = {
  riskLegalArrears: 150,
  riskLegalEviction: 1500,
  riskLegalRecovery: 1200,
  riskLegalSquatting: 2000,
  riskRepairsArrears: 0,
  riskRepairsEviction: 1500,
  riskRepairsRecovery: 500,
  riskRepairsSquatting: 3000,
  riskReletMonths: 1,
  riskDepositMonths: 1,
} satisfies Partial<StudyAssumptions>;

type RiskAssumptionKeys = keyof typeof DEFAULT_RISK_ASSUMPTIONS;
export type RiskAssumptions = Pick<StudyAssumptions, RiskAssumptionKeys>;

const LEGAL_KEY: Record<RiskType, RiskAssumptionKeys> = {
  ARREARS: "riskLegalArrears",
  EVICTION_ARREARS: "riskLegalEviction",
  RECOVERY_OTHER: "riskLegalRecovery",
  SQUATTING: "riskLegalSquatting",
};
const REPAIRS_KEY: Record<RiskType, RiskAssumptionKeys> = {
  ARREARS: "riskRepairsArrears",
  EVICTION_ARREARS: "riskRepairsEviction",
  RECOVERY_OTHER: "riskRepairsRecovery",
  SQUATTING: "riskRepairsSquatting",
};
export const riskLegalKey = (t: RiskType) => LEGAL_KEY[t];
export const riskRepairsKey = (t: RiskType) => REPAIRS_KEY[t];

export interface RiskResult {
  type: RiskType;
  months: number;
  /** Ingresos perdidos: renta no cobrada − fianza aplicada + meses hasta volver a alquilar. */
  lostIncome: number;
  unpaidRent: number;
  depositApplied: number;
  reletLoss: number;
  /** Gastos ordinarios que el propietario sigue pagando sin ingresos que los cubran. */
  ordinaryExpenses: number;
  legalCosts: number;
  repairs: number;
  /** Otros costes: intereses de la hipoteca del periodo + coste de oportunidad de la renta perdida. */
  otherCosts: number;
  /** Salida de caja del periodo: ingresos perdidos + gastos pagados sin renta + jurídicos + reparaciones + otros. */
  total: number;
  /** Coste adicional frente a un alquiler normal: excluye gastos ordinarios e intereses, que se pagan igualmente. */
  incrementalCost: number;
  note: string;
}

export function riskScenario(params: {
  type: RiskType;
  months: number;
  monthlyRent: number;
  fixedCostsYear: number; // comunidad + IBI + seguro + otros
  monthlyMortgageInterest: number;
  opportunityRatePct: number;
  assumptions: RiskAssumptions;
}): RiskResult {
  const a = params.assumptions;
  const { type, months, monthlyRent } = params;
  const tenantPays = type === "RECOVERY_OTHER";
  const unpaidRent = tenantPays ? 0 : monthlyRent * months; // en ocupación: renta de mercado no obtenida
  const depositApplied = type === "ARREARS" || type === "EVICTION_ARREARS" ? Math.min(unpaidRent, monthlyRent * a.riskDepositMonths) : 0;
  const reletLoss = monthlyRent * a.riskReletMonths;
  const lostIncome = unpaidRent - depositApplied + reletLoss;
  // Si el inquilino sigue pagando, los gastos ordinarios quedan cubiertos por la renta.
  const ordinaryExpenses = tenantPays ? 0 : (params.fixedCostsYear / 12) * months;
  const legalCosts = a[LEGAL_KEY[type]];
  const repairs = a[REPAIRS_KEY[type]];
  const otherCosts = tenantPays ? 0 : params.monthlyMortgageInterest * months + (unpaidRent - depositApplied) * (params.opportunityRatePct / 100) * (months / 12);
  const total = lostIncome + ordinaryExpenses + legalCosts + repairs + otherCosts;
  const opportunity = tenantPays ? 0 : (unpaidRent - depositApplied) * (params.opportunityRatePct / 100) * (months / 12);
  const incrementalCost = lostIncome + legalCosts + repairs + opportunity;
  const note =
    type === "RECOVERY_OTHER"
      ? "Se supone que el inquilino sigue pagando: el coste es jurídico, de reparaciones y de un mes adicional sin inquilino."
      : type === "SQUATTING"
        ? "Se cuenta como ingreso perdido la renta que no se puede obtener mientras dura la ocupación (no hay fianza)."
        : "La fianza legal se aplica a la deuda pendiente.";
  return { type, months, lostIncome, unpaidRent, depositApplied, reletLoss, ordinaryExpenses, legalCosts, repairs, otherCosts, total, incrementalCost, note };
}

export const RISK_DISCLAIMER =
  "Escenarios ilustrativos con hipótesis manuales. Los costes y plazos reales dependen de las circunstancias del caso, del juzgado y de la legislación aplicable en cada momento. No representan la probabilidad de que ocurran. Consulta con un abogado para tu caso concreto.";
