// Simulador «vender frente a alquilar» (funciones puras; se ejecuta también en el navegador).
//
// Punto de partida común (fecha de hoy): patrimonio en la vivienda = valor de mercado − hipoteca.
// Métrica común: PATRIMONIO NETO al final del horizonte N, en euros corrientes del año N
// (sin descontar). La rentabilidad alternativa r se aplica igual a A y a los flujos de B/C.
//   A) Vender hoy: dinero neto de la venta (precio − gastos − impuestos − hipoteca) × (1 + r)^N.
//   B) Alquilar y vender en N: flujos netos anuales del alquiler reinvertidos a r
//      + dinero neto de una venta en N (con sus gastos, impuestos e hipoteca pendiente).
//   C) Mantener sin vender: los mismos flujos reinvertidos + valor bruto de la vivienda en N
//      − hipoteca pendiente. NO se descuentan gastos ni impuestos de una venta que no ocurre;
//      se informan aparte como «latentes».
// Flujo de caja (dinero que entra/sale cada año) y patrimonio (valor acumulado) se muestran por separado.
import { annualAmortization, capitalGainsTax, plusvaliaMunicipal, rentalIncomeTaxYear, type CapitalGainResult, type TaxLine } from "./taxes";
import type { StudyAssumptions, StudyInput } from "./types";

export interface MortgageInfo {
  balance: number;
  annualRatePct: number;
  yearsLeft: number;
  monthlyPayment: number;
  assumed: string[];
}

export function resolveMortgage(input: StudyInput): MortgageInfo | null {
  const e = input.economics;
  if (!e.mortgageBalance) return null;
  const assumed: string[] = [];
  const rate = e.mortgageRate ?? (assumed.push("tipo de interés supuesto 3 %"), 3);
  const years = e.mortgageYearsLeft ?? (assumed.push("plazo pendiente supuesto 20 años"), 20);
  const monthly = e.mortgageMonthlyPayment ?? monthlyPayment(e.mortgageBalance, rate, years);
  return { balance: e.mortgageBalance, annualRatePct: rate, yearsLeft: years, monthlyPayment: monthly, assumed };
}

