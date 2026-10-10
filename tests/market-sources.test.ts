import { describe, expect, it } from "vitest";
import { getValorTasado } from "@/services/study/sources/valorTasado";
import { estimateRent, estimateSale } from "@/services/study/valuation";
import { SERPAVI_FIXTURE, makeInput } from "./study-fixtures";

const noCtx = { serpavi: null, rentIndex: null, priceIndexCcaa: null, marketRefs: [], exampleData: null };

describe("valor tasado oficial (Ministerio de Vivienda)", () => {
  it("usa el dato del municipio cuando existe (más de 25.000 habitantes)", () => {
    const vt = getValorTasado({ provinceCode: "08", municipalityName: "Barcelona", yearBuilt: null });
    expect(vt?.scope).toBe("MUNICIPIO");
    expect(vt?.value).toBeGreaterThan(1000);
    expect(vt?.quarter).toMatch(/^\d{4}-T[1-4]$/);
  });

  it("elige el valor según la antigüedad de la vivienda", () => {
    const old = getValorTasado({ provinceCode: "28", municipalityName: "Madrid", yearBuilt: 1970 });
    const total = getValorTasado({ provinceCode: "28", municipalityName: "Madrid", yearBuilt: null });
    expect(old?.basis).toBe("MAS_5");
    expect(total?.basis).toBe("TOTAL");
  });

  it("reconoce nombres con artículo («Ejido (El)» = «El Ejido»)", () => {
    expect(getValorTasado({ provinceCode: "04", municipalityName: "El Ejido", yearBuilt: null })?.scope).toBe("MUNICIPIO");
  });

  it("municipios pequeños: media provincial, marcada como tal", () => {
    const vt = getValorTasado({ provinceCode: "17", municipalityName: "Roses", yearBuilt: null });
    expect(vt?.scope).toBe("PROVINCIA");
    expect(vt?.name).toBe("Girona");
  });

  it("la estimación de venta es orientativa y nunca se presenta como tasación", () => {
    const vt = getValorTasado({ provinceCode: "08", municipalityName: "Barcelona", yearBuilt: null })!;
    const input = makeInput({ location: { provinceCode: "08", municipalityName: "Barcelona", municipalityCode: "08019", postalCode: "08041" }, property: { sqm: 83 } });
    const [e] = estimateSale(input, { ...noCtx, valorTasado: vt });
    expect(e.origin).toBe("MODEL");
    expect(e.value).toBe(Math.round((vt.value * 83) / 1000) * 1000);
    expect(e.limitations.join(" ")).toMatch(/no una tasación/);
    const prov = getValorTasado({ provinceCode: "17", municipalityName: "Roses", yearBuilt: null })!;
    expect(estimateSale(makeInput(), { ...noCtx, valorTasado: prov })[0].confidence).toBe("VERY_LOW");
  });
});

describe("alquiler de contratos nuevos (Cataluña)", () => {
  it("adapta la renta media por contrato a la superficie con el perfil SERPAVI", () => {
    const newContractRent = { municipality: "Roses", period: "2026-T1", monthlyRent: 1000, contracts: 120, source: { name: "Incasòl", url: "https://example.org", retrievedAt: "2026-10-09" } };
    const { market, statistical } = estimateRent(makeInput(), { ...noCtx, serpavi: SERPAVI_FIXTURE, newContractRent });
    // La media del Incasòl es de todos los contratos (pisos y casas): superficie media ponderada de SERPAVI
    // 2024 del fixture = (1307 × 71 + 145 × 170) / 1452 = 80,9 m² → 1000 / 80,9 = 12,36 €/m² × 80 m² ≈ 990 €
    const y = SERPAVI_FIXTURE.municipality.years["2024"];
    const avgSup = (y.VC!.n * y.VC!.sup + y.VU!.n * y.VU!.sup) / (y.VC!.n + y.VU!.n);
    expect(market[0].value).toBe(Math.round(((1000 / avgSup) * 80) / 10) * 10);
    expect(market[0].value).toBe(990);
    expect(market[0].method).toMatch(/pisos y casas/);
    expect(market[0].origin).toBe("MODEL");
    expect(statistical?.origin).toBe("OFFICIAL"); // la referencia estadística se mantiene separada
  });
});
