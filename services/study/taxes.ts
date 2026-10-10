// Estimaciones fiscales (funciones puras). NO son asesoramiento fiscal vinculante.
// Cada resultado indica su estado (completo, incompleto, no calculable, exento, no sujeto),
// la fórmula utilizada, la norma de referencia y los datos que faltan.
// Se supone residencia fiscal en territorio común (no foral) cuando el propietario es residente.
import type { NewContractCondition, TaxResidence, TensionedStatus } from "./types";

export const TAX_RULES_VERSION = "Normativa estatal vigente en 2025-2026 (revisar cada ejercicio)";

export type TaxStatus = "COMPLETE" | "INCOMPLETE" | "NOT_COMPUTABLE" | "EXEMPT" | "NOT_SUBJECT" | "NOT_APPLICABLE";

export const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  COMPLETE: "Calculado",
  INCOMPLETE: "Incompleto (con supuestos)",
  NOT_COMPUTABLE: "No calculable",
  EXEMPT: "Exento",
  NOT_SUBJECT: "No sujeto",
  NOT_APPLICABLE: "No aplica",
};

export interface TaxLine {
  label: string;
  amount: number | null;
  status: TaxStatus;
  formula?: string;
  basis?: string;
  missing: string[];
  notes: string[];
}

// --- IRPF: escala de la base del ahorro (residentes), aplicable desde 2025 -------------
export const SAVINGS_BRACKETS = [
  { upTo: 6_000, rate: 0.19 },
  { upTo: 50_000, rate: 0.21 },
  { upTo: 200_000, rate: 0.23 },
  { upTo: 300_000, rate: 0.27 },
  { upTo: Infinity, rate: 0.3 },
];

export function savingsTax(gain: number) {
  let remaining = Math.max(0, gain);
  let previous = 0;
  let tax = 0;
  for (const b of SAVINGS_BRACKETS) {
    const slice = Math.min(remaining, b.upTo - previous);
    if (slice <= 0) break;
    tax += slice * b.rate;
    remaining -= slice;
    previous = b.upTo;
  }
  return tax;
}

export const NON_RESIDENT_GAIN_RATE = 0.19;
export const NON_RESIDENT_WITHHOLDING = 0.03;

export interface CapitalGainResult extends TaxLine {
  gain: number | null;
  acquisitionValue: number | null;
  transferValue: number | null;
}

/**
 * Ganancia patrimonial = valor de transmisión − valor de adquisición.
 *   valor de transmisión = precio − gastos y tributos de la venta (agencia, notaría, plusvalía municipal…)
 *   valor de adquisición = precio de compra + gastos de compra + mejoras − amortizaciones deducidas
 */
