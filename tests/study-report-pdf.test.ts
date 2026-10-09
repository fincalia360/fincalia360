import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, type PDFObject } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildDefaultAssumptions } from "@/services/study/assumptions";
import { fmtEur } from "@/services/study/format";
import { buildStudyReport } from "@/services/study/reportModel";
import { renderStudyPdf } from "@/services/study/report/pdf";
import type { Estimate, StudyInput, StudySnapshot } from "@/services/study/types";
import { emptySnapshot, makeInput } from "./study-fixtures";

// ---- Extracción del texto del PDF (fuentes estándar: cadenas hexadecimales WinAnsi) ----
const CP1252: Record<number, string> = { 0x80: "€", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—" };
function decodeHex(hex: string) {
  const bytes = Buffer.from(hex, "hex");
  return [...bytes].map((b) => CP1252[b] ?? String.fromCharCode(b)).join("");
}
function streamText(obj: PDFObject | undefined, doc: PDFDocument): string {
  if (!obj) return "";
  const resolved = doc.context.lookup(obj);
  if (resolved instanceof PDFArray) return resolved.asArray().map((o) => streamText(o, doc)).join("\n");
  if (!(resolved instanceof PDFRawStream)) return "";
  const filter = resolved.dict.get(PDFName.of("Filter"));
  const raw = Buffer.from(resolved.contents);
  const data = filter ? inflateSync(raw).toString("latin1") : raw.toString("latin1");
  return [...data.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)].map((m) => decodeHex(m[1])).join("\n");
}
async function pdfPages(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => streamText(p.node.get(PDFName.of("Contents")), doc));
}

// ---- Datos de prueba ----
function estimate(over: Partial<Estimate>): Estimate {
  return {
    value: 300000,
    low: 276000,
    high: 324000,
    perM2: 3750,
    origin: "MODEL",
    method: "Precio de compra actualizado con el IPV",
    confidence: "MEDIUM",
    source: { name: "INE · IPV", status: "OK", period: "2015–2025" },
    adjustments: [],
    limitations: ["Índice de la comunidad autónoma"],
    ...over,
  };
}
const RENT_MARKET = estimate({ value: 1000, low: 900, high: 1100, perM2: 12.5, origin: "MARKET_OBSERVED", source: { name: "Referencias del equipo", status: "OK", period: "2026-T3" } });
const RENT_STAT = estimate({ value: 850, low: 700, high: 1000, perM2: 10.6, origin: "OFFICIAL", source: { name: "SERPAVI", status: "OK", period: "2024" } });

function fullCase(): { input: StudyInput; snapshot: StudySnapshot } {
  const input = makeInput({
    economics: { purchasePrice: 200000, purchaseCosts: 15000, purchaseYear: 2015, cadastralValueLand: 40000, cadastralValueTotal: 100000, ibiYear: 450, communityFeesYear: 1000 },
  });
  return { input, snapshot: emptySnapshot({ sale: estimate({}), rentMarket: RENT_MARKET, rentStatistical: RENT_STAT, rent: RENT_MARKET }) };
}

async function render(input: StudyInput, snapshot: StudySnapshot, assumptions: unknown, horizon = 5) {
  const bytes = await renderStudyPdf({ studyId: "study-test-0001", input, snapshot, assumptions: assumptions as never, horizon, generatedAt: new Date("2026-10-09T10:00:00Z") });
  const pages = await pdfPages(bytes);
  return { bytes, pages, all: pages.join("\n") };
}
const norm = (s: string) => s.replace(/\s+/g, " ");

describe("informe: valoración completa con impuestos", () => {
  const { input, snapshot } = fullCase();
  const a = buildDefaultAssumptions(input).values;
  const report = buildStudyReport(input, snapshot, a, 5);

  it("es concluyente y el neto de la venta es completo", () => {
    expect(report.conclusive).toBe(true);
    expect(report.sale.used).toBe(300000);
    expect(report.rent.used).toBe(1000);
    expect(report.rent.usedSource).toBe("MARKET");
    expect(report.main.sellNow!.breakdown.complete).toBe(true);
    expect(Object.keys(report.byHorizon).map(Number)).toEqual([1, 3, 5, 10]);
  });

  it("las cifras de la primera página coinciden exactamente con el modelo (web = PDF)", async () => {
    const { pages, bytes } = await render(input, snapshot, a);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const p1 = pages[0];
    expect(p1).toContain(fmtEur(report.sale.used));
    expect(p1).toContain(`Intervalo ${fmtEur(276000)} – ${fmtEur(324000)}`);
    expect(p1).toContain(fmtEur(report.main.sellNow!.breakdown.net));
    expect(p1).toContain(`${fmtEur(report.rent.used)}/mes`);
    expect(p1).toContain(`${fmtEur(report.main.rental!.rows[0].cashFlow)}/año`);
    for (const h of [3, 5, 10]) {
      const s = report.byHorizon[h];
      expect(p1).toContain(fmtEur(s.sellNow!.wealth));
      expect(p1).toContain(fmtEur(s.rentThenSell!.wealth));
      expect(p1).toContain(fmtEur(s.keep!.wealth));
      expect(p1).toContain(fmtEur(s.rentThenSell!.wealth - s.sellNow!.wealth));
    }
    expect(p1).toContain("RESULTADO CON LAS HIPÓTESIS ACTUALES");
  });

  it("control de calidad: un único pie por página, títulos numerados una vez y sin cifras vacías", async () => {
    const { pages, all } = await render(input, snapshot, a);
    pages.forEach((p, i) => {
      expect(p.match(/Página \d+ de \d+/g)).toEqual([`Página ${i + 1} de ${pages.length}`]);
    });
    for (let n = 1; n <= 14; n++) expect(all.match(new RegExp(`^${n}\\. `, "gm"))?.length ?? 0).toBe(1);
    expect(all).not.toMatch(/NaN|undefined|Infinity|null €/);
    expect(all.split("\n").filter((l) => /(^|[^0-9] )€/.test(l))).toEqual([]); // ninguna unidad sin cifra
  });
});

