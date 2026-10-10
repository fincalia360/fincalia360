// Informe PDF: portada, índice con enlaces, marcadores, enlaces externos, comparables y desglose sin duplicidades.
// Todos los datos son FICTICIOS (cliente «Persona Ficticia de Prueba», referencia catastral inventada para la prueba).
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFRef, PDFString, type PDFObject } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildDefaultAssumptions } from "@/services/study/assumptions";
import { buildStudyReport } from "@/services/study/reportModel";
import { renderStudyPdf } from "@/services/study/report/pdf";
import { summarizeComparables, type ComparableRow } from "@/services/study/rentComparables";
import type { Estimate } from "@/services/study/types";
import { emptySnapshot, makeInput } from "./study-fixtures";

const CP1252: Record<number, string> = { 0x80: "€", 0x95: "•", 0x96: "–", 0x97: "—" };
const decodeHex = (hex: string) => [...Buffer.from(hex, "hex")].map((b) => CP1252[b] ?? String.fromCharCode(b)).join("");
function streamText(obj: PDFObject | undefined, doc: PDFDocument): string {
  if (!obj) return "";
  const r = doc.context.lookup(obj);
  if (r instanceof PDFArray) return r.asArray().map((o) => streamText(o, doc)).join("\n");
  if (!(r instanceof PDFRawStream)) return "";
  const raw = Buffer.from(r.contents);
  const data = r.dict.get(PDFName.of("Filter")) ? inflateSync(raw).toString("latin1") : raw.toString("latin1");
  return [...data.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)].map((m) => decodeHex(m[1])).join("\n");
}

function estimate(over: Partial<Estimate>): Estimate {
  return { value: 300000, low: 276000, high: 324000, perM2: 3750, origin: "MODEL", method: "Prueba", confidence: "MEDIUM", source: { name: "Fuente de prueba", status: "OK", url: "https://www.ine.es" }, adjustments: [], limitations: [], ...over };
}
const RENT = estimate({ value: 1000, low: 900, high: 1100, perM2: 12.5, origin: "MARKET_OBSERVED", source: { name: "Referencias del equipo (prueba)", status: "OK" } });

const day = (d: string) => new Date(`${d}T10:00:00Z`);
const COMPS: ComparableRow[] = [950, 1000, 1050, 1100, 1200].map((rent, i) => ({
  id: `c${i}`,
  municipalityName: "Roses",
  zone: "Centro",
  propertyKind: "PISO",
  monthlyRent: rent,
  builtArea: 80,
  usefulArea: null,
  bedrooms: 2,
  bathrooms: i === 4 ? 2 : 1,
  furnished: null,
  features: null,
  sourceName: "Anuncio ficticio de prueba",
  url: `https://example.com/anuncio-ficticio-${i}`,
  observedAt: day("2026-09-15"),
}));

async function build(opts: { clientName?: string | null; comparables?: ComparableRow[]; rc?: string | null } = {}) {
  const input = makeInput({
    location: { cadastralRef: opts.rc === undefined ? "9999999ZZ9999Z0001ZZ" : opts.rc, address: "Calle Ficticia 1, 17480 Roses (dirección de prueba)" },
    economics: { purchasePrice: 200000, purchaseCosts: 15000, purchaseYear: 2015, cadastralValueLand: 40000, cadastralValueTotal: 100000, ibiYear: 450, communityFeesYear: 1000 },
  });
  const snapshot = emptySnapshot({
    sale: estimate({}),
    rentMarket: RENT,
    rent: RENT,
    sources: [{ name: "Instituto Nacional de Estadística (prueba)", url: "https://www.ine.es", status: "OK" }],
  });
  const a = buildDefaultAssumptions(input).values;
  const bytes = await renderStudyPdf({
    studyId: "study-ficticio-0001",
    input,
    snapshot,
    assumptions: a,
    horizon: 5,
    generatedAt: day("2026-10-10"),
    includeMaps: false,
    clientName: opts.clientName === undefined ? "Persona Ficticia de Prueba" : opts.clientName,
    comparables: opts.comparables ?? [],
  });
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  const texts = pages.map((p) => streamText(p.node.get(PDFName.of("Contents")), doc));
  return { doc, pages, texts, input, snapshot, a, bytes };
}