export function capitalGainsTax(params: {
  salePrice: number;
  saleCosts: number; // gastos y tributos inherentes a la venta (incl. plusvalía municipal)
  purchasePrice: number | null;
  purchaseCosts: number | null;
  improvements: number | null;
  accumulatedAmortization?: number;
  residence: TaxResidence;
  isPrimaryResidence: boolean;
  over65: "YES" | "NO" | "UNDISCLOSED";
}): CapitalGainResult {
  const label = params.residence === "ES" ? "IRPF por ganancia patrimonial" : "IRNR por ganancia patrimonial (no residente)";
  const notes: string[] = [];
  const missing: string[] = [];
  const transferValue = params.salePrice - params.saleCosts;
  if (params.purchasePrice == null) {
    missing.push("Precio de compra (o valor de adquisición por herencia/donación)");
    return { label, amount: null, status: "NOT_COMPUTABLE", gain: null, acquisitionValue: null, transferValue, missing, notes: ["Sin valor de adquisición no se puede calcular la ganancia patrimonial."] };
  }
  let status: TaxStatus = "COMPLETE";
  if (params.purchaseCosts == null) {
    status = "INCOMPLETE";
    missing.push("Gastos e impuestos de la compra");
    notes.push("Gastos de compra no indicados: se toman como 0 € (el impuesto real puede ser menor).");
  }
  const amort = params.accumulatedAmortization ?? 0;
  if (amort > 0) notes.push(`Se restan ${Math.round(amort).toLocaleString("es-ES")} € de amortizaciones deducidas durante el alquiler (art. 35.1 Ley 35/2006).`);
  notes.push("No se aplican coeficientes de abatimiento (inmuebles adquiridos antes de 1995).");
  const acquisitionValue = params.purchasePrice + (params.purchaseCosts ?? 0) + (params.improvements ?? 0) - amort;
  const gain = transferValue - acquisitionValue;
  const formula = `Ganancia = (${Math.round(params.salePrice)} − ${Math.round(params.saleCosts)}) − ${Math.round(acquisitionValue)} = ${Math.round(gain)} €`;

  if (gain <= 0) {
    return { label, amount: 0, status: "NOT_SUBJECT", gain, acquisitionValue, transferValue, formula, missing, notes: [...notes, "No hay ganancia: no se tributa por este concepto."] };
  }
  if (params.residence === "ES") {
    if (params.isPrimaryResidence && params.over65 === "YES") {
      return {
        label,
        amount: 0,
        status: "EXEMPT",
        gain,
        acquisitionValue,
        transferValue,
        formula,
        missing,
        notes: [...notes, "Exenta: transmisión de vivienda habitual por mayor de 65 años (art. 33.4.b Ley 35/2006), si ha sido vivienda habitual al menos 3 años."],
      };
    }
    if (params.isPrimaryResidence) notes.push("Si reinviertes en otra vivienda habitual, la ganancia puede quedar exenta (art. 38 Ley 35/2006).");
    if (params.isPrimaryResidence && params.over65 === "UNDISCLOSED") notes.push("Si tienes 65 años o más y es tu vivienda habitual, la ganancia podría estar exenta.");
    return {
      label: `${label} (base del ahorro)`,
      amount: Math.round(savingsTax(gain)),
      status,
      gain,
      acquisitionValue,
      transferValue,
      formula: `${formula}; cuota por tramos 19/21/23/27/30 %`,
      basis: "Escala estatal + autonómica de la base del ahorro (art. 66 y 76 Ley 35/2006, desde 2025).",
      missing,
      notes,
    };
  }
  return {
    label,
    amount: Math.round(gain * NON_RESIDENT_GAIN_RATE),
    status,
    gain,
    acquisitionValue,
    transferValue,
    formula: `${formula}; cuota = ganancia × 19 %`,
    basis: "Impuesto sobre la Renta de No Residentes: 19 % sobre la ganancia.",
    missing,
    notes: [...notes, `El comprador retiene el ${NON_RESIDENT_WITHHOLDING * 100} % del precio como pago a cuenta (no es un coste adicional; se regulariza con el modelo 210).`],
  };
}

// --- Plusvalía municipal (IIVTNU) ------------------------------------------------------
// Coeficientes máximos del art. 107.4 TRLRHL vigentes: Real Decreto-ley 8/2023, art. 24
// (BOE 28-12-2023). El RDL 16/2025 los cambió del 1 al 27-01-2026, pero fue derogado (BOE 28-01-2026)
// y vuelve a aplicarse esta tabla. Cada ayuntamiento puede fijar coeficientes iguales o inferiores.
export const PLUSVALIA_COEFFICIENTS_RDL_8_2023 = [
  0.15, 0.15, 0.14, 0.14, 0.16, 0.18, 0.19, 0.2, 0.19, 0.15, 0.12, 0.1, 0.09, 0.09, 0.09, 0.09, 0.1, 0.13, 0.17, 0.23, 0.4,
];
export const PLUSVALIA_COEFFICIENTS_SOURCE = "Real Decreto-ley 8/2023, art. 24 (BOE 28-12-2023), vigente tras la derogación del RDL 16/2025";
/** @deprecated Tabla inicial del RDL 26/2021 (solo para referencia histórica). */
export const PLUSVALIA_COEFFICIENTS_RDL_26_2021 = [
  0.14, 0.13, 0.15, 0.16, 0.17, 0.17, 0.16, 0.12, 0.1, 0.09, 0.08, 0.08, 0.08, 0.08, 0.1, 0.12, 0.16, 0.2, 0.26, 0.36, 0.45,
];

