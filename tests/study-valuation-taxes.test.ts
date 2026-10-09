import { describe, expect, it } from "vitest";
import { estimateRent, estimateSale, grossYield } from "@/services/study/valuation";
import {
  annualAmortization,
  capitalGainsTax,
  determineRentalReduction,
  imputedIncomeTax,
  plusvaliaCoefficient,
  plusvaliaMunicipal,
  rentalIncomeTaxYear,
  savingsTax,
} from "@/services/study/taxes";
import { determineRentRegime } from "@/services/study/rentRegime";
import { SERPAVI_FIXTURE, emptySnapshot, makeInput, series } from "./study-fixtures";

const noCtx = { serpavi: null, rentIndex: null, priceIndexCcaa: null, marketRefs: [], exampleData: null };

describe("valoración: prioridades y trazabilidad", () => {
  it("sin datos ni fuentes no inventa un valor de venta", () => {
    expect(estimateSale(makeInput(), noCtx)).toEqual([]);
  });

  it("prioriza la tasación aportada por el propietario", () => {
    const input = makeInput({ economics: { ownerValuation: { kind: "APPRAISAL", value: 300000 }, purchasePrice: 150000, purchaseYear: 2015 } });
    const [first, second] = estimateSale(input, { ...noCtx, priceIndexCcaa: series([["2015", 50], ["2025", 100]]) });
    expect(first.origin).toBe("OWNER");
    expect(first.value).toBe(300000);
    expect(second.origin).toBe("MODEL");
    expect(second.value).toBe(300000); // 150.000 × 100/50
  });

  it("actualiza el precio de compra con el IPV y suma reformas", () => {
    const input = makeInput({ economics: { purchasePrice: 200000, purchaseYear: 2012, improvementsCost: 10000 } });
    const [est] = estimateSale(input, { ...noCtx, priceIndexCcaa: series([["2012", 80], ["2025", 120]]) });
    expect(est.value).toBe(310000);
    expect(est.source.period).toBe("2012–2025");
  });

  it("comparables autorizados: mediana e intervalo P25–P75, etiquetados como precio de anuncio", () => {
    const comps = [3000, 3200, 3400, 3600, 3800, 9000].map((m2, i) => ({ price: m2 * 80, sqm: i === 5 ? 200 : 80, pricePerM2: m2, operation: "sale" as const, observedAt: "2026-10-01" }));
    const [est] = estimateSale(makeInput(), { ...noCtx, saleComparables: comps, comparablesSource: "Proveedor autorizado" });
    expect(est.origin).toBe("MARKET_OBSERVED");
    expect(est.value).toBe(3400 * 80); // el de 200 m² queda fuera del ±30 %
    expect(est.low).toBe(3200 * 80);
    expect(est.high).toBe(3600 * 80);
    expect(est.limitations.join(" ")).toMatch(/ANUNCIO/);
  });

  it("menos de 5 comparables: no se estima", () => {
    const comps = [3000, 3200].map((m2) => ({ price: m2 * 80, sqm: 80, pricePerM2: m2, operation: "sale" as const, observedAt: "2026-10-01" }));
    expect(estimateSale(makeInput(), { ...noCtx, saleComparables: comps })).toEqual([]);
  });

  it("datos de ejemplo: EJEMPLO con confianza muy baja", () => {
    const [est] = estimateSale(makeInput(), { ...noCtx, exampleData: { saleM2: 3000, rentM2: 10 } });
    expect(est.origin).toBe("EXAMPLE");
    expect(est.confidence).toBe("VERY_LOW");
  });

  it("alquiler: SERPAVI es una referencia estadística separada de la estimación de mercado", () => {
    const { statistical, market } = estimateRent(makeInput(), { ...noCtx, serpavi: SERPAVI_FIXTURE });
    expect(statistical?.origin).toBe("OFFICIAL");
    expect(statistical?.value).toBe(590); // 7,38 × 80 = 590,4
    expect(statistical?.low).toBe(470);
    expect(statistical?.high).toBe(750);
    expect(statistical?.adjustments.every((x) => /IPVA/.test(x.label))).toBe(true); // sin ajustes por características
    expect(market).toEqual([]);
  });

  it("alquiler: tipología unifamiliar para casas y actualización con IPVA", () => {
    const input = makeInput({ property: { kind: "CASA_INDEPENDIENTE", sqm: 100 } });
    const { statistical } = estimateRent(input, { ...noCtx, serpavi: SERPAVI_FIXTURE, rentIndex: series([["2024", 100], ["2025", 110]]) });
    expect(statistical?.value).toBe(550); // 4,97 × 1,10 × 100
  });

  it("rentabilidad bruta", () => {
    expect(grossYield(1000, 240000)).toBeCloseTo(0.05);
    expect(grossYield(1000, 0)).toBeNull();
  });
});

