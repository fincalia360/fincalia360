// Zonas de mercado residencial tensionado (Ley 12/2023, art. 18).
// Fuente oficial: relación publicada por el Ministerio de Vivienda y Agenda Urbana, con la
// resolución del BOE y el periodo de vigencia de cada declaración.
// No se deduce nada solo por el nombre del municipio: se comprueba que el municipio figure
// en una declaración, su ámbito (municipio completo o parcial) y su vigencia en la fecha actual.
import { prisma } from "@/db/client";
import { fetchWithTimeout } from "./http";
import { normalizeName, tokenSet } from "../geo";
import type { SourceRef, TensionedCheck } from "../types";

export const MIVAU_TENSIONED_URL =
  "https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi/consultar-zonas-de-mercado-residencial-tensionado";

export interface Declaration {
  ccaa: string;
  municipalitiesText: string;
  validFrom: Date | null;
  validTo: Date | null;
  resolution: string;
  bulletin: string | null;
  sourceUrl: string;
}

const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function decodeEntities(text: string) {
  const named: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => named[n.toLowerCase()] ?? m);
}

export function parseSpanishDate(text: string): Date | null {
  const m = normalizeName(text).match(/(\d{1,2}) de ([a-z]+) de (\d{4})/);
  if (!m || MONTHS[m[2]] === undefined) return null;
  return new Date(Date.UTC(Number(m[3]), MONTHS[m[2]], Number(m[1])));
}

/** Convierte la página oficial en una lista de declaraciones. */
export function parseTensionedAreasHtml(html: string, sourceUrl = MIVAU_TENSIONED_URL): Declaration[] {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head[\s\S]*?<\/head>/gi, "");
  const text = decodeEntities(body.replace(/<[^>]+>/g, "|"))
    .replace(/\s+/g, " ")
    .replace(/(\s*\|\s*)+/g, "|");
  const re =
    /Comunidad aut[oó]noma\|([^|]+)\|Municipios?\|([^|]+)\|Periodo de vigencia[^|]*\|([^|]+)\|Resoluci[oó]n MIVAU\|([^|]+)\|(BOE[^|]*)?/gi;
  const out: Declaration[] = [];
  for (const m of text.matchAll(re)) {
    const [, ccaa, municipalities, period, resolution, bulletin] = m;
    const [fromText, toText] = period.split(/hasta/i);
    out.push({
      ccaa: ccaa.trim(),
      municipalitiesText: municipalities.trim(),
      validFrom: parseSpanishDate(fromText ?? ""),
      validTo: parseSpanishDate(toText ?? ""),
      resolution: resolution.trim(),
      bulletin: bulletin?.trim() || null,
      sourceUrl,
    });
  }
  return out;
}

const CCAA_STOPWORDS = new Set(["de", "la", "el", "comunidad", "comunitat", "region", "principado", "foral", "illes", "ciudad", "autonoma"]);

function sameRegion(a: string, b: string) {
  const ta = [...tokenSet(a)].filter((t) => !CCAA_STOPWORDS.has(t));
  const tb = new Set([...tokenSet(b)].filter((t) => !CCAA_STOPWORDS.has(t)));
  return ta.some((t) => tb.has(t));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normaliza carácter a carácter manteniendo la correspondencia de posiciones con el original. */
function normalizeWithMap(text: string) {
  let out = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalizeList(text[i]);
    for (let k = 0; k < n.length; k++) map.push(i);
    out += n;
  }
  map.push(text.length);
  return { out, map };
}

function normalizeList(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ");
}

/** Busca el municipio dentro del texto de una declaración. Devuelve la nota de ámbito parcial si existe. */
export function findMunicipalityInText(text: string, names: string[]): { found: boolean; partialNote: string | null } {
  // El texto ya llega con espacios normalizados por el parser; se normaliza carácter a carácter.
  const { out: haystack, map } = normalizeWithMap(text.replace(/\s+/g, " "));
  const original = text.replace(/\s+/g, " ");
  for (const name of names) {
    const needle = escapeRegex(normalizeList(name).trim());
    const re = new RegExp(`(?:^|[,;:]\\s*|\\s(?:y|e|i)\\s)${needle}(\\s*\\(([^)]*)\\))?(?=\\s*(?:[,.;]|$|\\s(?:y|e|i)\\s))`, "d");
    const m = re.exec(haystack);
    if (m) {
      // Nota de ámbito parcial con su texto original (acentos y mayúsculas)
      const idx = m.indices?.[2];
      const partialNote = idx ? original.slice(map[idx[0]], map[idx[1]]).trim() || null : null;
      return { found: true, partialNote };
    }
  }
  return { found: false, partialNote: null };
}