export function plusvaliaCoefficient(years: number, table = PLUSVALIA_COEFFICIENTS_RDL_8_2023) {
  return table[Math.min(Math.max(0, Math.floor(years)), 20)];
}

export function plusvaliaMunicipal(params: {
  salePrice: number;
  purchasePrice: number | null;
  yearsHeld: number | null;
  cadastralLand: number | null;
  cadastralTotal: number | null;
  ratePct: number;
}): TaxLine & { method?: "OBJETIVO" | "REAL" } {
  const label = "Plusvalía municipal (IIVTNU)";
  const notes = [`Coeficientes máximos: ${PLUSVALIA_COEFFICIENTS_SOURCE}. El tipo municipal y los coeficientes que aplique tu ayuntamiento (pueden ser menores) figuran en su ordenanza fiscal.`];
  const missing: string[] = [];
  if (params.purchasePrice != null && params.salePrice <= params.purchasePrice) {
    return { label, amount: 0, status: "NOT_SUBJECT", missing, notes: ["No hay incremento de valor entre compra y venta: no sujeto (art. 104.5 TRLRHL)."] };
  }
  const rate = params.ratePct / 100;
  const candidates: Array<{ method: "OBJETIVO" | "REAL"; amount: number; formula: string }> = [];
  if (params.cadastralLand != null && params.yearsHeld != null) {
    const coef = plusvaliaCoefficient(params.yearsHeld);
    candidates.push({
      method: "OBJETIVO",
      amount: params.cadastralLand * coef * rate,
      formula: `${Math.round(params.cadastralLand)} (suelo) × ${coef} (${Math.floor(params.yearsHeld)} años) × ${params.ratePct} %`,
    });
  }
  if (params.purchasePrice != null && params.cadastralLand != null && params.cadastralTotal) {
    const share = params.cadastralLand / params.cadastralTotal;
    candidates.push({
      method: "REAL",
      amount: Math.max(0, params.salePrice - params.purchasePrice) * share * rate,
      formula: `(${Math.round(params.salePrice)} − ${Math.round(params.purchasePrice)}) × ${(share * 100).toFixed(1)} % suelo × ${params.ratePct} %`,
    });
  }
  if (!candidates.length) {
    if (params.cadastralLand == null) missing.push("Valor catastral del suelo (recibo del IBI)");
    if (params.yearsHeld == null) missing.push("Año de compra");
    return { label, amount: null, status: "NOT_COMPUTABLE", missing, notes };
  }
  const best = candidates.sort((a, b) => a.amount - b.amount)[0];
  return {
    label,
    amount: Math.round(best.amount),
    status: candidates.length === 2 ? "COMPLETE" : "INCOMPLETE",
    method: best.method,
    formula: best.formula,
    basis: `Método ${best.method === "OBJETIVO" ? "objetivo" : "de estimación directa"}; se aplica el más favorable de los disponibles (art. 107 TRLRHL).`,
    missing: candidates.length === 2 ? [] : ["Datos para comparar ambos métodos (precio de compra y valores catastrales)"],
    notes,
  };
}

// --- Reducción por alquiler de vivienda (art. 23.2 LIRPF, redacción Ley 12/2023) -------
export const REDUCTION_BY_CONDITION: Record<NewContractCondition, { pct: number; label: string; requires: string }> = {
  GENERAL: { pct: 50, label: "50 % · régimen general", requires: "Contrato de vivienda habitual del inquilino firmado desde el 26-05-2023." },
  REHAB: { pct: 60, label: "60 % · obras de rehabilitación", requires: "Obras de rehabilitación terminadas en los 2 años anteriores al contrato." },
  TENSIONED_YOUNG: { pct: 70, label: "70 % · zona tensionada, inquilino de 18-35 años", requires: "Primer alquiler en zona tensionada a un inquilino de 18 a 35 años (u otros supuestos legales)." },
  TENSIONED_DECREASE: { pct: 90, label: "90 % · zona tensionada con rebaja de renta", requires: "Nuevo contrato en zona tensionada con renta inferior en más de un 5 % a la del contrato anterior." },
};
export const LEY_12_2023_START = "2023-05-26";