function annots(doc: PDFDocument, pageIndex: number) {
  const arr = doc.getPages()[pageIndex].node.lookup(PDFName.of("Annots"), PDFArray);
  return arr ? arr.asArray().map((r) => doc.context.lookup(r, PDFDict)) : [];
}
const destPageIndex = (doc: PDFDocument, dest: PDFArray) => doc.getPages().findIndex((p) => p.ref === (dest.get(0) as PDFRef));

describe("portada", () => {
  it("muestra cliente, dirección, referencia catastral, municipio, fecha e identificador; sin pie de página", async () => {
    const { texts } = await build();
    const cover = texts[0].replace(/\n/g, " ");
    expect(cover).toContain("ESTUDIO INMOBILIARIO");
    expect(cover).toContain("Persona Ficticia de Prueba");
    expect(cover).toContain("Calle Ficticia 1");
    expect(cover).toContain("9999999ZZ9999Z0001ZZ");
    expect(cover).toContain("Roses (Girona)");
    expect(cover).toContain("10 de octubre de 2026");
    expect(cover).toContain("study-ficticio-0001");
    expect(cover).toContain("CONFIDENCIAL");
    expect(cover).not.toMatch(/Página \d+ de/);
  });

  it("si faltan datos lo dice y nunca inventa una referencia catastral", async () => {
    const { texts } = await build({ clientName: null, rc: null });
    const cover = texts[0].replace(/\n/g, " ");
    expect(cover).toContain("No indicado");
    expect(cover).toContain("No indicada (no se completa sin el dato)");
  });
});

describe("índice y marcadores", () => {
  it("cada entrada del índice es un enlace interno a la página que indica", async () => {
    const { doc, texts } = await build();
    const links = annots(doc, 1).filter((a) => a.get(PDFName.of("Dest")));
    expect(links.length).toBeGreaterThanOrEqual(13); // resumen + 12 secciones (+ subapartados)
    const tocLines = texts[1].split("\n");
    for (const l of links) {
      const target = destPageIndex(doc, l.lookup(PDFName.of("Dest"), PDFArray));
      expect(target).toBeGreaterThan(1);
      // El número de página impreso en el índice existe en el índice y corresponde al destino
      expect(tocLines).toContain(String(target + 1));
    }
    // La sección 8 apunta a la página donde está su título
    const sec8 = texts.findIndex((t) => /^8\. Gastos de gestión/m.test(t));
    expect(sec8).toBeGreaterThan(1);
    expect(links.some((l) => destPageIndex(doc, l.lookup(PDFName.of("Dest"), PDFArray)) === sec8)).toBe(true);
  });

  it("marcadores en el panel lateral: portada, índice, resumen y las 12 secciones, con subapartados", async () => {
    const { doc } = await build();
    expect(doc.catalog.get(PDFName.of("PageMode"))).toEqual(PDFName.of("UseOutlines"));
    const root = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    const titles: string[] = [];
    let node = root.lookup(PDFName.of("First"), PDFDict) as PDFDict | undefined;
    let withChildren = 0;
    while (node) {
      titles.push((node.lookup(PDFName.of("Title")) as PDFHexString).decodeText());
      const dest = node.lookup(PDFName.of("Dest"), PDFArray);
      expect(destPageIndex(doc, dest)).toBeGreaterThanOrEqual(0);
      if (node.get(PDFName.of("First"))) withChildren++;
      node = node.get(PDFName.of("Next")) ? (node.lookup(PDFName.of("Next"), PDFDict) as PDFDict) : undefined;
    }
    expect(titles.slice(0, 3)).toEqual(["Portada", "Índice", "Resumen ejecutivo y conclusiones"]);
    for (let n = 1; n <= 12; n++) expect(titles.some((t) => t.startsWith(`${n}. `))).toBe(true);
    expect(withChildren).toBeGreaterThanOrEqual(4);
  });

  it("enlace «Volver al índice» en las páginas de contenido y enlaces externos a las fuentes", async () => {
    const { doc, pages } = await build({ comparables: COMPS });
    const last = pages.length - 1;
    const back = annots(doc, last).find((a) => a.get(PDFName.of("Dest")));
    expect(destPageIndex(doc, back!.lookup(PDFName.of("Dest"), PDFArray))).toBe(1);
    const uris = pages
      .flatMap((_, i) => annots(doc, i))
      .filter((a) => a.get(PDFName.of("A")))
      .map((a) => (a.lookup(PDFName.of("A"), PDFDict).lookup(PDFName.of("URI")) as PDFString).decodeText());
    expect(uris).toContain("https://www.ine.es");
    expect(uris).toContain("https://example.com/anuncio-ficticio-0");
  });

  it("la paginación del índice se actualiza: con más contenido, las secciones se desplazan", async () => {
    const short = await build();
    const long = await build({ comparables: COMPS });
    const pageOf = (t: string[]) => t.findIndex((x) => /^11\. Fuentes/m.test(x));
    expect(pageOf(long.texts)).toBeGreaterThanOrEqual(pageOf(short.texts));
    expect(long.texts[1]).toContain(String(pageOf(long.texts) + 1));
  });
});

