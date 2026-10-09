import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, buildDefaultAssumptions } from "@/services/study/assumptions";
import { DEFAULT_RISK_ASSUMPTIONS, riskScenario } from "@/services/study/risk";
import { amortizationSchedule, monthlyPayment, resolveMortgage, sensitivity, simulate, type SimContext } from "@/services/study/simulator";
import type { StudyAssumptions } from "@/services/study/types";
import { makeInput } from "./study-fixtures";

function assumptions(over: Partial<StudyAssumptions> = {}): StudyAssumptions {
  return {
    ...buildDefaultAssumptions(makeInput()).values,
    communityFeesYear: 1200,
    ibiYear: 400,
    insuranceYear: 300,
    ...over,
  };
}
const ctx = (saleValue: number | null, monthlyRent: number | null, rentalReductionPct: number | null = 50): SimContext => ({ saleValue, monthlyRent, rentalReductionPct });

// Sin gastos, sin desocupación, sin revalorización: permite calcular a mano.
const zero: Partial<StudyAssumptions> = {
  agencyFeePct: 0,
  notaryAndOtherSaleCosts: 0,
  mortgageCancellationCosts: 0,
  earlyRepaymentFeePct: 0,
  communityFeesYear: 0,
  ibiYear: 0,
  insuranceYear: 0,
  otherCostsYear: 0,
  maintenancePctRent: 0,
  managementPct: 0,
  vacancyMonths: 0,
  plusvaliaRatePct: 0,
  appreciationPct: 0,
  rentGrowthPct: 0,
  costInflationPct: 0,
  opportunityRatePct: 0,
};

describe("hipoteca", () => {
  it("cuota francesa", () => {
    expect(monthlyPayment(100000, 3, 20)).toBeCloseTo(554.6, 1);
    expect(monthlyPayment(120000, 0, 10)).toBeCloseTo(1000);
  });

  it("el cuadro de amortización devuelve el capital completo", () => {
    const m = { balance: 50000, annualRatePct: 4, yearsLeft: 5, monthlyPayment: monthlyPayment(50000, 4, 5), assumed: [] };
    const rows = amortizationSchedule(m, 5);
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBeCloseTo(50000, 0);
    expect(rows[4].balanceEnd).toBeCloseTo(0, 0);
  });

  it("identifica las hipótesis cuando faltan datos", () => {
    expect(resolveMortgage(makeInput({ economics: { mortgageBalance: 80000 } }))?.assumed.length).toBe(2);
  });
});