describe("informe: casos obligatorios", () => {
  it("sin precio de venta: no concluye, pide datos y no muestra 0 € como valor", async () => {
    const input = makeInput();
    const snapshot = emptySnapshot({ rentStatistical: RENT_STAT, rent: RENT_STAT });
    const a = buildDefaultAssumptions(input).values;
    const report = buildStudyReport(input, snapshot, a, 5);
    expect(report.sale.used).toBeNull();
    expect(report.conclusive).toBe(false);
    expect(report.headline).toMatch(/No es posible concluir/);
    expect(report.main.sellNow).toBeNull();
    expect(report.sensitivity.every((s) => !s.available)).toBe(true);
    const { pages } = await render(input, snapshot, a);
    const p1 = norm(pages[0]);
    expect(p1).toContain("RESULTADO NO CONCLUYENTE");
    expect(p1).toContain("Sin valoración fiable");
    expect(p1).not.toContain("RESULTADO CON LAS");
    expect(p1).not.toMatch(/(^|[^0-9.])0 €/);
  });

  it("valor de venta manual: se usa y se identifica como dato del propietario", () => {
    const input = makeInput();
    const a = { ...buildDefaultAssumptions(input).values, saleChoice: "MANUAL", saleValue: 280000 };
    const report = buildStudyReport(input, emptySnapshot({ rentMarket: RENT_MARKET }), a, 5);
    expect(report.sale.used).toBe(280000);
    expect(report.sale.usedSource).toBe("MANUAL");
  });

  it("estudios antiguos (valor 0 = desconocido) no producen escenarios con 0 €", () => {
    const { input, snapshot } = fullCase();
    const legacy = { ...buildDefaultAssumptions(input).values, saleChoice: undefined, rentChoice: undefined, saleValue: 0, monthlyRent: 0 };
    const report = buildStudyReport(input, snapshot, legacy, 5);
    expect(report.sale.used).toBe(300000);
    expect(report.rent.used).toBe(1000);
  });

  it("zona tensionada: la renta usada se limita a la del contrato anterior", async () => {
    const { snapshot } = fullCase();
    const input = makeInput({ economics: { purchasePrice: 200000, purchaseCosts: 15000, purchaseYear: 2015 }, owner: { rentedLast5Years: "YES", previousRent: 700, landlordBracket: "1_4" } });
    const tensioned = { ...snapshot, tensioned: { ...snapshot.tensioned, status: "DECLARED" as const, summary: "Declarada", validFrom: "2024-10-10", validTo: "2027-10-10" } };
    const report = buildStudyReport(input, tensioned, buildDefaultAssumptions(input).values, 5);
    expect(report.rent.regime.status).toBe("CAP_PREVIOUS_RENT");
    expect(report.rent.requested).toBe(1000);
    expect(report.rent.used).toBe(700);
    expect(report.rent.capped).toBe(true);
    const { pages } = await render(input, tensioned, buildDefaultAssumptions(input).values);
    expect(pages[0]).toContain("700 €/mes");
    expect(norm(pages[0])).toContain("limitada al tope legal");
  });

  it("zona tensionada sin datos del contrato anterior: renta legal no determinada y se avisa", () => {
    const { input, snapshot } = fullCase();
    const tensioned = { ...snapshot, tensioned: { ...snapshot.tensioned, status: "DECLARED" as const, summary: "Declarada" } };
    const report = buildStudyReport(input, tensioned, buildDefaultAssumptions(input).values, 5);
    expect(report.rent.regime.capMonthly).toBeNull();
    expect(report.uncertainties.join(" ")).toMatch(/Renta legal/);
  });

  it("datos fiscales insuficientes: neto marcado como INCOMPLETO en la primera página", async () => {
    const input = makeInput();
    const snapshot = emptySnapshot({ sale: estimate({}), rentMarket: RENT_MARKET });
    const a = buildDefaultAssumptions(input).values;
    const report = buildStudyReport(input, snapshot, a, 5);
    expect(report.main.sellNow!.breakdown.complete).toBe(false);
    expect(report.conclusive).toBe(false); // sin precio de compra no se puede calcular el impuesto
    const { pages } = await render(input, snapshot, a);
    expect(norm(pages[0])).toContain("INCOMPLETO");
  });

  it("impago: las hipótesis modificadas en la web llegan al informe", async () => {
    const { input, snapshot } = fullCase();
    const a = { ...buildDefaultAssumptions(input).values, riskLegalEviction: 4321 };
    const report = buildStudyReport(input, snapshot, a, 5);
    const eviction = report.risk!.rows.find((r) => r.type === "EVICTION_ARREARS")!;
    expect(eviction.results.map((x) => x.months)).toEqual([3, 6, 12]);
    expect(eviction.results[1].legalCosts).toBe(4321);
    const { all } = await render(input, snapshot, a);
    expect(all).toContain(fmtEur(4321));
    expect(all).toContain(fmtEur(eviction.results[1].total));
  });

  it("alquiler con desocupación: el flujo del año 1 refleja la renta cobrada", () => {
    const { input, snapshot } = fullCase();
    const a = { ...buildDefaultAssumptions(input).values, vacancyMonths: 3 };
    const y1 = buildStudyReport(input, snapshot, a, 5).main.rental!.rows[0];
    expect(y1.collectedRent).toBeCloseTo(9000);
  });
});
