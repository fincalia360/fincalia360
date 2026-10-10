// Informe PDF del estudio (pdf-lib, sin servicios externos).
// Todas las cifras proceden de buildStudyReport(): las mismas que muestra la web.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { fmtDate, fmtEur, fmtPct } from "../format";
import { getCcaa, getProvince } from "../geo";
import { RENT_SOURCE_LABELS, buildStudyReport, type StudyReport } from "../reportModel";
import { RISK_DISCLAIMER, RISK_INFO, RISK_MONTHS } from "../risk";
import type { ScenarioResult } from "../simulator";
import { TAX_RULES_VERSION, TAX_STATUS_LABELS, imputedIncomeTax, inheritanceGuidance, type TaxLine } from "../taxes";
import sharp from "sharp";
import { assumptionMeta, hintsFromSnapshot } from "../assumptions";
import { studyGeo } from "../geoLookup";
import { MAP_INFO, renderAllMaps } from "../maps";
import { loadComparablesFor, summarizeComparables, type ComparableRow } from "../rentComparables";
import { simulate } from "../simulator";
import { addInternalLink, addOutline, addUriLink, drawCover, drawToc, tocPagesNeeded, type NavEntry } from "./navigation";
import {
  CONFIDENCE_LABELS,
  CURRENT_USE_LABELS,
  ORIGIN_LABELS,
  POOL_LABELS,
  PROPERTY_KIND_LABELS,
  type DataOrigin,
  type Estimate,
  type StudyAssumptions,
  type StudyInput,
  type StudySnapshot,
} from "../types";

// Identidad FINCALIA360: azul marino #142B45, verde petróleo #238477, blanco roto #F7F8F5
const INK = rgb(0.078, 0.169, 0.271);
const MUTED = rgb(0.357, 0.42, 0.486);
const ACCENT = rgb(0.137, 0.518, 0.467);
const WARN = rgb(0.6, 0.38, 0.05);
const LINE = rgb(0.89, 0.902, 0.882);
const SAND = rgb(0.937, 0.945, 0.925);
const WHITE = rgb(1, 1, 1);
const A4 = { w: 595.28, h: 841.89 };
const M = 48;
const CONTENT_W = A4.w - 2 * M;

// WinAnsi (fuentes estándar del PDF): se sustituyen los caracteres que no admite.
const REPLACE: Record<string, string> = { "≥": ">=", "≤": "<=", "→": "->", "≈": "~", "✓": "-", "−": "-", " ": " ", " ": " ", "‑": "-" };
export function cleanPdfText(text: string) {
  return text
    .replace(/[≥≤→≈✓−  ‑]/g, (c) => REPLACE[c] ?? "")
    .replace(/[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ\n]/g, "");
}

const tag = (o: DataOrigin) => `[${ORIGIN_LABELS[o]}]`;
const srcLine = (e: Estimate) =>
  `${tag(e.origin)} ${e.source.name}${e.source.period ? ` · periodo ${e.source.period}` : ""}${e.source.retrievedAt ? ` · consultado ${fmtDate(e.source.retrievedAt)}` : ""} · confianza ${CONFIDENCE_LABELS[e.confidence].toLowerCase()}`;

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - M;
  }
  ensure(h: number) {
    if (this.y - h < 56) this.newPage();
  }
  wrap(text: string, size: number, font: PDFFont, width: number) {
    const lines: string[] = [];
    for (const paragraph of cleanPdfText(text).split("\n")) {
      let line = "";
      for (const w of paragraph.split(/\s+/)) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > width && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      lines.push(line);
    }
    return lines;
  }
  height(text: string, size: number, font: PDFFont, width: number) {
    return this.wrap(text, size, font, width).length * (size + 3.5);
  }
  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? this.bold : this.font;
    const x = M + (opts.indent ?? 0);
    for (const line of this.wrap(text, size, font, A4.w - M - x)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= size + 3.5;
    }
    this.y -= opts.gap ?? 2;
  }
  /** Secciones dibujadas (para el índice y los marcadores): página y altura donde empiezan. */
  nav: NavEntry[] = [];
  /** Enlaces externos a crear (las páginas ya existen; se añaden al final). */
  links: Array<{ page: PDFPage; rect: [number, number, number, number]; url: string }> = [];
  /** Título de sección: nunca queda separado de su contenido (reserva espacio para varias líneas). */
  heading(num: number | null, title: string, reserve = 110, navLevel: 1 | 2 = 1) {
    this.ensure(30 + reserve);
    this.nav.push({ level: navLevel, num: num != null ? String(num) : null, title, page: this.page, y: this.y });
    this.y -= 10;
    this.page.drawText(cleanPdfText(num != null ? `${num}. ${title}` : title), { x: M, y: this.y - 14, size: 13, font: this.bold, color: INK });
    this.y -= 20;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4.w - M, y: this.y }, thickness: 0.6, color: LINE });
    this.y -= 8;
  }
  subheading(title: string, nav = false) {
    this.ensure(60);
    if (nav) this.nav.push({ level: 2, num: null, title, page: this.page, y: this.y });
    this.y -= 4;
    this.text(title, { bold: true, size: 10 });
  }
  /** Texto con enlace externo (toda la línea o líneas son clicables). */
  linkText(text: string, url: string | undefined, opts: { size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const size = opts.size ?? 8;
    const h = this.height(text, size, this.font, CONTENT_W);
    this.ensure(h + 4);
    const top = this.y;
    this.text(text, { size, color: opts.color });
    if (url) this.links.push({ page: this.page, rect: [M - 2, this.y, A4.w - M + 2, top], url });
  }
  row(label: string, value: string, note?: string, color = INK) {
    const size = 9.5;
    const labelW = 250;
    const labelLines = this.wrap(label, size, this.font, labelW);
    const valueLines = this.wrap(value, size, this.bold, CONTENT_W - labelW - 10);
    const h = Math.max(labelLines.length, valueLines.length) * (size + 3) + 4;
    const noteH = note ? this.height(note, 7.5, this.font, CONTENT_W) : 0;
    this.ensure(h + noteH + 4);
    labelLines.forEach((l, i) => this.page.drawText(l, { x: M, y: this.y - size - i * (size + 3), size, font: this.font, color: INK }));
    valueLines.forEach((l, i) => this.page.drawText(l, { x: M + labelW + 10, y: this.y - size - i * (size + 3), size, font: this.bold, color }));
    this.y -= h;
    if (note) this.text(note, { size: 7.5, color: MUTED, gap: 0 });
    this.page.drawLine({ start: { x: M, y: this.y + 1 }, end: { x: A4.w - M, y: this.y + 1 }, thickness: 0.3, color: LINE });
    this.y -= 3;
  }
  /** Tabla con columnas cuyo ancho total es el del área de contenido. */
  table(headers: string[], rows: string[][], ratios: number[]) {
    const size = 8.5;
    const total = ratios.reduce((s, r) => s + r, 0);
    const widths = ratios.map((r) => (r / total) * CONTENT_W);
    const draw = (cells: string[], font: PDFFont, fill?: boolean) => {
      const lines = cells.map((c, i) => this.wrap(c, size, font, widths[i] - 8));
      const h = Math.max(...lines.map((l) => l.length)) * (size + 2.5) + 6;
      this.ensure(h + 2);
      if (fill) this.page.drawRectangle({ x: M, y: this.y - h, width: CONTENT_W, height: h, color: SAND });
      let x = M;
      lines.forEach((cellLines, i) => {
        cellLines.forEach((t, k) => {
          const tw = font.widthOfTextAtSize(t, size);
          const tx = i === 0 ? x + 4 : x + widths[i] - 4 - tw;
          this.page.drawText(t, { x: tx, y: this.y - 4 - size - k * (size + 2.5), size, font, color: INK });
        });
        x += widths[i];
      });
      this.y -= h;
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4.w - M, y: this.y }, thickness: 0.3, color: LINE });
    };
    draw(headers, this.bold, true);
    rows.forEach((r) => draw(r, this.font));
    this.y -= 6;
  }
  /** Imagen a todo el ancho con su pie (planos). */
  image(img: PDFImage, caption: string) {
    const width = CONTENT_W;
    const height = (img.height / img.width) * width;
    this.ensure(height + 30);
    this.page.drawImage(img, { x: M, y: this.y - height, width, height });
    this.page.drawRectangle({ x: M, y: this.y - height, width, height, borderColor: LINE, borderWidth: 0.6 });
    this.y -= height + 4;
    this.text(caption, { size: 8, color: MUTED, gap: 8 });
  }
  bars(items: Array<{ label: string; value: number | null; color?: ReturnType<typeof rgb> }>) {
    const valid = items.filter((i) => i.value != null) as Array<{ label: string; value: number; color?: ReturnType<typeof rgb> }>;
    const max = Math.max(1, ...valid.map((i) => Math.abs(i.value)));
    const width = CONTENT_W - 230;
    for (const it of items) {
      this.ensure(17);
      this.page.drawText(cleanPdfText(it.label), { x: M, y: this.y - 10, size: 8.5, font: this.font, color: INK });
      if (it.value == null) {
        this.page.drawText("No calculable con los datos disponibles", { x: M + 130, y: this.y - 10, size: 8, font: this.font, color: WARN });
      } else {
        const w = Math.max(1, (Math.abs(it.value) / max) * width);
        this.page.drawRectangle({ x: M + 130, y: this.y - 12, width: w, height: 10, color: it.value < 0 ? rgb(0.75, 0.2, 0.2) : (it.color ?? INK) });
        this.page.drawText(cleanPdfText(fmtEur(it.value)), { x: M + 136 + w, y: this.y - 10, size: 8, font: this.bold, color: INK });
      }
      this.y -= 16;
    }
    this.y -= 4;
  }
  box(x: number, y: number, w: number, h: number, title: string, value: string, lines: string[], valueColor = INK) {
    this.page.drawRectangle({ x, y: y - h, width: w, height: h, color: SAND, borderColor: LINE, borderWidth: 0.6 });
    this.page.drawText(cleanPdfText(title.toUpperCase()), { x: x + 10, y: y - 16, size: 7.5, font: this.bold, color: MUTED });
    let yy = y - 34;
    for (const l of this.wrap(value, 14, this.bold, w - 20).slice(0, 2)) {
      this.page.drawText(l, { x: x + 10, y: yy, size: 14, font: this.bold, color: valueColor });
      yy -= 17;
    }
    for (const line of lines) {
      for (const l of this.wrap(line, 7.5, this.font, w - 20)) {
        if (yy < y - h + 6) return;
        this.page.drawText(l, { x: x + 10, y: yy, size: 7.5, font: this.font, color: MUTED });
        yy -= 10;
      }
    }
  }
}