function fmt(d: Date | null) {
  return d ? d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—";
}

export function checkTensionedArea(params: {
  municipalityNames: string[];
  ccaaName: string;
  declarations: Declaration[];
  importedAt: Date | null;
  today?: Date;
}): TensionedCheck {
  const today = params.today ?? new Date();
  const source: SourceRef = {
    name: "Ministerio de Vivienda y Agenda Urbana · Zonas de mercado residencial tensionado",
    url: MIVAU_TENSIONED_URL,
    retrievedAt: params.importedAt?.toISOString(),
    status: params.importedAt ? "OK" : "NOT_AVAILABLE",
  };
  if (!params.declarations.length) {
    return {
      status: "UNKNOWN",
      summary: "No verificado",
      detail: "No se ha podido consultar la relación oficial de zonas tensionadas. Compruébalo en la web del Ministerio antes de fijar una renta.",
      source,
    };
  }
  const matches = params.declarations
    .filter((d) => sameRegion(d.ccaa, params.ccaaName))
    .map((d) => ({ d, hit: findMunicipalityInText(d.municipalitiesText, params.municipalityNames) }))
    .filter((x) => x.hit.found);

  const active = matches.filter(({ d }) => (!d.validFrom || d.validFrom <= today) && (!d.validTo || d.validTo >= today));
  const pick = (active.length ? active : matches).sort((a, b) => (b.d.validTo?.getTime() ?? 0) - (a.d.validTo?.getTime() ?? 0))[0];

  if (!pick) {
    return {
      status: "NOT_FOUND",
      summary: "No figura como zona tensionada",
      detail:
        "El municipio no aparece en la relación oficial importada. Puede haber declaraciones posteriores a la fecha de consulta: verifica en la fuente oficial antes de firmar un contrato.",
      source,
    };
  }
  const base = {
    validFrom: pick.d.validFrom?.toISOString() ?? null,
    validTo: pick.d.validTo?.toISOString() ?? null,
    resolution: pick.d.resolution,
    bulletin: pick.d.bulletin,
    source: { ...source, url: pick.d.sourceUrl },
  };
  if (!active.length) {
    return {
      ...base,
      status: "EXPIRED",
      summary: "Declaración no vigente",
      detail: `El municipio figuró en una declaración con vigencia hasta el ${fmt(pick.d.validTo)}. Comprueba si existe una prórroga o nueva declaración.`,
    };
  }
  if (pick.hit.partialNote) {
    return {
      ...base,
      status: "PARTIAL",
      summary: "Zona tensionada en parte del municipio",
      detail: `La declaración afecta solo a: ${pick.hit.partialNote}. Hay que comprobar si la dirección exacta está dentro del ámbito delimitado. Vigente del ${fmt(pick.d.validFrom)} al ${fmt(pick.d.validTo)}.`,
    };
  }
  return {
    ...base,
    status: "DECLARED",
    summary: "Zona de mercado residencial tensionado (municipio completo)",
    detail: `Declaración vigente del ${fmt(pick.d.validFrom)} al ${fmt(pick.d.validTo)}. Afecta a la fijación de la renta en nuevos contratos (Ley 12/2023) según el tipo de arrendador y la vivienda.`,
  };
}

// --- Persistencia e importación -------------------------------------------

export async function importTensionedAreas() {
  const res = await fetchWithTimeout(MIVAU_TENSIONED_URL, 20000, "text/html");
  const html = await res.text();
  const declarations = parseTensionedAreasHtml(html);
  if (declarations.length < 3) throw new Error("No se han podido interpretar las declaraciones de la página oficial (¿ha cambiado su formato?).");
  const importedAt = new Date();
  await prisma.$transaction([
    prisma.tensionedAreaDeclaration.deleteMany(),
    prisma.tensionedAreaDeclaration.createMany({
      data: declarations.map((d) => ({ ...d, importedAt })),
    }),
  ]);
  return { count: declarations.length, importedAt };
}

export async function getDeclarations(options: { autoRefreshDays?: number } = {}) {
  let rows = await prisma.tensionedAreaDeclaration.findMany();
  const importedAt = rows[0]?.importedAt ?? null;
  const maxAge = (options.autoRefreshDays ?? 7) * 24 * 3600 * 1000;
  if (!importedAt || Date.now() - importedAt.getTime() > maxAge) {
    try {
      await importTensionedAreas();
      rows = await prisma.tensionedAreaDeclaration.findMany();
    } catch (error) {
      console.warn("[zonas-tensionadas] no se pudo actualizar:", (error as Error).message);
    }
  }
  return { declarations: rows as Declaration[], importedAt: rows[0]?.importedAt ?? null };
}