describe("impuestos de la venta", () => {
  it("escala del ahorro por tramos", () => {
    expect(savingsTax(6000)).toBeCloseTo(1140);
    expect(savingsTax(50000)).toBeCloseTo(1140 + 44000 * 0.21);
    expect(savingsTax(400000)).toBeCloseTo(1140 + 9240 + 34500 + 27000 + 30000);
  });

  it("sin precio de compra: no calculable, nunca 0 €", () => {
    const r = capitalGainsTax({ salePrice: 300000, saleCosts: 0, purchasePrice: null, purchaseCosts: null, improvements: null, residence: "ES", isPrimaryResidence: false, over65: "NO" });
    expect(r.amount).toBeNull();
    expect(r.status).toBe("NOT_COMPUTABLE");
    expect(r.gain).toBeNull();
  });

  it("ganancia = (precio − gastos de venta) − (compra + gastos + mejoras − amortizaciones)", () => {
    const r = capitalGainsTax({ salePrice: 300000, saleCosts: 12000, purchasePrice: 200000, purchaseCosts: 15000, improvements: 5000, accumulatedAmortization: 10000, residence: "ES", isPrimaryResidence: false, over65: "NO" });
    expect(r.transferValue).toBe(288000);
    expect(r.acquisitionValue).toBe(210000);
    expect(r.gain).toBe(78000);
    expect(r.amount).toBe(Math.round(savingsTax(78000)));
    expect(r.status).toBe("COMPLETE");
  });

  it("gastos de compra desconocidos: cálculo marcado como incompleto", () => {
    const r = capitalGainsTax({ salePrice: 300000, saleCosts: 0, purchasePrice: 200000, purchaseCosts: null, improvements: null, residence: "ES", isPrimaryResidence: false, over65: "NO" });
    expect(r.status).toBe("INCOMPLETE");
    expect(r.missing.join()).toMatch(/Gastos/);
  });

  it("exención por vivienda habitual de mayor de 65 años (dato declarado, sin otros usos)", () => {
    const r = capitalGainsTax({ salePrice: 300000, saleCosts: 10000, purchasePrice: 100000, purchaseCosts: 0, improvements: 0, residence: "ES", isPrimaryResidence: true, over65: "YES" });
    expect(r.amount).toBe(0);
    expect(r.status).toBe("EXEMPT");
  });

  it("no residentes: 19 % sobre la ganancia", () => {
    const r = capitalGainsTax({ salePrice: 300000, saleCosts: 10000, purchasePrice: 190000, purchaseCosts: 0, improvements: 0, residence: "EU_EEA", isPrimaryResidence: false, over65: "UNDISCLOSED" });
    expect(r.gain).toBe(100000);
    expect(r.amount).toBe(19000);
  });

  it("plusvalía: no sujeta si no hay incremento", () => {
    const r = plusvaliaMunicipal({ salePrice: 200000, purchasePrice: 250000, yearsHeld: 5, cadastralLand: 30000, cadastralTotal: 80000, ratePct: 30 });
    expect(r.amount).toBe(0);
    expect(r.status).toBe("NOT_SUBJECT");
  });

  it("plusvalía: elige el método más favorable y documenta la fórmula", () => {
    const r = plusvaliaMunicipal({ salePrice: 300000, purchasePrice: 280000, yearsHeld: 10, cadastralLand: 40000, cadastralTotal: 100000, ratePct: 30 });
    // objetivo: 40.000 × 0,08 × 30 % = 960 ; real: 20.000 × 40 % × 30 % = 2.400
    expect(r.method).toBe("OBJETIVO");
    expect(r.amount).toBe(960);
    expect(r.status).toBe("COMPLETE");
    expect(r.formula).toMatch(/40000/);
    expect(plusvaliaCoefficient(25)).toBe(0.45);
  });

  it("plusvalía: sin valor catastral del suelo pide el dato", () => {
    const r = plusvaliaMunicipal({ salePrice: 300000, purchasePrice: 200000, yearsHeld: 10, cadastralLand: null, cadastralTotal: null, ratePct: 30 });
    expect(r.amount).toBeNull();
    expect(r.missing.join()).toMatch(/suelo/);
  });
});

