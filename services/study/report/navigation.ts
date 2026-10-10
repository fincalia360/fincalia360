// Navegación del informe PDF: portada, índice con enlaces internos, marcadores (panel lateral del lector)
// y enlaces externos. Módulo independiente: el generador (pdf.ts) le pasa las secciones que ha dibujado
// y en qué página/altura empieza cada una; aquí se añaden la portada y el índice al principio.
import { PDFDocument, PDFHexString, PDFName, PDFNull, PDFString, rgb, type PDFFont, type PDFImage, type PDFPage, type PDFRef } from "pdf-lib";

export interface NavEntry {
  level: 1 | 2;
  /** Número de sección («3») o null para entradas sin número (resumen ejecutivo). */
  num: string | null;
  title: string;
  page: PDFPage;
  /** Coordenada y (desde abajo) del comienzo de la sección en su página. */
  y: number;
}

export interface CoverInfo {
  clientName: string | null;
  address: string | null;
  cadastralRef: string | null;
  municipality: string;
  province: string | null;
  propertyLine: string;
  generatedAt: Date;
  studyId: string;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 48;
const INK = rgb(0.078, 0.169, 0.271); // #142B45
const ACCENT = rgb(0.137, 0.518, 0.467); // #238477
const OFFWHITE = rgb(0.969, 0.973, 0.961); // #F7F8F5
const SOFT = rgb(0.78, 0.82, 0.86);
const MUTED = rgb(0.4, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.88);

type Clean = (s: string) => string;

/** Destino interno: página y altura (el lector abre la página justo en ese punto). */
function dest(doc: PDFDocument, pageRef: PDFRef, y: number) {
  return doc.context.obj([pageRef, PDFName.of("XYZ"), PDFNull, Math.min(A4.h, Math.round(y + 12)), PDFNull]);
}

/** Enlace interno: un rectángulo clicable que lleva a otra página. */
export function addInternalLink(doc: PDFDocument, page: PDFPage, rect: [number, number, number, number], target: PDFPage, targetY: number) {
  const annot = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0], Dest: dest(doc, target.ref, targetY) });
  page.node.addAnnot(doc.context.register(annot));
}

/** Enlace externo (URL). Solo http(s). */
export function addUriLink(doc: PDFDocument, page: PDFPage, rect: [number, number, number, number], url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  const annot = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } });
  page.node.addAnnot(doc.context.register(annot));
}

/** Marcadores jerárquicos (nivel 1 y 2) en el panel lateral del lector. */
export function addOutline(doc: PDFDocument, entries: Array<{ title: string; page: PDFPage; y: number; children?: Array<{ title: string; page: PDFPage; y: number }> }>) {
  if (!entries.length) return;
  const ctx = doc.context;
  const rootRef = ctx.nextRef();
  const topRefs = entries.map(() => ctx.nextRef());
  let visible = entries.length;
  entries.forEach((e, i) => {
    const kids = e.children ?? [];
    const kidRefs = kids.map(() => ctx.nextRef());
    kids.forEach((k, j) => {
      ctx.assign(
        kidRefs[j],
        ctx.obj({
          Title: PDFHexString.fromText(k.title),
          Parent: topRefs[i],
          Dest: dest(doc, k.page.ref, k.y),
          ...(j > 0 ? { Prev: kidRefs[j - 1] } : {}),
          ...(j < kids.length - 1 ? { Next: kidRefs[j + 1] } : {}),
        }),
      );
    });
    visible += kids.length;
    ctx.assign(
      topRefs[i],
      ctx.obj({
        Title: PDFHexString.fromText(e.title),
        Parent: rootRef,
        Dest: dest(doc, e.page.ref, e.y),
        ...(i > 0 ? { Prev: topRefs[i - 1] } : {}),
        ...(i < entries.length - 1 ? { Next: topRefs[i + 1] } : {}),
        ...(kidRefs.length ? { First: kidRefs[0], Last: kidRefs[kidRefs.length - 1], Count: kidRefs.length } : {}),
      }),
    );
  });
  ctx.assign(rootRef, ctx.obj({ Type: "Outlines", First: topRefs[0], Last: topRefs[topRefs.length - 1], Count: visible }));
  doc.catalog.set(PDFName.of("Outlines"), rootRef);
  doc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Portada. Sin fotografía autorizada se usa un motivo gráfico abstracto (nunca una imagen inventada del inmueble). */
export function drawCover(page: PDFPage, info: CoverInfo, fonts: { regular: PDFFont; bold: PDFFont }, logo: PDFImage | null, clean: Clean) {
  const { regular, bold } = fonts;
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: INK });
  // Motivo gráfico: arcos concéntricos y franja de acento (identidad FINCALIA360)
  for (let i = 0; i < 6; i++) {
    page.drawCircle({ x: A4.w + 40, y: A4.h - 120, size: 120 + i * 46, borderColor: rgb(0.16, 0.27, 0.38), borderWidth: 1, opacity: 0, borderOpacity: 0.9 - i * 0.12 });
  }
  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: ACCENT });
  if (logo) {
    const h = 40;
    page.drawImage(logo, { x: M, y: A4.h - 92, width: (logo.width / logo.height) * h, height: h });
  } else page.drawText("FINCALIA360", { x: M, y: A4.h - 80, size: 22, font: bold, color: OFFWHITE });

  let y = A4.h - 250;
  page.drawRectangle({ x: M, y: y + 40, width: 46, height: 3, color: ACCENT });
  page.drawText(clean("ESTUDIO INMOBILIARIO"), { x: M, y, size: 30, font: bold, color: OFFWHITE });
  y -= 36;
  page.drawText(clean("PERSONALIZADO"), { x: M, y, size: 30, font: bold, color: OFFWHITE });
  y -= 30;
  page.drawText(clean("Análisis de rentabilidad: venta frente a alquiler"), { x: M, y, size: 14, font: regular, color: SOFT });

  // Ficha del estudio
  y -= 52;
  const rows: Array<[string, string | null, string]> = [
    ["Cliente", info.clientName, "No indicado"],
    ["Inmueble", info.propertyLine, "—"],
    ["Dirección", info.address, "No indicada"],
    ["Municipio", [info.municipality, info.province].filter(Boolean).join(" (") + (info.province ? ")" : ""), "—"],
    ["Referencia catastral", info.cadastralRef, "No indicada (no se completa sin el dato)"],
    ["Fecha de elaboración", info.generatedAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }), "—"],
    ["Identificador del estudio", info.studyId, "—"],
  ];
  const labelW = 150;
  const valueW = A4.w - 2 * M - labelW;
  page.drawLine({ start: { x: M, y: y + 14 }, end: { x: A4.w - M, y: y + 14 }, thickness: 0.6, color: rgb(0.25, 0.36, 0.47) });
  for (const [label, value, fallback] of rows) {
    const text = clean(value?.trim() ? value : fallback);
    const lines = wrap(text, value ? bold : regular, 11, valueW);
    page.drawText(clean(label.toUpperCase()), { x: M, y, size: 8, font: bold, color: SOFT });
    lines.forEach((l, i) => page.drawText(l, { x: M + labelW, y: y - i * 14, size: 11, font: value ? bold : regular, color: value ? OFFWHITE : SOFT }));
    y -= Math.max(1, lines.length) * 14 + 12;
    page.drawLine({ start: { x: M, y: y + 12 }, end: { x: A4.w - M, y: y + 12 }, thickness: 0.4, color: rgb(0.2, 0.31, 0.42) });
  }

  // Fotografía: solo si existe una autorizada (hoy el estudio no la tiene)
  y -= 6;
  page.drawText(clean("Fotografía del inmueble: no aportada. Solo se incluyen fotografías autorizadas por el propietario."), { x: M, y, size: 8, font: regular, color: SOFT });

  // Aviso de confidencialidad
  const notice =
    "CONFIDENCIAL. Documento elaborado para el uso exclusivo del propietario del inmueble. Estudio orientativo: no constituye una tasación oficial ni asesoramiento financiero, fiscal o jurídico. Las cifras dependen de las fuentes citadas y de las hipótesis indicadas en el propio informe.";
  const nLines = wrap(clean(notice), regular, 8.5, A4.w - 2 * M - 24);
  const boxH = nLines.length * 12 + 20;
  page.drawRectangle({ x: M, y: 56, width: A4.w - 2 * M, height: boxH, color: rgb(0.11, 0.21, 0.32) });
  nLines.forEach((l, i) => page.drawText(l, { x: M + 12, y: 56 + boxH - 18 - i * 12, size: 8.5, font: regular, color: SOFT }));
  page.drawText("fincalia360", { x: M, y: 32, size: 8, font: regular, color: rgb(0.5, 0.58, 0.66) });
}