const scenarioCell = (v: number | null | undefined) => (v == null ? "No calculable" : fmtEur(v));

function taxRow(w: Writer, t: TaxLine) {
  w.row(
    `${t.label} [Estimación del modelo] · ${TAX_STATUS_LABELS[t.status]}`,
    t.amount == null ? "No calculable" : fmtEur(t.amount),
    [t.formula, t.basis, t.missing.length ? `Falta: ${t.missing.join(", ")}` : null, ...t.notes].filter(Boolean).join(" · "),
    t.amount == null ? WARN : INK,
  );
}

/** Logotipo para fondo oscuro (public/brand). Si no se puede leer, se usa el nombre en texto. */
async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    return await doc.embedPng(await readFile(path.join(process.cwd(), "public", "brand", "fincalia360-logo-white.png")));
  } catch {
    return null;
  }
}

function writeSummaryPage(w: Writer, r: StudyReport, input: StudyInput, studyId: string, generatedAt: Date, logo: PDFImage | null) {
  const p = w.page;
  p.drawRectangle({ x: 0, y: A4.h - 118, width: A4.w, height: 118, color: INK });
  if (logo) {
    const h = 34;
    p.drawImage(logo, { x: M, y: A4.h - 56, width: (logo.width / logo.height) * h, height: h });
  } else p.drawText("FINCALIA360", { x: M, y: A4.h - 46, size: 18, font: w.bold, color: WHITE });
  p.drawRectangle({ x: 0, y: A4.h - 118, width: A4.w, height: 3, color: ACCENT });
  p.drawText(cleanPdfText("Estudio gratuito: ¿te conviene vender o alquilar tu vivienda?"), { x: M, y: A4.h - 76, size: 13, font: w.font, color: rgb(0.969, 0.973, 0.961) });
  p.drawText(
    cleanPdfText(
      `${PROPERTY_KIND_LABELS[input.property.kind]} · ${input.property.sqm} m² · ${input.location.municipalityName} (${input.location.postalCode}) · ${generatedAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} · Ref. ${studyId.slice(-8)}`,
    ),
    { x: M, y: A4.h - 98, size: 9, font: w.font, color: rgb(0.78, 0.82, 0.86) },
  );
  w.y = A4.h - 134;

  // Conclusión (o falta de ella)
  const verdictColor = r.conclusive ? INK : WARN;
  const vh = w.height(r.headline, 10, w.bold, CONTENT_W - 20) + 22;
  p.drawRectangle({ x: M, y: w.y - vh, width: CONTENT_W, height: vh, color: r.conclusive ? rgb(0.918, 0.961, 0.953) : rgb(0.99, 0.95, 0.88) });
  p.drawText(r.conclusive ? "RESULTADO CON LAS HIPÓTESIS ACTUALES" : "RESULTADO NO CONCLUYENTE", { x: M + 10, y: w.y - 13, size: 7.5, font: w.bold, color: MUTED });
  let yy = w.y - 27;
  for (const l of w.wrap(r.headline, 10, w.bold, CONTENT_W - 20)) {
    p.drawText(l, { x: M + 10, y: yy, size: 10, font: w.bold, color: verdictColor });
    yy -= 13.5;
  }
  w.y -= vh + 10;

  // Cuatro cifras clave
  const colW = (CONTENT_W - 10) / 2;
  const boxH = 92;
  const main = r.main;
  const sale = r.sale;
  const b = main.sellNow?.breakdown;
  const saleLines = sale.used == null
    ? ["No es posible valorar con fiabilidad.", `Necesario: ${sale.needed.join("; ")}`]
    : sale.usedSource === "MANUAL"
      ? ["[Aportado por el propietario]"]
      : [`Intervalo ${fmtEur(sale.estimate!.low)} – ${fmtEur(sale.estimate!.high)}`, srcLine(sale.estimate!)];
  w.box(M, w.y, colW, boxH, "1 · Precio de venta estimado", sale.used == null ? "Sin valoración fiable" : fmtEur(sale.used), saleLines, sale.used == null ? WARN : INK);
  w.box(
    M + colW + 10,
    w.y,
    colW,
    boxH,
    "2 · Dinero neto si vendes hoy",
    b ? fmtEur(b.net) : "No calculable",
    b
      ? [
          `Precio ${fmtEur(b.salePrice)} − gastos ${fmtEur(b.transactionCosts)} − impuestos ${fmtEur(b.taxesTotal)}${b.mortgagePayoff > 0 ? ` − hipoteca ${fmtEur(b.mortgagePayoff)}` : " (sin hipoteca)"}`,
          b.complete ? "[Estimación del modelo] Cálculo completo." : `[Estimación del modelo] INCOMPLETO: ${b.notComputed.join("; ") || "gastos de compra supuestos"}`,
        ]
      : ["Requiere un precio de venta."],
    b && !b.complete ? WARN : INK,
  );
  w.y -= boxH + 10;
  const y1 = main.rental?.rows[0];
  w.box(
    M,
    w.y,
    colW,
    boxH,
    "3 · Alquiler mensual utilizado",
    r.rent.used == null ? "Sin renta utilizable" : `${fmtEur(r.rent.used)}/mes`,
    [`${RENT_SOURCE_LABELS[r.rent.usedSource]}${r.rent.capped ? " (limitada al tope legal)" : ""}`, `Régimen legal: ${r.rent.regime.summary}`],
    r.rent.used == null ? WARN : INK,
  );
  w.box(
    M + colW + 10,
    w.y,
    colW,
    boxH,
    "4 · Flujo de caja neto del alquiler (año 1)",
    y1 ? `${fmtEur(y1.cashFlow)}/año` : "No calculable",
    y1
      ? [
          `Renta cobrada ${fmtEur(y1.collectedRent)} − gastos ${fmtEur(y1.operatingCosts)}${y1.interest + y1.principal > 0 ? ` − hipoteca ${fmtEur(y1.interest + y1.principal)}` : ""} − impuestos ${fmtEur(y1.incomeTax)}`,
          "Dinero que entra o sale cada año; no es patrimonio. [Estimación del modelo]",
        ]
      : ["Requiere una renta mensual."],
    y1 && y1.cashFlow < 0 ? rgb(0.75, 0.2, 0.2) : INK,
  );
  w.y -= boxH + 14;

  // 5 · Comparativa 3/5/10
  w.text("5 · Patrimonio neto estimado al final de cada horizonte (euros corrientes, mismas hipótesis)", { bold: true, size: 9.5 });
  w.table(
    ["Horizonte", "A · Vender hoy", "B · Alquilar y vender", "C · Mantener sin vender", "B − A"],
    [3, 5, 10].map((h) => {
      const s = r.byHorizon[h];
      const A = s.sellNow?.wealth ?? null;
      const B = s.rentThenSell?.wealth ?? null;
      return [`${h} años`, scenarioCell(A), scenarioCell(B), scenarioCell(s.keep?.wealth), A != null && B != null ? fmtEur(B - A) : "—"];
    }),
    [1.1, 1.3, 1.5, 1.6, 1.1],
  );
  const chart = r.byHorizon[10];
  w.bars([
    { label: "A · Vender hoy (10 años)", value: chart.sellNow?.wealth ?? null, color: ACCENT },
    { label: "B · Alquilar y vender (10 años)", value: chart.rentThenSell?.wealth ?? null },
    { label: "C · Mantener (10 años)", value: chart.keep?.wealth ?? null, color: MUTED },
  ]);
  w.text("C no descuenta gastos ni impuestos de una venta que no se produce (se detallan en la sección 5). [Estimación del modelo]", { size: 7.5, color: MUTED });

  // 6 · Incertidumbres
  w.text("6 · Principales incertidumbres", { bold: true, size: 9.5 });
  const unc = r.uncertainties.length ? r.uncertainties.slice(0, 5) : ["No se han detectado datos ausentes; los resultados dependen de las hipótesis de mercado."];
  unc.forEach((u) => w.text(`• ${u}`, { size: 8.5 }));
  w.text("Estudio orientativo: no constituye asesoramiento financiero, fiscal ni jurídico, ni sustituye una valoración profesional.", { size: 7.5, color: MUTED });
}