describe("impuestos del alquiler", () => {
  it("amortización: 3 % del mayor entre coste y valor catastral, sin suelo, + mejoras", () => {
    const r = annualAmortization({ purchasePrice: 200000, purchaseCosts: 20000, improvements: 10000, cadastralLand: 40000, cadastralTotal: 100000 });
    expect(r.known).toBe(true);
    expect(r.amount).toBeCloseTo(220000 * 0.6 * 0.03 + 10000 * 0.03); // 3.960 + 300
    // si el valor catastral supera el coste, se usa el catastral
    expect(annualAmortization({ purchasePrice: 50000, purchaseCosts: 0, improvements: 0, cadastralLand: 40000, cadastralTotal: 100000 }).amount).toBeCloseTo(1800);
    expect(annualAmortization({ purchasePrice: 200000, purchaseCosts: 0, improvements: 0, cadastralLand: null, cadastralTotal: null }).known).toBe(false);
  });

  const year = {
    collectedRent: 12000,
    occupancyFraction: 1,
    fixedCosts: 2000,
    maintenance: 0,
    management: 0,
    interest: 0,
    amortizationYear: 3960,
    residence: "ES" as const,
    marginalRatePct: 30,
    reductionPct: 50 as number | null,
    cadastralTotal: 100000,
  };

  it("residente: (renta − gastos − amortización) × (1 − reducción) × tipo marginal", () => {
    const r = rentalIncomeTaxYear(year);
    expect(r.netIncome).toBeCloseTo(6040);
    expect(r.tax).toBeCloseTo(6040 * 0.5 * 0.3);
    expect(r.status).toBe("COMPLETE");
  });

  it("reducción desconocida: se calcula sin reducción y se marca incompleto", () => {
    const r = rentalIncomeTaxYear({ ...year, reductionPct: null });
    expect(r.tax).toBeCloseTo(6040 * 0.3);
    expect(r.status).toBe("INCOMPLETE");
  });

  it("desocupación: gastos fijos y amortización prorrateados e imputación del periodo vacío", () => {
    const r = rentalIncomeTaxYear({ ...year, collectedRent: 6000, occupancyFraction: 0.5 });
    expect(r.deductibleExpenses).toBeCloseTo(1000);
    expect(r.amortization).toBeCloseTo(1980);
    expect(r.imputedIncomeTax).toBeCloseTo(100000 * 0.011 * 0.5 * 0.3);
  });

  it("intereses + conservación limitados a los ingresos", () => {
    const r = rentalIncomeTaxYear({ ...year, interest: 20000, fixedCosts: 0, amortizationYear: 0 });
    expect(r.cappedExcess).toBeCloseTo(8000);
    expect(r.tax).toBe(0);
  });

  it("no residentes UE (19 % del neto) y otros países (24 % del íntegro)", () => {
    expect(rentalIncomeTaxYear({ ...year, residence: "EU_EEA" }).tax).toBeCloseTo(6040 * 0.19);
    expect(rentalIncomeTaxYear({ ...year, residence: "OTHER" }).tax).toBeCloseTo(12000 * 0.24);
  });

  it("imputación de rentas (vivienda vacía o segunda residencia)", () => {
    expect(imputedIncomeTax({ cadastralTotal: 100000, residence: "ES", marginalRatePct: 30 }).amount).toBe(330);
    expect(imputedIncomeTax({ cadastralTotal: null, residence: "ES", marginalRatePct: 30 }).amount).toBeNull();
  });
});

