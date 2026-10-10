// Valor de mercado con el mapa de valores del Catastro y anexos (garaje, trastero, amarre, piscina).
// Datos FICTICIOS de prueba (la zona imita la estructura real que publica el Catastro).
import { describe, expect, it } from "vitest";
import { estimateAnnexes, estimateSale } from "@/services/study/valuation";
import { featureContains, toWebMercator } from "@/services/study/sources/catastroValues";
import type { CatastroValueZone } from "@/services/study/types";
import { makeInput } from "./study-fixtures";

const ZONE: CatastroValueZone = {
  year: 2026,
  zone: "R12",
  athCode: "119",
  residential: { mvmM2: 2660, typology: "Vivienda colectiva", category: "Media", ageYears: 40, conservation: "Normal", sqm: 90, annexSqm: null, plotSqm: null, dwellings: 199 },
  garage: { value: 18000, typology: "Garaje - aparcamiento", sqm: 25, units: 36 },
  source: { name: "Dirección General del Catastro · Mapa de valores urbano 2026 (prueba)", url: "https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?buscar=S", status: "OK", retrievedAt: "2026-10-10", note: "Ficticio." },
};
const base = { serpavi: null, rentIndex: null, priceIndexCcaa: null, marketRefs: [], exampleData: null };

describe("valor de mercado con el mapa de valores del Catastro", () => {
  it("es la estimación principal sin datos del propietario, con fuente y fecha", () => {
    const input = makeInput({ property: { kind: "PISO", sqm: 100, parking: false, storage: false, condition: "GOOD", outdoor: "NONE" } });
    const [main] = estimateSale(input, { ...base, valueZone: ZONE });
    expect(main.origin).toBe("OFFICIAL");
    expect(main.value).toBe(266000);
    expect(main.confidence).toBe("MEDIUM");
    expect(main.method).toMatch(/zona R12 \(2026\): 2\.?660 €\/m²/);
    expect(main.source.name).toMatch(/Catastro/);
    expect(main.source.retrievedAt).toBe("2026-10-10");
    expect(main.limitations.join(" ")).toMatch(/compraventa escriturados/);
  });

  it("baja la confianza si la vivienda representativa es de otro tipo", () => {
    const input = makeInput({ property: { kind: "CASA_INDEPENDIENTE", sqm: 150 } });
    const [main] = estimateSale(input, { ...base, valueZone: ZONE });
    expect(main.confidence).toBe("LOW");
    expect(main.limitations.join(" ")).toMatch(/otro tipo/);
  });

  it("el valor del propietario sigue teniendo prioridad", () => {
    const input = makeInput({ economics: { ownerValuation: { value: 310000, kind: "APPRAISAL" } } });
    const [main] = estimateSale(input, { ...base, valueZone: ZONE });
    expect(main.origin).toBe("OWNER");
  });
});

describe("anexos", () => {
  it("garaje: módulo oficial por plaza, sin aplicar además el % de ajuste", () => {
    const input = makeInput({ property: { kind: "PISO", sqm: 100, parking: true, parkingSpaces: 2, condition: "GOOD", outdoor: "NONE", storage: false } });
    const [main] = estimateSale(input, { ...base, valueZone: ZONE });
    expect(main.adjustments.some((a) => /aparcamiento/i.test(a.label))).toBe(false);
    expect(main.dwellingValue).toBe(266000);
    expect(main.annexes?.[0]).toMatchObject({ kind: "PARKING", value: 36000, origin: "OFFICIAL" });
    expect(main.value).toBe(302000);
  });

  it("garaje sin dato oficial: se mantiene el ajuste % visible", () => {
    const input = makeInput({ property: { parking: true, storage: false } });
    const [main] = estimateSale(input, { ...base, valueZone: { ...ZONE, garage: null } });
    expect(main.adjustments.some((a) => /aparcamiento/i.test(a.label))).toBe(true);
    expect(main.annexes ?? []).toHaveLength(0);
  });

  it("el valor indicado por el propietario manda; trastero por hipótesis visible; amarre sin dato no se suma", () => {
    const input = makeInput({
      property: { kind: "PISO", sqm: 100, parking: true, parkingValue: 25000, storage: true, storageSqm: 8, mooringLengthM: 10, pool: "COMMUNITY", condition: "GOOD", outdoor: "NONE" },
    });
    const lines = estimateAnnexes(input, { ...base, valueZone: ZONE }, 2660);
    expect(lines.find((l) => l.kind === "PARKING")).toMatchObject({ value: 25000, origin: "OWNER" });
    expect(lines.find((l) => l.kind === "STORAGE")).toMatchObject({ value: 5300, origin: "ASSUMPTION" });
    const mooring = lines.find((l) => l.kind === "MOORING")!;
    expect(mooring.value).toBeNull();
    expect(mooring.method).toMatch(/no hay una fuente oficial/);
    const [main] = estimateSale(input, { ...base, valueZone: ZONE });
    expect(main.adjustments).toContainEqual({ label: "Piscina comunitaria", pct: 2 });
    // 266.000 × 1,02 (piscina) = 271.320 → 271.000 + garaje 25.000 + trastero 5.400 (8 × 2.713,2 × 25 %)
    expect(main.value).toBe(main.dwellingValue! + 25000 + main.annexes!.find((l) => l.kind === "STORAGE")!.value!);
  });

  it("amarre con valor aportado sí se suma", () => {
    const input = makeInput({ property: { mooringLengthM: 12, mooringValue: 60000, parking: false, storage: false } });
    const [main] = estimateSale(input, { ...base, valueZone: ZONE });
    expect(main.annexes?.find((l) => l.kind === "MOORING")?.value).toBe(60000);
    expect(main.value - main.dwellingValue!).toBe(60000);
  });
});

describe("geometría", () => {
  it("convierte a Web Mercator y localiza el punto en la zona", () => {
    const { x, y } = toWebMercator(42.2690501706262, 3.14517123330834);
    expect(Math.abs(x - 350117.957)).toBeLessThan(2);
    expect(Math.abs(y - 5201367.757)).toBeLessThan(2);
    const square = { geometry: { type: "Polygon" as const, coordinates: [[[3, 42], [3.2, 42], [3.2, 42.4], [3, 42.4], [3, 42]]] as Array<Array<[number, number]>> }, properties: {} };
    expect(featureContains(square, 3.145, 42.269)).toBe(true);
    expect(featureContains(square, 3.5, 42.269)).toBe(false);
  });
});
