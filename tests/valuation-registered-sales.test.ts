// Orden de las estimaciones de venta: precio registrado del municipio (Cataluña) → valor tasado
// municipal → Catastro (referencia secundaria). Zona y precios FICTICIOS de prueba, salvo el
// fichero importado de la Generalitat, que se comprueba con su estructura real.
import { describe, expect, it } from "vitest";
import { getRegisteredSalePrice, type RegisteredSalePrice } from "@/services/study/sources/gencatCompravendes";
import type { ValorTasadoResult } from "@/services/study/sources/valorTasado";
import { estimateSale } from "@/services/study/valuation";
import type { CatastroValueZone } from "@/services/study/types";
import { makeInput } from "./study-fixtures";

const base = { serpavi: null, rentIndex: null, priceIndexCcaa: null, marketRefs: [], exampleData: null };

const ZONE: CatastroValueZone = {
  year: 2026,
  zone: "R17",
  athCode: "1",
  residential: { mvmM2: 1550, typology: "Vivienda colectiva", category: "Media", ageYears: 40, conservation: "Normal", sqm: 80, annexSqm: null, plotSqm: null, dwellings: 300 },
  garage: null,
  source: { name: "Dirección General del Catastro · Mapa de valores (prueba)", status: "OK", retrievedAt: "2026-10-10" },
};

const REGISTERED: RegisteredSalePrice = {
  municipality: "Municipio Ficticio",
  value: 2631.32,
  basis: "USADO",
  sales: 449,
  period: "Juliol 2025- juny 2026",
  meta: { source: "Generalitat de Catalunya · Compravendes registrades (prueba)", sourceUrl: "https://habitatge.gencat.cat", fileUrl: "https://habitatge.gencat.cat/x.xlsx", period: "Juliol 2025- juny 2026", importedAt: "2026-10-10", notes: "Prueba." },
};

const VT_MUNI = {
  scope: "MUNICIPIO",
  name: "Municipio Ficticio",
  quarter: "2026-T2",
  value: 2445.9,
  basis: "MAS_5",
  appraisals: 50,
  yearOnYearPct: null,
  meta: { source: "Ministerio de Vivienda · valor tasado (prueba)", sourceUrlMunicipios: "https://example.org/m", sourceUrlProvincias: "https://example.org/p", trimestresMunicipios: [], ultimoTrimestreProvincias: "2026-T2", importedAt: "2026-10-10", notes: "" },
} as ValorTasadoResult;

const house = () => makeInput({ property: { kind: "CASA_ADOSADA", sqm: 101, parking: false, storage: false, condition: "NEW", outdoor: "TERRACE" } });

describe("venta: precio de las compraventas registradas del municipio", () => {
  it("en Cataluña es la estimación principal, por delante del valor tasado y del Catastro", () => {
    const [main, ...alts] = estimateSale(house(), { ...base, registeredSale: REGISTERED, valorTasado: VT_MUNI, valueZone: ZONE });
    expect(main.origin).toBe("OFFICIAL");
    // 2.631,32 €/m² × 101 m² × 1,05 (reformada) × 1,03 (terraza) ≈ 287.000 €
    expect(main.value).toBe(Math.round((2631.32 * 101 * 1.05 * 1.03) / 1000) * 1000);
    expect(main.value).toBe(287000);
    expect(main.confidence).toBe("MEDIUM");
    expect(main.method).toMatch(/registradas en Municipio Ficticio/);
    expect(main.source.period).toBe("Juliol 2025- juny 2026");
    expect(main.limitations.join(" ")).toMatch(/no de anuncio/);
    expect(alts.map((a) => a.source.name)).toEqual([VT_MUNI.meta.source, ZONE.source.name]);
  });

  it("fuera de Cataluña, el valor tasado del municipio va por delante del Catastro", () => {
    const [main, second] = estimateSale(house(), { ...base, valorTasado: VT_MUNI, valueZone: ZONE });
    expect(main.source.name).toBe(VT_MUNI.meta.source);
    expect(second.source.name).toBe(ZONE.source.name);
  });

  it("la media provincial del valor tasado queda detrás del Catastro", () => {
    const prov = { ...VT_MUNI, scope: "PROVINCIA", name: "Girona" } as ValorTasadoResult;
    const [main, second] = estimateSale(house(), { ...base, valorTasado: prov, valueZone: ZONE });
    expect(main.source.name).toBe(ZONE.source.name);
    expect(second.confidence).toBe("VERY_LOW");
  });

  it("el valor aportado por el propietario sigue siendo el principal", () => {
    const input = makeInput({ economics: { ownerValuation: { kind: "APPRAISAL", value: 300000 } } });
    const [main, second] = estimateSale(input, { ...base, registeredSale: REGISTERED });
    expect(main.origin).toBe("OWNER");
    expect(second.method).toMatch(/registradas/);
  });
});

describe("fichero importado de la Generalitat", () => {
  it("devuelve el €/m² de vivienda usada de un municipio catalán y nada fuera de Cataluña", () => {
    const r = getRegisteredSalePrice("08019"); // Barcelona
    expect(r).not.toBeNull();
    expect(r!.basis).toBe("USADO");
    expect(r!.value).toBeGreaterThan(1000);
    expect(r!.sales).toBeGreaterThan(1000);
    expect(r!.meta.sourceUrl).toMatch(/^https:\/\/habitatge\.gencat\.cat\//);
    expect(getRegisteredSalePrice("28079")).toBeNull(); // Madrid
    expect(getRegisteredSalePrice(null)).toBeNull();
  });
});