describe("reducción por alquiler de vivienda (no se aplica el 50 % automáticamente)", () => {
  const base = { residence: "ES" as const, ccaaCode: "09", currentlyRented: false, contractStart: null, newContractCondition: "GENERAL" as const, tensionedStatus: "NOT_FOUND" as const, rentedLast5Years: "UNKNOWN" as const };

  it("no residentes: sin reducción", () => {
    expect(determineRentalReduction({ ...base, residence: "EU_EEA" }).pct).toBe(0);
  });
  it("territorios forales: no determinada", () => {
    expect(determineRentalReduction({ ...base, ccaaCode: "16" }).pct).toBeNull();
  });
  it("contrato vigente sin fecha: no determinada y pide el dato", () => {
    const r = determineRentalReduction({ ...base, currentlyRented: true });
    expect(r.pct).toBeNull();
    expect(r.missing.join()).toMatch(/Fecha/);
  });
  it("contrato anterior al 26-05-2023: 60 %", () => {
    expect(determineRentalReduction({ ...base, currentlyRented: true, contractStart: "2022-05" }).pct).toBe(60);
  });
  it("contrato nuevo: 50 % como supuesto, salvo condiciones acreditables", () => {
    expect(determineRentalReduction(base)).toMatchObject({ pct: 50, status: "ASSUMED" });
    expect(determineRentalReduction({ ...base, newContractCondition: "REHAB" }).pct).toBe(60);
  });
  it("70 % y 90 % solo en zona tensionada y con requisitos", () => {
    expect(determineRentalReduction({ ...base, newContractCondition: "TENSIONED_YOUNG" }).pct).toBe(50);
    expect(determineRentalReduction({ ...base, newContractCondition: "TENSIONED_YOUNG", tensionedStatus: "DECLARED" }).pct).toBe(70);
    expect(determineRentalReduction({ ...base, newContractCondition: "TENSIONED_DECREASE", tensionedStatus: "DECLARED" }).pct).toBe(50);
    expect(determineRentalReduction({ ...base, newContractCondition: "TENSIONED_DECREASE", tensionedStatus: "DECLARED", rentedLast5Years: "YES" }).pct).toBe(90);
  });
});

describe("régimen legal de la renta (Ley 12/2023)", () => {
  const declared = { ...emptySnapshot().tensioned, status: "DECLARED" as const, summary: "Declarada", validFrom: "2024-10-10", validTo: "2027-10-10" };
  const base = { tensioned: declared, currentlyRented: false, currentRent: null, landlordBracket: "1_4" as const, rentedLast5Years: "YES" as const, previousRent: 850 };

  it("zona tensionada con contrato anterior: tope = renta anterior", () => {
    const r = determineRentRegime(base);
    expect(r.status).toBe("CAP_PREVIOUS_RENT");
    expect(r.capMonthly).toBe(850);
    expect(r.source.validFrom).toBe("2024-10-10");
  });
  it("gran tenedor: índice de referencia, sin inventar el importe", () => {
    const r = determineRentRegime({ ...base, landlordBracket: "OVER_10" });
    expect(r.status).toBe("CAP_REFERENCE_INDEX");
    expect(r.capMonthly).toBe(850); // solo límite superior conocido
    expect(r.missing.join()).toMatch(/índice de referencia/);
    expect(determineRentRegime({ ...base, landlordBracket: "OVER_10", rentedLast5Years: "NO", previousRent: null }).capMonthly).toBeNull();
  });
  it("faltan datos: estado desconocido con lista de requisitos", () => {
    const r = determineRentRegime({ ...base, rentedLast5Years: "UNKNOWN", previousRent: null, landlordBracket: "UNDISCLOSED" });
    expect(r.status).toBe("UNKNOWN");
    expect(r.capMonthly).toBeNull();
    expect(r.missing.length).toBeGreaterThan(0);
  });
  it("fuera de zona tensionada: sin tope específico", () => {
    expect(determineRentRegime({ ...base, tensioned: emptySnapshot().tensioned }).status).not.toMatch(/^CAP_/);
  });
});