describe("casos de referencia A / B / C (calculados a mano)", () => {
  it("A: neto de la venta × (1 + r)^N", () => {
    const input = makeInput({ economics: { purchasePrice: 300000, purchaseCosts: 0, purchaseYear: 2020 } });
    const r = simulate(input, assumptions({ ...zero, opportunityRatePct: 3 }), 5, ctx(300000, 1000));
    expect(r.sellNow!.breakdown.net).toBeCloseTo(300000);
    expect(r.sellNow!.wealth).toBeCloseTo(300000 * 1.03 ** 5);
    expect(r.sellNow!.investmentGain).toBeCloseTo(300000 * (1.03 ** 5 - 1));
  });

  it("B: flujos netos del alquiler + venta neta futura (no residente UE, 19 % del neto)", () => {
    const input = makeInput({ economics: { purchasePrice: 300000, purchaseCosts: 0, purchaseYear: 2020 }, owner: { taxResidence: "EU_EEA" } });
    const r = simulate(input, assumptions(zero), 3, ctx(300000, 1000));
    // año: 12.000 − 19 % × 12.000 = 9.720 ; venta final 300.000 sin ganancia ni gastos
    expect(r.rental!.rows.map((y) => y.cashFlow)).toEqual([9720, 9720, 9720].map((v) => expect.closeTo(v, 6)));
    expect(r.rentThenSell!.finalSale.net).toBeCloseTo(300000);
    expect(r.rentThenSell!.wealth).toBeCloseTo(329160);
    expect(r.keep!.wealth).toBeCloseTo(329160);
    expect(r.keep!.latentSaleCosts).toBeCloseTo(0);
  });

  it("reinversión de los flujos a la misma rentabilidad alternativa que A", () => {
    const input = makeInput({ owner: { taxResidence: "EU_EEA" } });
    const r = simulate(input, assumptions({ ...zero, opportunityRatePct: 5 }), 3, ctx(300000, 1000));
    expect(r.rental!.accumulatedCash).toBeCloseTo(9720 * ((1.05 ** 3 - 1) / 0.05));
    expect(r.rental!.cumulativeCashFlow).toBeCloseTo(9720 * 3);
  });

  it("mismo punto de partida: si la vivienda se revaloriza a r y no hay renta ni costes, A = B = C", () => {
    const input = makeInput({ economics: { purchasePrice: 10_000_000, purchaseCosts: 0, purchaseYear: 2020 } });
    const r = simulate(input, assumptions({ ...zero, appreciationPct: 3, opportunityRatePct: 3 }), 10, ctx(300000, 0));
    const expected = 300000 * 1.03 ** 10;
    expect(r.sellNow!.wealth).toBeCloseTo(expected);
    expect(r.rentThenSell!.wealth).toBeCloseTo(expected);
    expect(r.keep!.wealth).toBeCloseTo(expected);
    expect(r.initial.equity).toBe(300000);
  });

  it("C no duplica ni resta la venta: C = caja + valor bruto − hipoteca, y C − B = gastos e impuestos latentes", () => {
    const input = makeInput({ economics: { purchasePrice: 150000, purchaseCosts: 10000, purchaseYear: 2010, cadastralValueLand: 30000, cadastralValueTotal: 90000, mortgageBalance: 60000, mortgageRate: 3, mortgageYearsLeft: 15 } });
    const r = simulate(input, assumptions(), 10, ctx(300000, 1000));
    const k = r.keep!;
    expect(k.wealth).toBeCloseTo(k.accumulatedCash + k.propertyValueGross - k.mortgageBalance);
    expect(k.wealth - r.rentThenSell!.wealth).toBeCloseTo(k.latentSaleCosts);
    expect(k.latentSaleCosts).toBeGreaterThan(0);
  });

  it("precio, gastos, impuestos y neto se distinguen y cuadran", () => {
    const input = makeInput({ economics: { purchasePrice: 200000, purchaseCosts: 15000, purchaseYear: 2015, cadastralValueLand: 40000, cadastralValueTotal: 100000, mortgageBalance: 50000, mortgageRate: 3, mortgageYearsLeft: 10 } });
    const b = simulate(input, assumptions(), 5, ctx(300000, 1000)).sellNow!.breakdown;
    expect(b.transactionCosts).toBeCloseTo(b.agencyFees + b.notaryAndOther + b.mortgageCancellation + b.earlyRepaymentFee);
    expect(b.agencyFees).toBeCloseTo(300000 * 0.03 * 1.21);
    expect(b.taxesTotal).toBeCloseTo(b.plusvalia.amount! + b.gainTax.amount!);
    expect(b.net).toBeCloseTo(b.salePrice - b.transactionCosts - b.taxesTotal - b.mortgagePayoff);
    expect(b.complete).toBe(true);
  });
});