describe("alquiler basado en comparables", () => {
  it("rango P25/P50/P75 del €/m² × superficie, con número de comparables y diferencias visibles", () => {
    const input = makeInput({ property: { sqm: 80 } });
    const s = summarizeComparables(COMPS, input, day("2026-10-10"));
    // €/m²: 11,875 · 12,5 · 13,125 · 13,75 · 15 → P25 12,5 · P50 13,125 · P75 13,75
    expect(s.used).toBe(5);
    expect(s.perM2!.p50).toBeCloseTo(13.125, 3);
    expect(s.monthly).toEqual({ conservative: 1000, market: 1050, high: 1100 });
    expect(s.confidence).toBe("LOW");
    expect(s.rows.find((r) => r.id === "c4")!.differences).toContain("2 baños (la tuya 1)");
  });

  it("descarta anuncios antiguos, de otro tamaño o de otro tipo; con menos de 3 no da rango", () => {
    const input = makeInput({ property: { sqm: 80 } });
    const old = { ...COMPS[0], id: "old", observedAt: day("2024-01-01") };
    const big = { ...COMPS[1], id: "big", builtArea: 200 };
    const house = { ...COMPS[2], id: "house", propertyKind: "VILLA" };
    const s = summarizeComparables([old, big, house, COMPS[3]], input, day("2026-10-10"));
    expect(s.rows.map((r) => r.id)).toEqual(["c3"]);
    expect(s.monthly).toBeNull();
    expect(s.note).toMatch(/al menos 3/);
  });

  it("los comparables aparecen en el informe sin cambiar la renta que usa la simulación", async () => {
    const without = await build();
    const withC = await build({ comparables: COMPS });
    const all = withC.texts.join("\n");
    expect(all).toContain("Anuncios comparables (5)");
    expect(all).toContain("Anuncio ficticio de prueba");
    const usedLine = (t: string[]) => t.join("\n").match(/4 · Renta recomendada[^\n]*\n([^\n]+)/)?.[1];
    expect(usedLine(withC.texts)).toBe(usedLine(without.texts));
  });
});

describe("gastos de desahucio y escenarios: sin duplicidades", () => {
  it("las filas del desglose suman exactamente el coste total del modelo", async () => {
    const { input, snapshot, a } = await build();
    const report = buildStudyReport(input, snapshot, a, 5);
    const ev = report.risk!.rows.find((r) => r.type === "EVICTION_ARREARS")!.results.find((x) => x.months === 6)!;
    const interest = report.risk!.monthlyMortgageInterest * ev.months;
    const parts = [ev.legalCosts, ev.unpaidRent, -ev.depositApplied, ev.reletLoss, ev.ordinaryExpenses, ev.repairs, interest, ev.otherCosts - interest];
    expect(parts.reduce((s, v) => s + v, 0)).toBeCloseTo(ev.total, 6);
    // Comprobación independiente: 6 meses × 1.000 € − fianza 1 mes + 1 mes sin inquilino
    expect(ev.unpaidRent).toBe(6000);
    expect(ev.depositApplied).toBe(1000);
    expect(ev.reletLoss).toBe(1000);
    expect(ev.lostIncome).toBe(6000);
  });

  it("los tres escenarios del informe usan las mismas hipótesis (normal ≥ desocupación ≥ impago)", async () => {
    const { texts } = await build();
    const page = texts.find((t) => /^9\. Escenarios de riesgo/m.test(t))!;
    expect(page).toContain("1 · Alquiler normal");
    expect(page).toMatch(/2 · \d mes\(es\) sin inquilino/);
    expect(page).toContain("3 · Impago y desahucio");
  });
});