function scenarioSection(w: Writer, s: ScenarioResult) {
  const i = s.initial;
  w.subheading("Punto de partida común (hoy)");
  w.row("Valor bruto de la vivienda", fmtEur(i.propertyValue));
  w.row("Hipoteca pendiente [Aportado]", fmtEur(i.mortgageBalance));
  w.row("Patrimonio neto en la vivienda", fmtEur(i.equity));

  w.subheading(`A · Vender hoy e invertir el neto (${s.horizon} años)`);
  if (!s.sellNow) w.text("No calculable: falta el valor de venta.", { color: WARN });
  else {
    const b = s.sellNow.breakdown;
    w.row("Precio de venta", fmtEur(b.salePrice));
    w.row("Gastos de la operación (agencia + IVA, notaría, cancelación hipoteca)", fmtEur(-b.transactionCosts));
    w.row("Impuestos (plusvalía + ganancia patrimonial)", fmtEur(-b.taxesTotal), b.notComputed.length ? `No incluidos por falta de datos: ${b.notComputed.join("; ")}` : undefined);
    w.row("Hipoteca pendiente cancelada", fmtEur(-b.mortgagePayoff));
    w.row("Dinero neto que recibes hoy", fmtEur(b.net));
    w.row("Rendimiento al coste de oportunidad", fmtEur(s.sellNow.investmentGain));
    w.row(`Patrimonio A en ${s.horizon} años`, fmtEur(s.sellNow.wealth));
  }
  w.subheading(`B · Alquilar y vender al final (${s.horizon} años)`);
  if (!s.rental) w.text("No calculable: falta la renta.", { color: WARN });
  else {
    w.row("Suma de flujos de caja netos del alquiler", fmtEur(s.rental.cumulativeCashFlow));
    w.row("Rendimiento de reinvertir esos flujos", fmtEur(s.rental.reinvestmentGain));
    if (s.rentThenSell) {
      const f = s.rentThenSell.finalSale;
      w.row(`Venta en el año ${s.horizon}: precio`, fmtEur(f.salePrice));
      w.row("Gastos, impuestos e hipoteca pendiente en esa venta", fmtEur(-(f.transactionCosts + f.taxesTotal + f.mortgagePayoff)));
      w.row("Dinero neto de la venta futura", fmtEur(f.net));
      w.row(`Patrimonio B en ${s.horizon} años`, fmtEur(s.rentThenSell.wealth));
    } else w.text("Patrimonio B no calculable: falta el valor de venta.", { color: WARN });
  }
  w.subheading(`C · Mantener sin vender (${s.horizon} años)`);
  if (!s.keep) w.text("No calculable: faltan el valor de venta y/o la renta.", { color: WARN });
  else {
    w.row("Valor bruto de la vivienda al final", fmtEur(s.keep.propertyValueGross));
    w.row("Hipoteca pendiente al final", fmtEur(-s.keep.mortgageBalance));
    w.row("Patrimonio neto en la vivienda", fmtEur(s.keep.propertyEquity));
    w.row("Caja acumulada del alquiler", fmtEur(s.keep.accumulatedCash));
    w.row(`Patrimonio C en ${s.horizon} años`, fmtEur(s.keep.wealth));
    w.row("Gastos e impuestos latentes si se vendiera (no pagados)", fmtEur(s.keep.latentSaleCosts), "Informativo: no se restan en C porque la venta no se produce.");
  }
}