describe("casos obligatorios", () => {
  it("sin precio de venta: no se calculan A, B ni C (nunca con 0 €) y no hay sensibilidad", () => {
    const r = simulate(makeInput(), assumptions(), 5, ctx(null, 1000));
    expect(r.sellNow).toBeNull();
    expect(r.rentThenSell).toBeNull();
    expect(r.keep).toBeNull();
    expect(r.initial.equity).toBeNull();
    expect(r.rental).not.toBeNull(); // el flujo de caja del alquiler sí se puede calcular
    expect(r.incomplete.join()).toMatch(/Valor de venta/);
    const s = sensitivity(makeInput(), assumptions(), 5, ctx(null, 1000));
    expect(s.every((x) => !x.available && x.impact == null)).toBe(true);
  });

  it("hipoteca pendiente: se resta del patrimonio inicial, la cuota sale del flujo y el saldo baja", () => {
    const input = makeInput({ economics: { purchasePrice: 200000, purchaseCosts: 0, purchaseYear: 2015, mortgageBalance: 100000, mortgageRate: 3, mortgageYearsLeft: 20 } });
    const r = simulate(input, assumptions(zero), 5, ctx(300000, 1000));
    expect(r.initial.equity).toBe(200000);
    expect(r.sellNow!.breakdown.mortgagePayoff).toBe(100000);
    const y1 = r.rental!.rows[0];
    expect(y1.interest + y1.principal).toBeCloseTo(monthlyPayment(100000, 3, 20) * 12, 0);
    expect(r.keep!.mortgageBalance).toBeLessThan(100000);
    expect(r.rentThenSell!.finalSale.mortgagePayoff).toBeCloseTo(r.keep!.mortgageBalance);
  });

  it("alquiler con desocupación: renta cobrada proporcional e imputación del periodo vacío", () => {
    const input = makeInput({ economics: { cadastralValueTotal: 100000 } });
    const a = assumptions({ ...zero, vacancyMonths: 2 });
    const r = simulate(input, a, 1, ctx(300000, 1000, 50));
    const y = r.rental!.rows[0];
    expect(y.collectedRent).toBeCloseTo(10000);
    expect(y.vacancyLoss).toBeCloseTo(2000);
    // ES, sin amortización conocida: 10.000 × 50 % × 30 % + imputación 100.000 × 1,1 % × 2/12 × 30 %
    expect(y.incomeTax).toBeCloseTo(1500 + 55);
  });

  it("datos fiscales insuficientes: la venta se marca incompleta y no se suman impuestos inventados", () => {
    const r = simulate(makeInput(), assumptions(), 5, ctx(300000, 1000, null));
    const b = r.sellNow!.breakdown;
    expect(b.gainTax.amount).toBeNull();
    expect(b.plusvalia.amount).toBeNull();
    expect(b.complete).toBe(false);
    expect(b.taxesTotal).toBe(0);
    expect(r.rental!.taxComplete).toBe(false);
    expect(r.incomplete.join()).toMatch(/Impuestos del alquiler/);
  });

  it("comparativa a 1, 3, 5 y 10 años con el mismo punto de partida", () => {
    const input = makeInput({ economics: { purchasePrice: 200000, purchaseCosts: 10000, purchaseYear: 2015 } });
    const res = [1, 3, 5, 10].map((h) => simulate(input, assumptions(), h, ctx(300000, 1000)));
    res.forEach((r, i) => {
      expect(r.horizon).toBe([1, 3, 5, 10][i]);
      expect(r.rental!.rows).toHaveLength(r.horizon);
      expect(r.initial.equity).toBe(res[0].initial.equity);
      expect(r.sellNow!.breakdown.net).toBeCloseTo(res[0].sellNow!.breakdown.net);
    });
  });
});