export interface RentalReduction {
  pct: number | null;
  status: "DETERMINED" | "ASSUMED" | "NOT_APPLICABLE" | "UNKNOWN";
  label: string;
  basis: string;
  missing: string[];
}

export function determineRentalReduction(params: {
  residence: TaxResidence;
  ccaaCode: string;
  currentlyRented: boolean;
  contractStart: string | null; // AAAA-MM del contrato vigente
  newContractCondition: NewContractCondition;
  tensionedStatus: TensionedStatus;
  rentedLast5Years: "YES" | "NO" | "UNKNOWN";
}): RentalReduction {
  if (params.residence !== "ES") {
    return { pct: 0, status: "NOT_APPLICABLE", label: "Sin reducción", basis: "Los no residentes tributan por el IRNR, que no prevé esta reducción.", missing: [] };
  }
  if (params.ccaaCode === "15" || params.ccaaCode === "16") {
    return {
      pct: null,
      status: "UNKNOWN",
      label: "Normativa foral",
      basis: "En Navarra y País Vasco rige la normativa foral del IRPF, que no se calcula en este estudio.",
      missing: ["Territorio de residencia fiscal y normativa foral aplicable"],
    };
  }
  if (params.currentlyRented) {
    if (!params.contractStart) {
      return {
        pct: null,
        status: "UNKNOWN",
        label: "No determinada",
        basis: "La reducción depende de la fecha del contrato vigente (antes o después del 26-05-2023).",
        missing: ["Fecha de firma del contrato de alquiler vigente"],
      };
    }
    if (`${params.contractStart}-01` < LEY_12_2023_START) {
      return { pct: 60, status: "DETERMINED", label: "60 % · contrato anterior al 26-05-2023", basis: "Los contratos celebrados antes de la entrada en vigor de la Ley 12/2023 mantienen la reducción del 60 % (régimen transitorio).", missing: [] };
    }
  }
  const c = REDUCTION_BY_CONDITION[params.newContractCondition];
  const tensioned = params.tensionedStatus === "DECLARED" || params.tensionedStatus === "PARTIAL";
  if ((params.newContractCondition === "TENSIONED_YOUNG" || params.newContractCondition === "TENSIONED_DECREASE") && !tensioned) {
    return { ...REDUCTION_BY_CONDITION.GENERAL, pct: 50, status: "ASSUMED", label: REDUCTION_BY_CONDITION.GENERAL.label, basis: "La condición elegida exige zona tensionada declarada; se aplica el régimen general.", missing: [] };
  }
  if (params.newContractCondition === "TENSIONED_DECREASE" && params.rentedLast5Years !== "YES") {
    return { pct: 50, status: "ASSUMED", label: REDUCTION_BY_CONDITION.GENERAL.label, basis: "El 90 % exige un contrato anterior con el que comparar la renta; se aplica el régimen general.", missing: ["Contrato anterior en los últimos 5 años"] };
  }
  return {
    pct: c.pct,
    status: params.newContractCondition === "GENERAL" ? "ASSUMED" : "DETERMINED",
    label: c.label,
    basis: `${c.requires}${params.newContractCondition === "GENERAL" ? " Se aplica porque no consta ninguna condición que dé derecho a una reducción mayor." : " Debe poder acreditarse."}`,
    missing: [],
  };
}