export async function renderStudyPdf(params: {
  studyId: string;
  input: StudyInput;
  snapshot: StudySnapshot;
  assumptions: StudyAssumptions | Record<string, unknown>;
  horizon: number;
  generatedAt?: Date;
  /** Planos de Catastro e IGN (requieren conexión). Por defecto, sí. */
  includeMaps?: boolean;
  /** Nombre para la portada (lo indica el propietario al descargar). Sin él, la portada dice «No indicado». */
  clientName?: string | null;
  /** Comparables de alquiler registrados por el equipo. Si no se pasan, se buscan en la base de datos. */
  comparables?: ComparableRow[];
}) {
  const { input, snapshot } = params;
  const report = buildStudyReport(input, snapshot, params.assumptions, params.horizon);
  const a = report.assumptions;
  const generatedAt = params.generatedAt ?? new Date();
  const doc = await PDFDocument.create();
  doc.setTitle("Estudio inmobiliario personalizado - FINCALIA360");
  doc.setAuthor("FINCALIA360");
  doc.setSubject("Análisis de rentabilidad: venta frente a alquiler");
  doc.setCreationDate(generatedAt);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(doc);
  const w = new Writer(doc, font, bold);
  const prov = getProvince(input.location.provinceCode);
  const ccaa = getCcaa(input.location.ccaaCode);
  const comparableRows = params.comparables ?? (await loadComparablesFor(input).catch(() => []));
  const comps = summarizeComparables(comparableRows, input, generatedAt);

  // ---------------- Resumen ejecutivo (primera página de contenido) ----------------
  w.nav.push({ level: 1, num: null, title: "Resumen ejecutivo y conclusiones", page: w.page, y: A4.h });
  writeSummaryPage(w, report, input, params.studyId, generatedAt, logo);

  // ---------------- Detalle ----------------
  w.newPage();
  w.text("Detalle técnico", { bold: true, size: 16 });
  w.text("Procedencia de cada dato: [Dato oficial], [Aportado por el propietario], [Precio observado en el mercado], [Estimación del modelo], [Hipótesis modificable] o [Dato de EJEMPLO].", { size: 8, color: MUTED, gap: 4 });

  // 1. Datos del inmueble
  w.heading(1, "Datos del inmueble");
  w.row("Ubicación [Aportado]", `${input.location.municipalityName} (${prov?.name}, ${ccaa?.name}) · CP ${input.location.postalCode}`);
  w.row("Tipo y superficie [Aportado]", `${PROPERTY_KIND_LABELS[input.property.kind]} · ${input.property.sqm} m² · ${input.property.bedrooms} hab. · ${input.property.bathrooms} baños`, "Superficie construida indicada en el estudio. La superficie útil no se ha indicado: no se tratan como equivalentes.");
  w.row("Situación actual [Aportado]", CURRENT_USE_LABELS[input.property.currentUse]);
  const p = input.property;
  const extras = [
    p.parkingSpaces || p.parking ? `${p.parkingSpaces ?? 1} plaza(s) de garaje` : null,
    p.storage || p.storageSqm ? `trastero${p.storageSqm ? ` de ${p.storageSqm} m²` : ""}` : null,
    p.mooringLengthM || p.mooringValue ? `amarre${p.mooringLengthM ? ` de ${p.mooringLengthM} m` : ""}` : null,
    p.pool !== "NONE" ? POOL_LABELS[p.pool].toLowerCase() : null,
  ].filter(Boolean);
  if (extras.length) w.row("Anexos y extras [Aportado]", extras.join(" · "));
  if (input.location.cadastralRef) w.row("Referencia catastral [Dato oficial]", input.location.cadastralRef, snapshot.geo?.address ?? undefined);
  const vz = snapshot.valueZone;
  if (vz?.residential) {
    const r = vz.residential;
    w.row(
      `Zona de valor del Catastro ${vz.zone} (${vz.year}) [Dato oficial]`,
      `${fmtEur(r.mvmM2)}/m² (módulo de valor medio)`,
      `Vivienda representativa: ${[r.typology, r.sqm ? `${r.sqm} m²` : null, r.category ? `calidad ${r.category.toLowerCase()}` : null, r.ageYears != null ? `${r.ageYears} años` : null].filter(Boolean).join(", ")}${r.dwellings ? ` · ${r.dwellings} viviendas en la zona` : ""}${vz.garage ? ` · Garaje representativo: ${fmtEur(vz.garage.value)}` : ""}. Calculado por el Catastro con los precios de las compraventas escrituradas. Fuente: ${vz.source.name}, consultado ${fmtDate(vz.source.retrievedAt ?? "")}.`,
    );
  }

  // Ubicación y planos (Catastro e IGN). Si un servicio no responde, se indica.
  if (params.includeMaps !== false) {
    const geo = await studyGeo(input, snapshot);
    w.heading(null, "Ubicación y planos", 330, 2);
    if (!geo) {
      w.text(
        input.location.cadastralRef
          ? "No se han podido obtener las coordenadas de la parcela en el Catastro en este momento."
          : "Indica la referencia catastral (o busca la vivienda por su dirección en el estudio) para incluir el plano de situación, la vista aérea y el plano catastral.",
        { size: 9, color: MUTED },
      );
    } else {
      const maps = await renderAllMaps(geo);
      for (const m of maps) {
        const info = MAP_INFO[m.kind];
        const img = m.kind === "parcela" ? await doc.embedPng(m.png) : await doc.embedJpg(await sharp(m.png).jpeg({ quality: 82 }).toBuffer());
        w.text(info.title, { bold: true, size: 10 });
        w.image(img, `${info.caption} ${info.attribution}.`);
      }
      if (maps.length < 3) w.text("Algún plano no se ha podido generar porque el servicio cartográfico no respondió.", { size: 8, color: MUTED });
      w.text("El Catastro solo publica el contorno de la parcela y de las construcciones: el plano interior de la vivienda no es público.", { size: 8, color: MUTED });
    }
  }

  // 2. Mercado de la zona
  w.heading(2, "Análisis del mercado inmobiliario de la zona");
  const pop = snapshot.zone.population;
  if (pop) {
    const lastP = pop.points[pop.points.length - 1];
    const first = pop.points[0];
    w.row("Población [Dato oficial]", `${lastP.value.toLocaleString("es-ES")} habitantes (${lastP.period})`, `Variación ${first.period}–${lastP.period}: ${(((lastP.value - first.value) / first.value) * 100).toFixed(1)} %. Fuente: ${pop.source.name}.`);
  }
  const seriesRow = (s: StudySnapshot["zone"]["rentIndex"], label: string) => {
    if (!s) return;
    const pts = s.points.slice(-5).map((pt) => `${pt.period}: ${pt.value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}`).join(" · ");
    w.row(`${label} [Dato oficial]`, s.unit, `${pts}. Fuente: ${s.source.name}.`);
  };
  seriesRow(snapshot.zone.rentM2History, "Alquiler declarado (SERPAVI)");
  seriesRow(snapshot.zone.rentalStock, "Viviendas en alquiler habitual (SERPAVI)");
  seriesRow(snapshot.zone.rentIndex, "Índice de alquiler municipal (IPVA)");
  seriesRow(snapshot.zone.priceIndexCcaa, "Índice de precios de vivienda (IPV, CCAA)");
  seriesRow(snapshot.zone.touristDwellingsPct, "Viviendas turísticas");
  snapshot.zone.unavailable.forEach((u) => w.text(`• No disponible: ${u.indicator}. ${u.reason}`, { size: 8, color: MUTED }));

  // 3. Valoración
  w.heading(3, "Estimación del valor de venta");
  if (report.sale.used == null) {
    w.text(report.sale.message, { color: WARN, bold: true });
    w.text(`Datos necesarios: ${report.sale.needed.join("; ")}.`);
  } else if (report.sale.usedSource === "MANUAL") {
    w.row("Valor de venta [Aportado por el propietario]", fmtEur(report.sale.used), "Introducido en el simulador por el propietario.");
  } else {
    const e = report.sale.estimate!;
    w.row(`Estimación central ${tag(e.origin)}`, fmtEur(e.value), `${e.method} ${srcLine(e)}`);
    w.row("Intervalo de valoración", `${fmtEur(e.low)} – ${fmtEur(e.high)}`);
    w.row("Precio por m² (vivienda)", `${fmtEur(e.perM2)}/m²`);
    if (e.annexes?.length) {
      if (e.dwellingValue != null) w.row("Vivienda (sin anexos)", fmtEur(e.dwellingValue));
      for (const an of e.annexes) {
        w.row(an.value == null ? an.label : `${an.label} ${tag(an.origin)}`, an.value == null ? "Sin valorar" : fmtEur(an.value), `${an.method}${an.source ? ` Fuente: ${an.source.name}.` : ""}`, an.value == null ? WARN : INK);
      }
    }
    e.limitations.forEach((l) => w.text(`• ${l}`, { size: 8, color: MUTED }));
  }
  report.sale.alternatives.forEach((e) => w.row(`Estimación alternativa ${tag(e.origin)}`, fmtEur(e.value), `${e.method} ${srcLine(e)}`));

  // 4. Alquiler
  w.heading(4, "Estimación del precio de alquiler");
  const st = report.rent.statistical;
  w.row(
    "Renta de referencia estadística [Dato oficial]",
    st ? `${fmtEur(st.value)}/mes (P25–P75: ${fmtEur(st.low)} – ${fmtEur(st.high)})` : "No disponible",
    st ? `${st.method} ${srcLine(st)}. No es la renta de un contrato nuevo ni un límite legal.` : undefined,
  );
  const mk = report.rent.market;
  w.row(
    "Estimación de alquiler de mercado",
    mk ? `${fmtEur(mk.value)}/mes ${tag(mk.origin)}` : "No disponible",
    mk ? `${mk.method} ${srcLine(mk)}` : "No hay una fuente autorizada de precios de mercado configurada (ver Fuentes).",
  );
  if (report.rent.ownerCurrent != null) w.row("Renta de tu contrato vigente [Aportado]", `${fmtEur(report.rent.ownerCurrent)}/mes`);

  // 4.1 Comparables registrados (anuncios consultados por el equipo)
  w.subheading("Comparables de alquiler anunciados", true);
  if (!comps.rows.length) {
    w.text(`${comps.note} Sin comparables no se da un rango de anuncios: la estimación se apoya en las fuentes oficiales de arriba, con menor confianza.`, { size: 8.5, color: MUTED });
  } else {
    w.table(
      ["Anuncio (fuente · fecha)", "Renta/mes", "m²", "Precio/m² mes", "Diferencias con tu vivienda"],
      comps.rows.slice(0, 12).map((c) => [
        `${c.sourceName}${c.zone ? ` · ${c.zone}` : ""} · ${fmtDate(c.observedAt.toISOString())}`,
        fmtEur(c.monthlyRent),
        c.builtArea ? String(c.builtArea) : "—",
        c.perM2 != null ? c.perM2.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "—",
        c.differences.join(", ") || "Similar",
      ]),
      [2.2, 0.9, 0.6, 0.8, 2],
    );
    comps.rows.slice(0, 12).forEach((c, i) => {
      if (c.url) w.linkText(`Anuncio ${i + 1}: ${c.url}`, c.url, { size: 7.5, color: MUTED });
    });
    w.text(comps.note, { size: 8, color: MUTED });
  }

  // 4.2 Rango orientativo y precio recomendado (cuatro conceptos distintos)
  w.subheading("Rango orientativo y precio recomendado", true);
  const rangeRows: string[][] = [];
  if (comps.monthly && comps.perM2) {
    rangeRows.push([
      `Anuncios comparables (${comps.used}) [Precio observado en el mercado]`,
      fmtEur(comps.monthly.conservative),
      fmtEur(comps.monthly.market),
      fmtEur(comps.monthly.high),
      `${comps.perM2.p50.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/m²`,
    ]);
  }
  if (st) rangeRows.push([`Contratos vigentes declarados (SERPAVI) [Dato oficial]`, fmtEur(st.low), fmtEur(st.value), fmtEur(st.high), `${st.perM2.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/m²`]);
  if (mk) rangeRows.push([`Estimación de mercado ${tag(mk.origin)}`, fmtEur(mk.low), fmtEur(mk.value), fmtEur(mk.high), `${mk.perM2.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/m²`]);
  if (rangeRows.length) {
    w.table(["Fuente", "Conservador", "Central", "Alto", "Precio/m² mes"], rangeRows, [2.6, 0.9, 0.9, 0.9, 0.9]);
  } else w.text("No hay fuentes de alquiler suficientes para dar un rango.", { color: WARN, size: 9 });
  const rg = report.rent.regime;
  w.row("1 · Precio de mercado observado", comps.monthly ? `${fmtEur(comps.monthly.market)}/mes` : "No disponible", comps.monthly ? `Mediana de ${comps.used} anuncios (precio de oferta). Fecha del más reciente: ${fmtDate(comps.latest!.toISOString())}.` : "Sin anuncios comparables registrados para esta zona.");
  w.row(
    "2 · Precio orientativo de publicación",
    comps.monthly ? `${fmtEur(comps.monthly.conservative)} – ${fmtEur(comps.monthly.high)}/mes` : st ? `${fmtEur(st.low)} – ${fmtEur(st.high)}/mes` : "No disponible",
    comps.monthly ? "Rango P25–P75 de los anuncios comparables." : st ? "Sin anuncios: se muestra la franja P25–P75 de los contratos declarados (SERPAVI), que suele quedar por debajo de los anuncios." : undefined,
  );
  w.row(
    "3 · Renta máxima legal aplicable",
    rg.capMonthly != null ? `${fmtEur(rg.capMonthly)}/mes` : rg.status === "NO_SPECIFIC_CAP" ? "Sin tope específico" : "No determinable",
    rg.summary,
    rg.capMonthly == null && rg.status !== "NO_SPECIFIC_CAP" ? WARN : INK,
  );
  w.row("4 · Renta recomendada (la utilizada en el estudio)", report.rent.used == null ? "Ninguna" : `${fmtEur(report.rent.used)}/mes · ${fmtEur(report.rent.used * 12)}/año`, `${RENT_SOURCE_LABELS[report.rent.usedSource]}${report.rent.capped ? " (limitada al tope legal)" : ""}. ${report.rent.notes.join(" ")}`);
  w.text("El precio de mercado no siempre puede cobrarse legalmente: en zona tensionada o con un contrato anterior reciente, la renta de un nuevo contrato puede estar limitada (ver régimen legal).", { size: 8, color: MUTED });

  // 4.3 Régimen legal (bloque existente)
  w.subheading("Régimen legal del alquiler", true);
  w.text(`Normativa: ${rg.source.legalBasis}. Ámbito: ${rg.source.scope}. Vigencia de la zona: ${fmtDate(rg.source.validFrom)} – ${fmtDate(rg.source.validTo)}. Fuente: ${rg.source.zoneSource}${rg.source.resolution ? ` (${rg.source.resolution})` : ""}.`, { size: 8, color: MUTED });
  rg.rules.forEach((x) => w.text(`• ${x}`, { size: 8 }));
  if (rg.requirements.length) w.text(`Requisitos: ${rg.requirements.join(" ")}`, { size: 8 });
  if (rg.missing.length) w.text(`Datos necesarios para fijar la renta máxima: ${rg.missing.join("; ")}`, { size: 8, color: WARN });

  // 5. Comparativa vender / alquilar
  const ym = report.main;
  w.heading(5, "Comparativa entre vender y alquilar", 160);
  scenarioSection(w, ym);
  w.subheading("Comparativa a 1, 3, 5 y 10 años (patrimonio neto, euros corrientes)", true);
  w.table(
    ["Horizonte", "A · Vender hoy", "B · Alquilar y vender", "C · Mantener", "Caja acumulada"],
    [1, 3, 5, 10].map((h) => {
      const s = report.byHorizon[h];
      return [`${h} ${h === 1 ? "año" : "años"}`, scenarioCell(s.sellNow?.wealth), scenarioCell(s.rentThenSell?.wealth), scenarioCell(s.keep?.wealth), scenarioCell(s.rental?.accumulatedCash)];
    }),
    [1, 1.3, 1.4, 1.3, 1.3],
  );
  w.subheading("Variables que más influyen (sensibilidad de B − A)", true);
  w.table(
    ["Variable", "B − A a la baja", "B − A base", "B − A al alza", "Observación"],
    report.sensitivity.map((s) => [s.label, s.available ? fmtEur(s.down) : "—", s.available ? fmtEur(s.base) : "—", s.available ? fmtEur(s.up) : "—", s.available ? (s.reason ?? "") : `No calculado: ${s.reason}`]),
    [1.6, 1, 1, 1, 1.8],
  );

  // 6. Rentabilidad
  w.heading(6, "Rentabilidad del alquiler");
  w.row("Rentabilidad bruta anual sobre el valor de venta [Modelo]", fmtPct(ym.yields.gross), "Renta anual / valor de venta.");
  w.row("Rentabilidad neta anual antes de impuestos [Modelo]", fmtPct(ym.yields.net), "Descuenta desocupación, comunidad, IBI, seguro, mantenimiento y gestión (sin hipoteca).");
  w.row("Rentabilidad neta anual después de impuestos [Modelo]", fmtPct(ym.yields.netAfterTax));
  w.subheading("Flujo de caja del alquiler año a año", true);
  if (!ym.rental) w.text("No calculable: falta la renta.", { color: WARN });
  else
    w.table(
      ["Año", "Renta cobrada", "Gastos", "Hipoteca", "Impuestos", "Flujo neto"],
      ym.rental.rows.map((row) => [String(row.year), fmtEur(row.collectedRent), fmtEur(row.operatingCosts), fmtEur(row.interest + row.principal), fmtEur(row.incomeTax), fmtEur(row.cashFlow)]),
      [0.6, 1.2, 1.1, 1.1, 1.1, 1.1],
    );
  w.text("La cuota de la hipoteca (intereses + capital) es un pago de financiación: resta en el flujo de caja, pero no en las rentabilidades, que miden la vivienda sin financiación.", { size: 8, color: MUTED });

  // 7. Fiscalidad
  w.heading(7, "Gastos e impuestos de cada escenario");
  if (ym.sellNow) {
    const b = ym.sellNow.breakdown;
    w.row("Precio de venta", fmtEur(b.salePrice));
    w.row(`Honorarios de agencia (${a.agencyFeePct} % + IVA ${a.vatPct} %) [Hipótesis]`, fmtEur(b.agencyFees));
    w.row("Notaría, gestoría y certificados [Hipótesis]", fmtEur(b.notaryAndOther));
    if (b.mortgagePayoff > 0) w.row("Cancelación de hipoteca + comisión [Hipótesis]", fmtEur(b.mortgageCancellation + b.earlyRepaymentFee));
    w.row("Ganancia patrimonial [Modelo]", b.gainTax.gain == null ? "No calculable" : fmtEur(b.gainTax.gain), b.gainTax.formula);
    taxRow(w, b.plusvalia);
    taxRow(w, b.gainTax);
    w.row("Dinero neto que recibes", fmtEur(b.net), b.complete ? undefined : "Resultado INCOMPLETO: ver conceptos no calculados.");
  } else w.text("Sin valor de venta no se calculan los impuestos de la venta.", { color: WARN });
  const red = report.reduction;
  w.row(`Reducción IRPF por alquiler de vivienda · ${red.status === "UNKNOWN" ? "no determinada" : red.status === "ASSUMED" ? "supuesta" : red.status === "NOT_APPLICABLE" ? "no aplica" : "determinada"}`, red.pct == null ? "No determinada" : `${red.pct} %`, `${red.label}. ${red.basis}${red.missing.length ? ` Falta: ${red.missing.join(", ")}.` : ""}`);
  const y1r = ym.rental?.rows[0];
  if (y1r) w.row("Impuestos del alquiler en el año 1 (incluye imputación del periodo vacío) [Modelo]", fmtEur(y1r.incomeTax));
  if (["EMPTY", "SECOND_HOME"].includes(input.property.currentUse)) taxRow(w, imputedIncomeTax({ cadastralTotal: input.economics.cadastralValueTotal, residence: input.owner.taxResidence, marginalRatePct: a.marginalRatePct }));
  const inh = inheritanceGuidance({ ccaaName: ccaa?.name ?? "tu comunidad", relationship: null, propertyValue: report.sale.used });
  w.text(`${inh.title}: ${inh.summary}`, { size: 8.5 });
  w.text(`Normativa de referencia: ${TAX_RULES_VERSION}. Estimaciones no vinculantes: consulta con un asesor fiscal.`, { size: 7.5, color: MUTED });

  // 8. Gestión, abogados y desahucio (desglose informativo de las MISMAS cifras del escenario de riesgo)
  w.heading(8, "Gastos de gestión, abogados y posibles desahucios");
  if (y1r) {
    w.row(`Gestión del alquiler (${a.managementPct} % de la renta cobrada) [Hipótesis]`, a.managementPct > 0 ? `${fmtEur(y1r.management)}/año` : "0 € (gestión propia)", "Se incluye en los gastos del alquiler (sección 6).");
  }
  const evRow = report.risk?.rows.find((row) => row.type === "EVICTION_ARREARS");
  const ev = evRow?.results.find((x) => x.months === 6);
  if (!report.risk || !ev) w.text("No calculable: falta la renta.", { color: WARN });
  else {
    const interestPart = report.risk.monthlyMortgageInterest * ev.months;
    const opportunityPart = ev.otherCosts - interestPart;
    w.text(`Supuesto ilustrativo: impago de ${ev.months} meses que termina en desahucio, con la renta usada (${fmtEur(report.risk.monthlyRent)}/mes). No es una predicción.`, { size: 8.5 });
    w.table(
      ["Concepto", "Importe", "Naturaleza"],
      [
        ["Gastos profesionales (abogado y, si procede, procurador)", fmtEur(ev.legalCosts), "Hipótesis modificable (no es una tarifa)"],
        [`Rentas pendientes (${ev.months} meses impagados)`, fmtEur(ev.unpaidRent), "Escenario hipotético"],
        ["Posible recuperación: fianza aplicada a la deuda", fmtEur(-ev.depositApplied), "Hipótesis modificable"],
        [`Ingresos no percibidos hasta volver a alquilar (${a.riskReletMonths} mes/es)`, fmtEur(ev.reletLoss), "Hipótesis modificable"],
        ["Gastos ordinarios del periodo sin renta que los cubra", fmtEur(ev.ordinaryExpenses), "Comunidad, IBI, seguro y otros"],
        ["Daños y reparaciones", fmtEur(ev.repairs), "Hipótesis modificable"],
        ["Intereses de la hipoteca del periodo", fmtEur(interestPart), interestPart > 0 ? "Se pagan igualmente" : "Sin hipoteca"],
        ["Coste de oportunidad de la renta no cobrada", fmtEur(opportunityPart), "No es una salida de dinero"],
        ["Coste económico total del periodo", fmtEur(ev.total), "Suma de las filas anteriores"],
        ["Coste adicional frente a un alquiler normal", fmtEur(ev.incrementalCost), "Sin gastos ordinarios ni intereses"],
      ],
      [2.6, 1, 1.8],
    );
    w.text(
      "Cada importe aparece una sola vez: las rentas pendientes no incluyen los honorarios, y los meses hasta volver a alquilar se cuentan aparte de la desocupación habitual del alquiler. Las rentas pendientes son reclamables al inquilino, pero su cobro efectivo no está garantizado.",
      { size: 8, color: MUTED },
    );
    w.subheading("Conceptos que pueden intervenir (según el caso)", true);
    [
      "Consulta jurídica inicial y revisión del contrato.",
      "Requerimiento formal de pago y comunicaciones fehacientes (p. ej. burofax).",
      "Honorarios de abogado y, cuando sean preceptivos según el procedimiento y la cuantía, de procurador.",
      "Notificaciones y gastos del procedimiento; cerrajero el día del lanzamiento, si procede.",
      "Recuperación y puesta a punto de la vivienda; suministros a cargo del propietario.",
    ].forEach((t) => w.text(`• ${t}`, { size: 8.5 }));
    w.text(
      "No se publican tarifas oficiales de abogados: los honorarios son libres y los colegios solo publican criterios orientativos para costas. La cifra usada es una hipótesis que puedes cambiar en la web; pide presupuesto a un profesional de tu zona. La duración depende del juzgado, de la oposición del inquilino y de la posible valoración de vulnerabilidad: no se promete ningún plazo.",
      { size: 8, color: MUTED },
    );
  }

  // 9. Escenarios de riesgo
  w.heading(9, "Escenarios de riesgo del alquiler", 160);
  if (!report.risk || report.ctx.monthlyRent == null || report.ctx.saleValue == null) {
    w.text("No calculable: faltan la renta o el valor de venta.", { color: WARN });
  } else {
    const normal = simulate(input, { ...a, vacancyMonths: 0 }, 1, report.ctx);
    const vacancyMonths = a.vacancyMonths > 0 ? a.vacancyMonths : 2;
    const vacancy = simulate(input, { ...a, vacancyMonths }, 1, report.ctx);
    const n1 = normal.rental!.rows[0];
    const v1 = vacancy.rental!.rows[0];
    const extraLoss = ev ? ev.lostIncome + ev.legalCosts + ev.repairs : null;
    w.table(
      ["Año 1", "1 · Alquiler normal", `2 · ${vacancyMonths} mes(es) sin inquilino`, "3 · Impago y desahucio"],
      [
        ["Renta cobrada", fmtEur(n1.collectedRent), fmtEur(v1.collectedRent), ev ? fmtEur(n1.collectedRent - ev.unpaidRent + ev.depositApplied - ev.reletLoss) : "—"],
        ["Gastos de explotación", fmtEur(n1.operatingCosts), fmtEur(v1.operatingCosts), fmtEur(n1.operatingCosts)],
        ["Jurídicos y reparaciones", "0 €", "0 €", ev ? fmtEur(ev.legalCosts + ev.repairs) : "—"],
        ["Flujo de caja (tras hipoteca e impuestos)", fmtEur(n1.cashFlow), fmtEur(v1.cashFlow), extraLoss != null ? fmtEur(n1.cashFlow - extraLoss) : "—"],
        ["Rentabilidad neta antes de impuestos", fmtPct(normal.yields.net), fmtPct(vacancy.yields.net), "—"],
      ],
      [1.8, 1.1, 1.3, 1.3],
    );
    w.text(
      `Hipótesis: 1) ocupación completa; 2) ${vacancyMonths} mes(es) sin inquilino${a.vacancyMonths > 0 ? " (tu hipótesis de desocupación)" : " (supuesto ilustrativo: tu hipótesis es 0)"}, con los gastos que continúan; 3) impago de ${ev?.months ?? 6} meses con desahucio (sección 8): flujo normal − (ingresos perdidos + jurídicos + reparaciones). En el escenario 3 los impuestos se mantienen como en el 1 (simplificación prudente). Son simulaciones económicas, no predicciones.`,
      { size: 8, color: MUTED },
    );
    w.subheading("Otros supuestos adversos (3, 6 y 12 meses)", true);
    w.text(`Renta usada: ${fmtEur(report.risk.monthlyRent)}/mes · gastos fijos ${fmtEur(report.risk.fixedCostsYear)}/año · intereses de hipoteca ${fmtEur(report.risk.monthlyMortgageInterest)}/mes.`, { size: 8.5 });
    w.table(
      ["Supuesto (6 meses)", "Ingresos perdidos", "Gastos ordinarios", "Jurídicos", "Reparaciones", "Otros", "Total periodo"],
      report.risk.rows.map((row) => {
        const x = row.results[1];
        return [RISK_INFO[row.type].short, fmtEur(x.lostIncome), fmtEur(x.ordinaryExpenses), fmtEur(x.legalCosts), fmtEur(x.repairs), fmtEur(x.otherCosts), fmtEur(x.total)];
      }),
      [1.7, 1.1, 1.1, 0.9, 1, 0.8, 0.9],
    );
    w.table(
      ["Total periodo / coste adicional", ...RISK_MONTHS.map((m) => `${m} meses`)],
      report.risk.rows.map((row) => [RISK_INFO[row.type].title, ...row.results.map((x) => `${fmtEur(x.total)} / ${fmtEur(x.incrementalCost)}`)]),
      [2.2, 1.1, 1.1, 1.1],
    );
    w.text(
      "Total periodo: dinero que sale de tu bolsillo mientras dura la situación. Coste adicional: diferencia frente a un alquiler normal (excluye gastos ordinarios e intereses, que pagarías igualmente). Ingresos perdidos = renta impagada − fianza aplicada + meses hasta volver a alquilar. Otros = intereses de la hipoteca del periodo + coste de oportunidad de la renta no cobrada.",
      { size: 7.5, color: MUTED },
    );
    w.text(
      `Hipótesis manuales modificables [Hipótesis]: costes jurídicos ${fmtEur(a.riskLegalArrears)} (impago), ${fmtEur(a.riskLegalEviction)} (desahucio), ${fmtEur(a.riskLegalRecovery)} (recuperación), ${fmtEur(a.riskLegalSquatting)} (ocupación); reparaciones ${fmtEur(a.riskRepairsArrears)} / ${fmtEur(a.riskRepairsEviction)} / ${fmtEur(a.riskRepairsRecovery)} / ${fmtEur(a.riskRepairsSquatting)}; ${a.riskReletMonths} mes(es) hasta volver a alquilar; fianza aplicable ${a.riskDepositMonths} mes(es). No son costes acreditados.`,
      { size: 8 },
    );
    w.text(RISK_DISCLAIMER, { size: 8, color: MUTED });
  }

  // 10. Recomendación
  w.heading(10, "Recomendación final razonada");
  w.text(report.headline, { bold: true, size: 10, color: report.conclusive ? INK : WARN });
  report.points.forEach((pt) => w.text(`• ${pt}`, { size: 9 }));
  w.text("Esta conclusión depende de las hipótesis indicadas (revalorización, renta, gastos, impuestos y rentabilidad alternativa del dinero). Si cambian, la recomendación puede cambiar: revisa la tabla de sensibilidad de la sección 5.", { size: 8.5, color: MUTED });
  w.y -= 6;
  w.text("¿Quieres una valoración profesional?", { bold: true, size: 11 });
  w.text("Descubre cuánto dinero podrías obtener por tu vivienda y compara esa cantidad con lo que podrías ganar manteniéndola en alquiler. Un especialista local puede revisar estos resultados, visitar la vivienda y afinar el precio y la renta aplicable. Gratis y sin compromiso: solicítala desde la página de tu estudio.", { size: 9.5 });

  // 11. Fuentes y metodología
  w.heading(11, "Fuentes consultadas y metodología");
  const seen = new Set<string>();
  const statusLabel = { OK: "consultada", STALE: "copia guardada (fuente no disponible)", ERROR: "error al consultar", NOT_CONFIGURED: "no configurada", NOT_AVAILABLE: "sin datos" };
  for (const s of snapshot.sources) {
    const key = `${s.name}|${s.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    w.linkText(`• ${s.name} — ${statusLabel[s.status]}${s.period ? ` · periodo ${s.period}` : ""}${s.retrievedAt ? ` · ${fmtDate(s.retrievedAt)}` : ""}${s.url ? ` · ${s.url}` : ""}${s.note ? ` · ${s.note}` : ""}`, s.url, { size: 8 });
  }
  if (comps.rows.length) w.text(`• Comparables de alquiler registrados por FINCALIA360 (${comps.rows.length}): anuncios consultados a mano; enlaces en la sección 4.`, { size: 8 });
  w.text(`• ${rg.source.legalBasis} (régimen legal del alquiler).`, { size: 8 });
  w.text(`• Normativa fiscal: ${TAX_RULES_VERSION}.`, { size: 8 });

  w.subheading("Clasificación de la información", true);
  w.table(
    ["Categoría", "Cómo aparece en el informe"],
    [
      ["1 · Dato verificado", "[Dato oficial]: fuentes públicas citadas con fecha (Catastro, INE, Ministerios, BOE…)."],
      ["2 · Estimación basada en comparables o en el modelo", "[Precio observado en el mercado] y [Estimación del modelo]: cálculos a partir de datos citados."],
      ["3 · Hipótesis introducida por el usuario", "[Aportado por el propietario] y [Hipótesis modificable]: datos y supuestos que puedes cambiar en la web."],
      ["4 · Escenario hipotético", "Impago, desahucio, desocupación y comparativas a 1–10 años: simulaciones, no predicciones."],
      ["5 · Dato pendiente de verificación", "Lo marcado como «No calculable», «Sin valorar», «INCOMPLETO» o con fuente antigua (p. ej. tipo de plusvalía de 2021)."],
    ],
    [1.5, 3],
  );
  w.subheading("Fórmulas utilizadas", true);
  [
    "Neto de la venta = precio − honorarios de agencia × (1 + IVA) − notaría y gestoría − cancelación de hipoteca y comisión − plusvalía municipal − IRPF de la ganancia − hipoteca pendiente.",
    "Plusvalía = la menor entre el método objetivo (valor catastral del suelo × coeficiente por años × tipo municipal) y el real (ganancia × % de suelo × tipo).",
    "Renta cobrada = renta mensual × 12 × (12 − meses sin inquilino) / 12.",
    "Gastos de explotación = comunidad + IBI + seguro + otros + mantenimiento + gestión (+ gastos extraordinarios repartidos).",
    "Flujo de caja = renta cobrada − gastos de explotación − cuota de la hipoteca (intereses + capital) − impuestos del alquiler.",
    "Rentabilidad bruta = renta anual / valor de venta. Rentabilidad neta = (renta cobrada − gastos de explotación sin extraordinarios) / valor de venta.",
    "Patrimonio A = neto de la venta × (1 + rentabilidad alternativa)^años. B = caja del alquiler reinvertida + neto de la venta futura. C = caja del alquiler reinvertida + (valor futuro − hipoteca pendiente).",
  ].forEach((t) => w.text(`• ${t}`, { size: 8.5 }));

  w.subheading("Hipótesis utilizadas", true);
  const meta = assumptionMeta(input, hintsFromSnapshot(snapshot));
  const show: Array<keyof StudyAssumptions> = [
    "appreciationPct", "rentGrowthPct", "costInflationPct", "vacancyMonths", "managementPct", "maintenancePctRent", "opportunityRatePct",
    "agencyFeePct", "notaryAndOtherSaleCosts", "plusvaliaRatePct", "marginalRatePct", "communityFeesYear", "ibiYear", "insuranceYear", "otherCostsYear", "extraordinaryCosts",
  ];
  w.table(
    ["Hipótesis", "Valor", "Naturaleza"],
    show.map((k) => {
      const v = a[k];
      const unit = /Pct$/.test(k) ? " %" : k === "vacancyMonths" ? " meses/año" : " €";
      return [meta[k].label, v == null ? "Desconocido (no incluido)" : `${typeof v === "number" ? v.toLocaleString("es-ES") : v}${unit}`, ORIGIN_LABELS[meta[k].origin]];
    }),
    [2.6, 1.2, 1.2],
  );

  // 12. Aviso legal y limitaciones
  w.heading(12, "Aviso legal y limitaciones");
  w.text(
    "Estudio orientativo elaborado con la información aportada por el propietario y con fuentes públicas citadas. No es una tasación oficial (Orden ECO/805/2003) ni constituye asesoramiento financiero, fiscal o jurídico. FINCALIA360 no garantiza los resultados: los precios, las rentas, los plazos y los costes reales pueden diferir. Documento confidencial destinado al propietario del inmueble.",
    { size: 8.5 },
  );
  const limitations = [
    ...report.main.incomplete,
    ...(report.sale.estimate?.limitations ?? []),
    ...(report.rent.statistical?.limitations ?? []),
    ...report.snapshotWarnings,
    ...report.main.warnings,
    ...report.rent.notes,
  ];
  [...new Set(limitations)].forEach((l) => w.text(`• ${l}`, { size: 8.5 }));
  if (snapshot.missingData.length) {
    w.text("Datos que mejorarían el estudio:", { bold: true, size: 9 });
    snapshot.missingData.forEach((m) => w.text(`• ${m}`, { size: 8.5 }));
  }

  // ---------------- Portada e índice al principio ----------------
  const contentPages = doc.getPages().slice();
  const cover = doc.insertPage(0, [A4.w, A4.h]);
  const tocCount = tocPagesNeeded(w.nav);
  const tocPages = Array.from({ length: tocCount }, (_, i) => doc.insertPage(1 + i, [A4.w, A4.h]));
  drawCover(
    cover,
    {
      clientName: params.clientName?.trim() || null,
      address: input.location.address ?? snapshot.geo?.address ?? null,
      cadastralRef: input.location.cadastralRef,
      municipality: input.location.municipalityName,
      province: prov?.name ?? null,
      propertyLine: `${PROPERTY_KIND_LABELS[input.property.kind]} · ${input.property.sqm} m² construidos · ${input.property.bedrooms} hab. · ${input.property.bathrooms} baños`,
      generatedAt,
      studyId: params.studyId,
    },
    { regular: font, bold },
    logo,
    cleanPdfText,
  );
  const allPages = doc.getPages();
  const pageNumberOf = (pg: PDFPage) => allPages.indexOf(pg) + 1;
  drawToc(doc, tocPages, w.nav, { regular: font, bold }, pageNumberOf, cleanPdfText);

  // Marcadores: secciones de nivel 1 con sus subapartados
  const outline: Array<{ title: string; page: PDFPage; y: number; children: Array<{ title: string; page: PDFPage; y: number }> }> = [
    { title: "Portada", page: cover, y: A4.h, children: [] },
    { title: "Índice", page: tocPages[0], y: A4.h, children: [] },
  ];
  for (const e of w.nav) {
    const title = e.num ? `${e.num}. ${e.title}` : e.title;
    if (e.level === 1 || !outline.length) outline.push({ title, page: e.page, y: e.y, children: [] });
    else outline[outline.length - 1].children.push({ title, page: e.page, y: e.y });
  }
  addOutline(doc, outline);
  for (const l of w.links) addUriLink(doc, l.page, l.rect, l.url);

  // Pie de página en todas las páginas salvo la portada: «página X de N» y enlace al índice
  allPages.forEach((pg, i) => {
    if (i === 0) return;
    pg.drawText(cleanPdfText(`Estudio orientativo, no vinculante · Generado el ${generatedAt.toLocaleDateString("es-ES")} · Ref. ${params.studyId.slice(-8)}`), { x: M, y: 26, size: 7.5, font, color: MUTED });
    const label = `Página ${i + 1} de ${allPages.length}`;
    pg.drawText(label, { x: A4.w - M - font.widthOfTextAtSize(label, 7.5), y: 26, size: 7.5, font, color: MUTED });
    if (!tocPages.includes(pg)) {
      const back = "Volver al índice";
      const bw = font.widthOfTextAtSize(back, 7.5);
      const bx = A4.w / 2 + 60;
      pg.drawText(back, { x: bx, y: 26, size: 7.5, font, color: ACCENT });
      addInternalLink(doc, pg, [bx - 2, 22, bx + bw + 2, 35], tocPages[0], A4.h);
    }
  });
  void contentPages;

  return doc.save({ useObjectStreams: false });
}

export { buildStudyReport };
