// SERPAVI — Sistema Estatal de Referencia del Precio del Alquiler de Vivienda (MIVAU).
// Datos importados del fichero oficial con `python scripts/import-serpavi.py <xlsx>`
// a data/serpavi/<provincia>.json. Son rentas DECLARADAS (fuentes tributarias),
// no precios de anuncio. Última versión importada: ver data/serpavi/_meta.json.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface SerpaviYear {
  n: number; // nº de viviendas con alquiler declarado
  m: number; // €/m² mes, mediana
  p25: number;
  p75: number;
  sup: number; // superficie mediana m²
}

export interface SerpaviMunicipality {
  name: string;
  years: Record<string, { VC?: SerpaviYear; VU?: SerpaviYear }>;
}

export interface SerpaviMeta {
  source: string;
  sourceUrl: string;
  file: string;
  importedAt: string;
  notes: string;
}

function dataDir() {
  const candidates = [
    process.env.SERPAVI_DATA_DIR,
    path.join(process.cwd(), "data", "serpavi"),
    path.join(process.cwd(), "captacion-costa-brava", "data", "serpavi"),
  ].filter(Boolean) as string[];
  return candidates.find((dir) => existsSync(path.join(dir, "_meta.json"))) ?? null;
}

const cache = new Map<string, { meta: SerpaviMeta; municipios: Record<string, SerpaviMunicipality> } | null>();

function loadProvince(provinceCode: string) {
  if (cache.has(provinceCode)) return cache.get(provinceCode)!;
  const dir = dataDir();
  const file = dir ? path.join(dir, `${provinceCode}.json`) : null;
  const value = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf-8")) : null;
  cache.set(provinceCode, value);
  return value;
}

export function serpaviAvailable() {
  return dataDir() !== null;
}

export function getSerpaviMeta(): SerpaviMeta | null {
  const dir = dataDir();
  return dir ? (JSON.parse(readFileSync(path.join(dir, "_meta.json"), "utf-8")) as SerpaviMeta) : null;
}

export function getSerpaviMunicipality(municipalityCode: string) {
  const data = loadProvince(municipalityCode.slice(0, 2));
  if (!data) return null;
  const municipality = data.municipios[municipalityCode];
  return municipality ? { municipality, meta: data.meta as SerpaviMeta } : null;
}

/** Último año con dato para la tipología indicada. */
export function latestSerpaviYear(m: SerpaviMunicipality, typology: "VC" | "VU") {
  const years = Object.keys(m.years)
    .filter((y) => m.years[y][typology])
    .sort();
  const year = years[years.length - 1];
  return year ? { year, data: m.years[year][typology]! } : null;
}