// --- Amortización fiscal (art. 23.1.b LIRPF y art. 14 RIRPF) ----------------------------
/** 3 % anual del mayor entre coste de adquisición y valor catastral, excluido el suelo, + mejoras. */
export function annualAmortization(params: {
  purchasePrice: number | null;
  purchaseCosts: number | null;
  improvements: number | null;
  cadastralLand: number | null;
  cadastralTotal: number | null;
}) {
  if (params.cadastralLand == null || !params.cadastralTotal) {
    return { amount: 0, known: false, formula: "No calculada: falta el desglose catastral suelo/construcción." };
  }
  const constructionShare = 1 - params.cadastralLand / params.cadastralTotal;
  const acquisition = params.purchasePrice != null ? params.purchasePrice + (params.purchaseCosts ?? 0) : 0;
  const base = Math.max(acquisition, params.cadastralTotal) * constructionShare;
  const amount = base * 0.03 + (params.improvements ?? 0) * 0.03;
  return {
    amount,
    known: true,
    formula: `3 % × máx(${Math.round(acquisition)}, ${Math.round(params.cadastralTotal)}) × ${(constructionShare * 100).toFixed(1)} % construcción${params.improvements ? " + 3 % de mejoras" : ""}`,
  };
}

// --- Rendimientos del alquiler (un año) -------------------------------------------------
export interface RentalTaxYear {
  tax: number;
  netIncome: number; // rendimiento neto antes de reducción (residentes y UE) o íntegro (otros)
  taxableBase: number;
  deductibleExpenses: number;
  amortization: number;
  cappedExcess: number; // intereses + conservación no deducibles este año por el límite
  imputedIncomeTax: number; // imputación de rentas del periodo vacío
  status: TaxStatus;
  notes: string[];
}

/**
 * Residentes: (renta cobrada − gastos deducibles del periodo arrendado − amortización) × (1 − reducción) × tipo marginal.
 *   · Gastos fijos y amortización se prorratean por la parte del año alquilada.
 *   · Intereses + conservación y reparación no pueden superar los ingresos íntegros (art. 23.1.a LIRPF).
 *   · El periodo vacío genera imputación de rentas (1,1 % del valor catastral × fracción del año).
 * No residentes UE/EEE: 19 % × rendimiento neto (sin reducción). Otros: 24 % × ingresos íntegros.
 */
export function rentalIncomeTaxYear(params: {
  collectedRent: number;
  occupancyFraction: number; // 0-1
  fixedCosts: number; // comunidad, IBI, seguro, otros (importe anual)
  maintenance: number; // conservación imputable al periodo alquilado
  management: number;
  interest: number;
  amortizationYear: number;
  residence: TaxResidence;
  marginalRatePct: number;
  reductionPct: number | null;
  cadastralTotal: number | null;
}): RentalTaxYear {
  const notes: string[] = [];
  const occ = Math.min(1, Math.max(0, params.occupancyFraction));
  const vacant = 1 - occ;
  let status: TaxStatus = "COMPLETE";
  let imputedIncomeTax = 0;
  const imputationRate = params.residence === "ES" ? params.marginalRatePct / 100 : params.residence === "EU_EEA" ? 0.19 : 0.24;
  if (vacant > 0) {
    if (params.cadastralTotal != null) {
      imputedIncomeTax = params.cadastralTotal * 0.011 * vacant * imputationRate;
      notes.push("Imputación de rentas por el periodo sin alquilar (1,1 % del valor catastral; 2 % si no está revisado).");
    } else {
      status = "INCOMPLETE";
      notes.push("Falta el valor catastral: no se incluye la imputación de rentas del periodo vacío.");
    }
  }
  if (params.collectedRent <= 0) {
    return { tax: 0, netIncome: 0, taxableBase: 0, deductibleExpenses: 0, amortization: 0, cappedExcess: 0, imputedIncomeTax, status, notes };
  }
  if (params.residence === "OTHER") {
    const tax = params.collectedRent * 0.24;
    return { tax, netIncome: params.collectedRent, taxableBase: params.collectedRent, deductibleExpenses: 0, amortization: 0, cappedExcess: 0, imputedIncomeTax, status, notes: [...notes, "IRNR: 24 % sobre ingresos íntegros, sin deducir gastos."] };
  }
  // Intereses (anuales) se prorratean; «maintenance» llega ya imputado al periodo alquilado.
  const capped = params.interest * occ + params.maintenance;
  const cappedDeductible = Math.min(capped, params.collectedRent);
  const cappedExcess = capped - cappedDeductible;
  if (cappedExcess > 0) notes.push("Intereses y reparaciones superan los ingresos: el exceso se podría deducir en los 4 años siguientes (no incluido).");
  const deductibleExpenses = params.fixedCosts * occ + params.management + cappedDeductible;
  const amortization = params.amortizationYear * occ;
  const netIncome = params.collectedRent - deductibleExpenses - amortization;
  if (params.residence === "EU_EEA") {
    const taxableBase = Math.max(0, netIncome);
    return { tax: taxableBase * 0.19, netIncome, taxableBase, deductibleExpenses, amortization, cappedExcess, imputedIncomeTax, status, notes: [...notes, "IRNR UE/EEE: 19 % sobre el rendimiento neto."] };
  }
  let reduction = params.reductionPct;
  if (reduction == null) {
    reduction = 0;
    status = "INCOMPLETE";
    notes.push("Reducción no determinada: se calcula sin reducción (el impuesto real puede ser menor).");
  }
  const taxableBase = netIncome > 0 ? netIncome * (1 - reduction / 100) : netIncome;
  const tax = Math.max(0, taxableBase) * (params.marginalRatePct / 100);
  if (netIncome < 0) notes.push("Rendimiento negativo: puede compensarse con otras rentas (no incluido).");
  return { tax, netIncome, taxableBase, deductibleExpenses, amortization, cappedExcess, imputedIncomeTax, status, notes };
}