const TOC_TOP = A4.h - M - 70;
const TOC_LINE = 19;
export function tocPagesNeeded(entries: NavEntry[]) {
  const perPage = Math.floor((TOC_TOP - 70) / TOC_LINE);
  return Math.max(1, Math.ceil(entries.length / perPage));
}

/** Índice con números de página reales; cada línea es un enlace interno a su sección. */
export function drawToc(
  doc: PDFDocument,
  pages: PDFPage[],
  entries: NavEntry[],
  fonts: { regular: PDFFont; bold: PDFFont },
  pageNumberOf: (p: PDFPage) => number,
  clean: Clean,
) {
  const { regular, bold } = fonts;
  let pi = 0;
  let page = pages[0];
  const header = (pg: PDFPage, first: boolean) => {
    pg.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: ACCENT });
    pg.drawText(first ? "Índice" : "Índice (continuación)", { x: M, y: A4.h - M - 20, size: 22, font: bold, color: INK });
    if (first) pg.drawText(clean("Pulsa sobre cualquier apartado para ir directamente a él. Los marcadores del lector muestran la misma estructura."), { x: M, y: A4.h - M - 40, size: 8.5, font: regular, color: MUTED });
  };
  header(page, true);
  let y = TOC_TOP;
  for (const e of entries) {
    if (y < 70) {
      pi += 1;
      page = pages[pi];
      header(page, false);
      y = TOC_TOP;
    }
    const isTop = e.level === 1;
    const size = isTop ? 11 : 9.5;
    const font = isTop ? bold : regular;
    const indent = isTop ? 0 : 22;
    const label = clean(e.num ? `${e.num}  ${e.title}` : e.title);
    const num = String(pageNumberOf(e.page));
    const numW = regular.widthOfTextAtSize(num, size);
    const x0 = M + indent;
    const maxLabelW = A4.w - 2 * M - indent - numW - 30;
    let text = label;
    while (font.widthOfTextAtSize(text, size) > maxLabelW && text.length > 4) text = text.slice(0, -2);
    if (text !== label) text = `${text.trimEnd()}…`;
    page.drawText(text, { x: x0, y, size, font, color: INK });
    const after = x0 + font.widthOfTextAtSize(text, size) + 6;
    const before = A4.w - M - numW - 6;
    // Puntos guía
    for (let x = after; x < before; x += 4) page.drawText(".", { x, y, size: 8, font: regular, color: LINE });
    page.drawText(num, { x: A4.w - M - numW, y, size, font: regular, color: INK });
    addInternalLink(doc, page, [x0 - 2, y - 4, A4.w - M + 2, y + size + 2], e.page, e.y);
    y -= isTop ? TOC_LINE + 2 : TOC_LINE - 3;
  }
}