describe("sensibilidad", () => {
  const input = makeInput({ economics: { purchasePrice: 200000, purchaseCosts: 10000, purchaseYear: 2015 } });
  const s = sensitivity(input, assumptions(), 5, ctx(300000, 1000));
  const by = Object.fromEntries(s.map((x) => [x.key, x]));

  it("el valor de venta ±10 % se propaga (antes daba 0 €)", () => {
    expect(by.saleValue.available).toBe(true);
    expect(by.saleValue.impact).toBeGreaterThan(100);
    expect(by.saleValue.down).not.toBeCloseTo(by.saleValue.up!);
  });

  it("cada variable mueve B − A en el sentido esperado", () => {
    const up = (k: string) => by[k].up! - by[k].base!;
    expect(up("monthlyRent")).toBeGreaterThan(0);
    expect(up("vacancyMonths")).toBeLessThan(0);
    expect(up("fixedCosts")).toBeLessThan(0);
    expect(up("appreciationPct")).toBeGreaterThan(0);
    expect(up("opportunityRatePct")).toBeLessThan(0);
  });

  it("ordenada de mayor a menor impacto", () => {
    for (let i = 1; i < s.length; i++) expect(s[i - 1].impact!).toBeGreaterThanOrEqual(s[i].impact!);
  });

  it("sin renta: la variable de alquiler no se calcula", () => {
    const t = sensitivity(input, assumptions(), 5, ctx(300000, null));
    expect(t.every((x) => !x.available)).toBe(true);
  });
});

describe("escenarios de impago y ocupación", () => {
  const base = { monthlyRent: 1000, fixedCostsYear: 1200, monthlyMortgageInterest: 0, opportunityRatePct: 0, assumptions: { ...DEFAULT_RISK_ASSUMPTIONS } };

  it("impago 6 meses: desglose completo", () => {
    const r = riskScenario({ ...base, type: "ARREARS", months: 6 });
    expect(r.unpaidRent).toBe(6000);
    expect(r.depositApplied).toBe(1000);
    expect(r.reletLoss).toBe(1000);
    expect(r.lostIncome).toBe(6000);
    expect(r.ordinaryExpenses).toBe(600);
    expect(r.legalCosts).toBe(DEFAULT_RISK_ASSUMPTIONS.riskLegalArrears);
    expect(r.total).toBe(r.lostIncome + r.ordinaryExpenses + r.legalCosts + r.repairs + r.otherCosts);
    expect(r.incrementalCost).toBe(r.lostIncome + r.legalCosts + r.repairs); // sin gastos ordinarios (se pagan igualmente)
  });

  it("las hipótesis manuales modifican el resultado", () => {
    const r = riskScenario({ ...base, type: "EVICTION_ARREARS", months: 6, assumptions: { ...DEFAULT_RISK_ASSUMPTIONS, riskLegalEviction: 4000 } });
    expect(r.legalCosts).toBe(4000);
  });

  it("recuperación por otras causas: el inquilino sigue pagando", () => {
    const r = riskScenario({ ...base, type: "RECOVERY_OTHER", months: 12 });
    expect(r.unpaidRent).toBe(0);
    expect(r.ordinaryExpenses).toBe(0);
    expect(r.lostIncome).toBe(1000);
  });

  it("ocupación sin título: renta de mercado perdida, sin fianza", () => {
    const r = riskScenario({ ...base, type: "SQUATTING", months: 3 });
    expect(r.unpaidRent).toBe(3000);
    expect(r.depositApplied).toBe(0);
  });

  it("los costes crecen con la duración (3, 6 y 12 meses)", () => {
    const totals = [3, 6, 12].map((m) => riskScenario({ ...base, type: "EVICTION_ARREARS", months: m }).total);
    expect(totals[0]).toBeLessThan(totals[1]);
    expect(totals[1]).toBeLessThan(totals[2]);
  });

  it("intereses y coste de oportunidad en «otros costes»", () => {
    const r = riskScenario({ ...base, monthlyMortgageInterest: 200, opportunityRatePct: 4, type: "ARREARS", months: 12 });
    expect(r.otherCosts).toBeCloseTo(200 * 12 + (12000 - 1000) * 0.04);
  });
});

it("las hipótesis por defecto no incluyen valores de venta ni renta inventados", () => {
  const { values } = buildDefaultAssumptions(makeInput());
  expect(values.saleValue).toBeNull();
  expect(values.monthlyRent).toBeNull();
  expect(values.ibiYear).toBeNull(); // sin valor catastral ni recibo
  expect(DEFAULT_ASSUMPTIONS).not.toHaveProperty("rentalReductionPct");
});