/** Imputación de rentas si la vivienda no está alquilada ni es la habitual. */
export function imputedIncomeTax(params: { cadastralTotal: number | null; residence: TaxResidence; marginalRatePct: number; revisedValues?: boolean }): TaxLine {
  const label = "Imputación de rentas inmobiliarias (vivienda vacía o segunda residencia)";
  if (params.cadastralTotal == null) return { label, amount: null, status: "NOT_COMPUTABLE", missing: ["Valor catastral total"], notes: [] };
  const pct = params.revisedValues === false ? 0.02 : 0.011;
  const base = params.cadastralTotal * pct;
  const rate = params.residence === "ES" ? params.marginalRatePct / 100 : params.residence === "EU_EEA" ? 0.19 : 0.24;
  return {
    label,
    amount: Math.round(base * rate),
    status: "COMPLETE",
    formula: `${Math.round(params.cadastralTotal)} × ${pct * 100} % × ${Math.round(rate * 100)} %`,
    basis: "1,1 % del valor catastral si fue revisado en los últimos 10 años; 2 % en otro caso (art. 85 LIRPF).",
    missing: [],
    notes: ["Solo aplica a viviendas que no están alquiladas y no son la vivienda habitual."],
  };
}

// --- Sucesiones y donaciones (informativo) --------------------------------------------
export function inheritanceGuidance(params: { ccaaName: string; relationship: string | null; propertyValue: number | null }) {
  const missing: string[] = [];
  if (!params.relationship) missing.push("Parentesco del heredero o donatario (cónyuge, hijo, hermano, otros)");
  if (params.propertyValue == null) missing.push("Valor del inmueble (valor de referencia catastral o de mercado)");
  missing.push("Residencia del causante y del heredero (determina la normativa autonómica aplicable)");
  missing.push("Patrimonio preexistente del heredero y resto de bienes de la herencia");
  return {
    title: "Impuesto sobre Sucesiones y Donaciones",
    summary: `La cuota depende de la normativa de ${params.ccaaName} (reducciones y bonificaciones autonómicas), del parentesco y del patrimonio previo del heredero. No calculamos una cifra porque varía mucho y requiere asesoramiento personalizado.`,
    missing,
    notes: [
      "En una herencia, la «plusvalía del muerto» no tributa en el IRPF del fallecido, pero sí puede devengarse la plusvalía municipal.",
      "Existen reducciones estatales y autonómicas por vivienda habitual del causante para determinados herederos.",
      "Donar en vida puede generar IRPF para el donante además del impuesto de donaciones del donatario.",
    ],
  };
}