export function monthlyPayment(principal: number, annualRatePct: number, years: number) {
  const n = Math.max(1, Math.round(years * 12));
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Intereses y amortización de capital de cada año (cálculo mensual). */
export function amortizationSchedule(m: MortgageInfo | null, years: number) {
  const rows: Array<{ year: number; interest: number; principal: number; balanceEnd: number }> = [];
  let balance = m?.balance ?? 0;
  const r = (m?.annualRatePct ?? 0) / 100 / 12;
  for (let y = 1; y <= years; y++) {
    let interest = 0;
    let principal = 0;
    for (let k = 0; k < 12 && balance > 0.005; k++) {
      const i = balance * r;
      const p = Math.min(balance, Math.max(0, (m?.monthlyPayment ?? 0) - i));
      interest += i;
      principal += p;
      balance -= p;
    }
    rows.push({ year: y, interest, principal, balanceEnd: Math.max(0, balance) });
  }
  return rows;
}

export interface SaleBreakdown {
  salePrice: number;
  agencyFees: number;
  notaryAndOther: number;
  mortgageCancellation: number;
  earlyRepaymentFee: number;
  /** Gastos de la operación (sin impuestos). */
  transactionCosts: number;
  plusvalia: TaxLine;
  gainTax: CapitalGainResult;
  /** Impuestos calculados (plusvalía + IRPF/IRNR); los no calculables no se suman. */
  taxesTotal: number;
  mortgagePayoff: number;
  /** Dinero neto que recibe el propietario. */
  net: number;
  complete: boolean;
  notComputed: string[];
}

export function saleBreakdown(params: {
  input: StudyInput;
  a: StudyAssumptions;
  salePrice: number;
  yearsFromNow: number;
  mortgageBalance: number;
  accumulatedAmortization?: number;
}): SaleBreakdown {
  const { input, a, salePrice } = params;
  const e = input.economics;
  const agencyFees = salePrice * (a.agencyFeePct / 100) * (1 + a.vatPct / 100);
  const notaryAndOther = a.notaryAndOtherSaleCosts;
  const hasMortgage = params.mortgageBalance > 0.5;
  const mortgageCancellation = hasMortgage ? a.mortgageCancellationCosts : 0;
  const earlyRepaymentFee = hasMortgage ? params.mortgageBalance * (a.earlyRepaymentFeePct / 100) : 0;
  const yearsHeld = e.purchaseYear ? new Date().getFullYear() - e.purchaseYear + params.yearsFromNow : null;
  const plusvalia = plusvaliaMunicipal({
    salePrice,
    purchasePrice: e.purchasePrice,
    yearsHeld,
    cadastralLand: e.cadastralValueLand,
    cadastralTotal: e.cadastralValueTotal,
    ratePct: a.plusvaliaRatePct,
  });
  const gainTax = capitalGainsTax({
    salePrice,
    // Gastos y tributos inherentes a la transmisión (la cancelación de la hipoteca no lo es)
    saleCosts: agencyFees + notaryAndOther + (plusvalia.amount ?? 0),
    purchasePrice: e.purchasePrice,
    purchaseCosts: e.purchaseCosts,
    improvements: e.improvementsCost,
    accumulatedAmortization: params.accumulatedAmortization,
    residence: input.owner.taxResidence,
    isPrimaryResidence: input.property.currentUse === "OWNER_PRIMARY" && params.yearsFromNow === 0,
    over65: input.owner.over65,
  });
  const notComputed: string[] = [];
  if (plusvalia.amount == null) notComputed.push(`Plusvalía municipal (falta: ${plusvalia.missing.join(", ")})`);
  if (gainTax.amount == null) notComputed.push(`${gainTax.label} (falta: ${gainTax.missing.join(", ")})`);
  const transactionCosts = agencyFees + notaryAndOther + mortgageCancellation + earlyRepaymentFee;
  const taxesTotal = (plusvalia.amount ?? 0) + (gainTax.amount ?? 0);
  const net = salePrice - transactionCosts - taxesTotal - params.mortgageBalance;
  const complete = notComputed.length === 0 && gainTax.status !== "INCOMPLETE";
  return { salePrice, agencyFees, notaryAndOther, mortgageCancellation, earlyRepaymentFee, transactionCosts, plusvalia, gainTax, taxesTotal, mortgagePayoff: params.mortgageBalance, net, complete, notComputed };
}

export interface YearRow {
  year: number;
  grossRent: number;
  vacancyLoss: number;
  collectedRent: number;
  fixedCosts: number; // comunidad, IBI, seguro, otros
  maintenance: number;
  management: number;
  extraordinary: number;
  operatingCosts: number;
  interest: number;
  principal: number;
  incomeTax: number; // impuesto del alquiler + imputación del periodo vacío
  cashFlow: number; // flujo de caja neto: después de gastos, impuestos y cuota hipotecaria
  propertyValue: number | null;
  mortgageBalance: number;
  accumulatedCash: number; // flujos reinvertidos a la rentabilidad alternativa
}

export interface SimContext {
  /** Valor de venta usado (null = no hay valoración fiable: A/B/C no se calculan). */
  saleValue: number | null;
  /** Renta mensual usada (null = desconocida: B/C no se calculan). */
  monthlyRent: number | null;
  /** Reducción IRPF del alquiler determinada (null = desconocida → se calcula sin reducción y se avisa). */
  rentalReductionPct: number | null;
}

export interface ScenarioResult {
  horizon: number;
  initial: { propertyValue: number | null; mortgageBalance: number; equity: number | null };
  sellNow: { breakdown: SaleBreakdown; investmentGain: number; wealth: number } | null;
  rental: { rows: YearRow[]; cumulativeCashFlow: number; reinvestmentGain: number; accumulatedCash: number; taxComplete: boolean } | null;
  rentThenSell: { finalSale: SaleBreakdown; wealth: number } | null;
  keep: { propertyValueGross: number; mortgageBalance: number; propertyEquity: number; accumulatedCash: number; wealth: number; latentSaleCosts: number } | null;
  yields: { gross: number | null; net: number | null; netAfterTax: number | null };
  /** Datos que faltan y que impiden o limitan el cálculo. */
  incomplete: string[];
  warnings: string[];
}

export function simulate(input: StudyInput, a: StudyAssumptions, horizon: number, ctx: SimContext): ScenarioResult {
  const warnings: string[] = [];
  const incomplete: string[] = [];
  const mortgage = resolveMortgage(input);
  if (mortgage?.assumed.length) warnings.push(`Hipoteca: ${mortgage.assumed.join(", ")}.`);
  const schedule = amortizationSchedule(mortgage, horizon);
  const e = input.economics;
  const r = a.opportunityRatePct / 100;
  const V = ctx.saleValue;
  const debt0 = mortgage?.balance ?? 0;

  if (V == null) incomplete.push("Valor de venta: no hay una valoración fiable (indica una tasación, el valor de referencia catastral o el precio y año de compra).");
  if (ctx.monthlyRent == null) incomplete.push("Renta mensual: no hay estimación de alquiler utilizable.");
  if (a.ibiYear == null) incomplete.push("IBI: importe desconocido, no incluido en los gastos.");
  if (a.communityFeesYear == null) incomplete.push("Comunidad: importe desconocido, no incluido en los gastos.");

  // --- A) Vender hoy
  let sellNow: ScenarioResult["sellNow"] = null;
  if (V != null) {
    const breakdown = saleBreakdown({ input, a, salePrice: V, yearsFromNow: 0, mortgageBalance: debt0 });
    const wealth = breakdown.net * Math.pow(1 + r, horizon);
    sellNow = { breakdown, investmentGain: wealth - breakdown.net, wealth };
    if (!breakdown.complete) incomplete.push(...breakdown.notComputed.map((n) => `Venta hoy: ${n}`));
  }

  // --- Flujos del alquiler (B y C)
  let rental: ScenarioResult["rental"] = null;
  let accumulatedAmortization = 0;
  if (ctx.monthlyRent != null) {
    const amort = annualAmortization({
      purchasePrice: e.purchasePrice,
      purchaseCosts: e.purchaseCosts,
      improvements: e.improvementsCost,
      cadastralLand: e.cadastralValueLand,
      cadastralTotal: e.cadastralValueTotal,
    });
    const residentLike = input.owner.taxResidence !== "OTHER";
    if (!amort.known && residentLike) warnings.push("No se deduce la amortización fiscal (falta el desglose catastral suelo/construcción): el impuesto del alquiler puede estar sobrestimado.");
    const occupancy = Math.max(0, 12 - a.vacancyMonths) / 12;
    const rows: YearRow[] = [];
    let acc = 0;
    let sum = 0;
    let taxComplete = true;
    for (let y = 1; y <= horizon; y++) {
      const growth = Math.pow(1 + a.rentGrowthPct / 100, y - 1);
      const costGrowth = Math.pow(1 + a.costInflationPct / 100, y - 1);
      const grossRent = ctx.monthlyRent * 12 * growth;
      const collectedRent = grossRent * occupancy;
      const fixedCosts = ((a.communityFeesYear ?? 0) + (a.ibiYear ?? 0) + (a.insuranceYear ?? 0) + a.otherCostsYear) * costGrowth;
      const maintenance = e.maintenanceYear != null ? e.maintenanceYear * costGrowth : collectedRent * (a.maintenancePctRent / 100);
      const management = collectedRent * (a.managementPct / 100);
      const extraordinary = a.extraordinaryCosts / horizon; // no deducible (mejoras/derramas)
      const operatingCosts = fixedCosts + maintenance + management + extraordinary;
      const m = schedule[y - 1];
      const tax = rentalIncomeTaxYear({
        collectedRent,
        occupancyFraction: occupancy,
        fixedCosts,
        // si es un importe anual fijo se imputa solo la parte del periodo alquilado
        maintenance: e.maintenanceYear != null ? maintenance * occupancy : maintenance,
        management,
        interest: m.interest,
        amortizationYear: residentLike ? amort.amount : 0,
        residence: input.owner.taxResidence,
        marginalRatePct: a.marginalRatePct,
        reductionPct: ctx.rentalReductionPct,
        cadastralTotal: e.cadastralValueTotal,
      });
      if (tax.status === "INCOMPLETE") taxComplete = false;
      accumulatedAmortization += tax.amortization;
      const incomeTax = tax.tax + tax.imputedIncomeTax;
      const cashFlow = collectedRent - operatingCosts - m.interest - m.principal - incomeTax;
      sum += cashFlow;
      acc = acc * (1 + r) + cashFlow;
      rows.push({
        year: y,
        grossRent,
        vacancyLoss: grossRent - collectedRent,
        collectedRent,
        fixedCosts,
        maintenance,
        management,
        extraordinary,
        operatingCosts,
        interest: m.interest,
        principal: m.principal,
        incomeTax,
        cashFlow,
        propertyValue: V != null ? V * Math.pow(1 + a.appreciationPct / 100, y) : null,
        mortgageBalance: m.balanceEnd,
        accumulatedCash: acc,
      });
    }
    rental = { rows, cumulativeCashFlow: sum, reinvestmentGain: acc - sum, accumulatedCash: acc, taxComplete };
    if (!taxComplete) incomplete.push("Impuestos del alquiler: calculados con supuestos (falta información fiscal).");
  }

  // --- B) y C)
  let rentThenSell: ScenarioResult["rentThenSell"] = null;
  let keep: ScenarioResult["keep"] = null;
  const balanceN = schedule[horizon - 1]?.balanceEnd ?? debt0;
  if (V != null && rental) {
    const VN = V * Math.pow(1 + a.appreciationPct / 100, horizon);
    const finalSale = saleBreakdown({ input, a, salePrice: VN, yearsFromNow: horizon, mortgageBalance: balanceN, accumulatedAmortization });
    rentThenSell = { finalSale, wealth: rental.accumulatedCash + finalSale.net };
    const equity = VN - balanceN;
    keep = {
      propertyValueGross: VN,
      mortgageBalance: balanceN,
      propertyEquity: equity,
      accumulatedCash: rental.accumulatedCash,
      wealth: rental.accumulatedCash + equity,
      latentSaleCosts: equity - finalSale.net,
    };
  }

  // Rentabilidades del primer año sobre el valor de venta
  const y1 = rental?.rows[0];
  const yields = {
    gross: V && ctx.monthlyRent != null ? (ctx.monthlyRent * 12) / V : null,
    net: V && y1 ? (y1.collectedRent - (y1.operatingCosts - y1.extraordinary)) / V : null,
    netAfterTax: V && y1 ? (y1.collectedRent - (y1.operatingCosts - y1.extraordinary) - y1.incomeTax) / V : null,
  };

  if (input.property.currentUse === "OWNER_PRIMARY") warnings.push("Es tu vivienda habitual: alquilarla implica mudarte y pagar otra vivienda (coste no incluido).");
  if (["ARREARS", "LITIGATION", "POSSESSION_RECOVERY"].includes(input.owner.tenancyIssue))
    warnings.push("Hay una incidencia con el arrendamiento actual: los ingresos y la venta libre de ocupantes pueden verse afectados.");
  if (input.property.currentUse === "RENTED") warnings.push("La vivienda está alquilada: venderla con inquilino suele reducir el precio y el contrato vigente se mantiene.");
  if (rental?.rows.some((row) => row.cashFlow < 0)) warnings.push("En algún año el alquiler no cubre gastos, impuestos y cuota hipotecaria: habría que aportar dinero.");

  return {
    horizon,
    initial: { propertyValue: V, mortgageBalance: debt0, equity: V != null ? V - debt0 : null },
    sellNow,
    rental,
    rentThenSell,
    keep,
    yields,
    incomplete: [...new Set(incomplete)],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Sensibilidad: variación de (B − A) al mover cada hipótesis en ambos sentidos.
// ---------------------------------------------------------------------------
export interface SensitivityItem {
  key: string;
  label: string;
  available: boolean;
  reason?: string;
  /** Diferencia B − A con la variación a la baja y al alza. */
  down: number | null;
  up: number | null;
  base: number | null;
  /** Mayor desviación absoluta respecto al caso base. */
  impact: number | null;
}

export function sensitivity(input: StudyInput, a: StudyAssumptions, horizon: number, ctx: SimContext): SensitivityItem[] {
  const diff = (aa: StudyAssumptions, cc: SimContext) => {
    const s = simulate(input, aa, horizon, cc);
    return s.rentThenSell && s.sellNow ? s.rentThenSell.wealth - s.sellNow.wealth : null;
  };
  const base = diff(a, ctx);
  const scaleFixed = (k: number): StudyAssumptions => ({
    ...a,
    communityFeesYear: a.communityFeesYear != null ? a.communityFeesYear * k : null,
    ibiYear: a.ibiYear != null ? a.ibiYear * k : null,
    insuranceYear: a.insuranceYear != null ? a.insuranceYear * k : null,
    otherCostsYear: a.otherCostsYear * k,
  });
  const fixedTotal = (a.communityFeesYear ?? 0) + (a.ibiYear ?? 0) + (a.insuranceYear ?? 0) + a.otherCostsYear;
  const tests: Array<{ key: string; label: string; needs: string | null; run: (dir: 1 | -1) => number | null }> = [
    {
      key: "saleValue",
      label: "Valor de venta ±10 %",
      needs: ctx.saleValue == null ? "No hay valor de venta" : null,
      run: (d) => diff(a, { ...ctx, saleValue: ctx.saleValue! * (1 + 0.1 * d) }),
    },
    {
      key: "monthlyRent",
      label: "Alquiler ±10 %",
      needs: ctx.monthlyRent == null ? "No hay renta estimada" : null,
      run: (d) => diff(a, { ...ctx, monthlyRent: ctx.monthlyRent! * (1 + 0.1 * d) }),
    },
    {
      key: "vacancyMonths",
      label: "Desocupación ±1 mes/año",
      needs: null,
      run: (d) => diff({ ...a, vacancyMonths: Math.min(12, Math.max(0, a.vacancyMonths + d)) }, ctx),
    },
    {
      key: "fixedCosts",
      label: "Gastos fijos ±10 %",
      needs: fixedTotal === 0 ? "No hay gastos fijos conocidos" : null,
      run: (d) => diff(scaleFixed(1 + 0.1 * d), ctx),
    },
    { key: "appreciationPct", label: "Revalorización ±1 punto", needs: null, run: (d) => diff({ ...a, appreciationPct: a.appreciationPct + d }, ctx) },
    { key: "opportunityRatePct", label: "Rentabilidad alternativa ±1 punto", needs: null, run: (d) => diff({ ...a, opportunityRatePct: a.opportunityRatePct + d }, ctx) },
  ];
  return tests
    .map((t): SensitivityItem => {
      if (base == null) return { key: t.key, label: t.label, available: false, reason: "Faltan datos para comparar alquilar y vender", down: null, up: null, base: null, impact: null };
      if (t.needs) return { key: t.key, label: t.label, available: false, reason: t.needs, down: null, up: null, base, impact: null };
      const down = t.run(-1);
      const up = t.run(1);
      const impact = Math.max(Math.abs((down ?? base) - base), Math.abs((up ?? base) - base));
      return {
        key: t.key,
        label: t.label,
        available: true,
        down,
        up,
        base,
        impact,
        reason: impact < 1 ? "No modifica la diferencia con estos datos (efecto matemáticamente nulo)." : undefined,
      };
    })
    .sort((x, y) => (y.impact ?? -1) - (x.impact ?? -1));
}
