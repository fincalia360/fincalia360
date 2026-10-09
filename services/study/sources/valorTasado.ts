// Estadística de Valor Tasado de la Vivienda (Ministerio de Vivienda y Agenda Urbana).
// Datos importados con `python scripts/import-valor-tasado.py` a data/valor-tasado/.
// Valor medio de TASACIÓN de vivienda libre (€/m²), trimestral:
//  · municipios de más de 25.000 habitantes (por antigüedad: hasta 5 años / más de 5 años)
//  · provincias (resto de municipios).
// No son precios de anuncio ni la tasación de una vivienda concreta.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getProvince, ineToCommonName, normalizeName } from "../geo";

export interface ValorTasadoQuarter {
  hasta5: number | null;
  mas5: number | null;
  total: number | null;
  n: number;
}

interface MunicipioRow {
  provincia: string;
  municipio: string;
  trimestres: Record<string, ValorTasadoQuarter>;
}

export interface ValorTasadoMeta {
  source: string;
  sourceUrlMunicipios: string;
  sourceUrlProvincias: string;
  trimestresMunicipios: string[];
  ultimoTrimestreProvincias: string;
  importedAt: string;
  notes: string;
}

/** Nombre de cada provincia (código INE) en la tabla provincial del Ministerio. */
const PROVINCE_KEYS: Record<string, string> = {
  "01": "Araba/Alava", "02": "Albacete", "03": "Alicante/Alacant", "04": "Almería", "05": "Ávila", "06": "Badajoz", "07": "Balears (Illes)",
  "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón/Castelló", "13": "Ciudad Real", "14": "Córdoba",
  "15": "Coruña (A)", "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa", "21": "Huelva", "22": "Huesca",
  "23": "Jaén", "24": "León", "25": "Lleida", "26": "Rioja (La)", "27": "Lugo", "28": "Madrid (Comunidad de)", "29": "Málaga",
  "30": "Murcia (Región de)", "31": "Navarra (Comunidad Foral de)", "32": "Ourense", "33": "Asturias (Principado de )", "34": "Palencia",
  "35": "Palmas (Las)", "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia",
  "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia/València", "47": "Valladolid",
  "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

function dataDir() {
  const candidates = [path.join(process.cwd(), "data", "valor-tasado"), path.join(process.cwd(), "captacion-costa-brava", "data", "valor-tasado")];
  return candidates.find((dir) => existsSync(path.join(dir, "_meta.json"))) ?? null;
}

let loaded: { meta: ValorTasadoMeta; municipios: MunicipioRow[]; provincias: Record<string, Record<string, number>> } | null | undefined;
function load() {
  if (loaded !== undefined) return loaded;
  const dir = dataDir();
  loaded = dir
    ? {
        meta: JSON.parse(readFileSync(path.join(dir, "_meta.json"), "utf-8")),
        municipios: JSON.parse(readFileSync(path.join(dir, "municipios.json"), "utf-8")),
        provincias: JSON.parse(readFileSync(path.join(dir, "provincias.json"), "utf-8")),
      }
    : null;
  return loaded;
}

/** "Ejido (El)" → "El Ejido"; "Palmas de Gran Canaria (Las)" → "Las Palmas de Gran Canaria". */
function commonName(name: string) {
  const m = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? ineToCommonName(`${m[1]}, ${m[2]}`) : name;
}

const variants = (name: string) => new Set([name, commonName(name), ineToCommonName(name), ...name.split("/")].map((n) => normalizeName(n)));

export interface ValorTasadoResult {
  scope: "MUNICIPIO" | "PROVINCIA";
  name: string;
  quarter: string;
  /** €/m² aplicable (según la antigüedad cuando el dato es representativo). */
  value: number;
  basis: "HASTA_5" | "MAS_5" | "TOTAL";
  appraisals: number | null;
  /** Variación interanual del valor (mismo trimestre del año anterior), si existe. */
  yearOnYearPct: number | null;
  meta: ValorTasadoMeta;
}

export function getValorTasado(params: { provinceCode: string; municipalityName: string; yearBuilt: number | null; today?: Date }): ValorTasadoResult | null {
  const data = load();
  if (!data) return null;
  const wanted = variants(params.municipalityName);
  const matches = data.municipios.filter((m) => [...variants(m.municipio)].some((v) => wanted.has(v)));
  const provinceName = PROVINCE_KEYS[params.provinceCode];
  // Si el nombre coincide en varias provincias, se elige la de la provincia indicada
  const muni = matches.length > 1 ? (matches.find((m) => provinceName && normalizeName(provinceName).includes(normalizeName(m.provincia).split(" ")[0])) ?? null) : matches[0];
  const age = params.yearBuilt ? (params.today ?? new Date()).getFullYear() - params.yearBuilt : null;

  if (muni) {
    const quarters = Object.keys(muni.trimestres).sort();
    // Último trimestre con dato representativo
    for (const q of [...quarters].reverse()) {
      const t = muni.trimestres[q];
      const byAge = age != null && age <= 5 ? t.hasta5 : age != null ? t.mas5 : null;
      const value = byAge ?? t.total;
      if (!value) continue;
      const prevYear = `${Number(q.slice(0, 4)) - 1}${q.slice(4)}`;
      const prev = muni.trimestres[prevYear]?.total;
      return {
        scope: "MUNICIPIO",
        name: commonName(muni.municipio),
        quarter: q,
        value,
        basis: byAge ? (age! <= 5 ? "HASTA_5" : "MAS_5") : "TOTAL",
        appraisals: t.n || null,
        yearOnYearPct: prev && t.total ? Math.round((t.total / prev - 1) * 1000) / 10 : null,
        meta: data.meta,
      };
    }
  }

  const series = provinceName ? data.provincias[provinceName] : undefined;
  if (!series) return null;
  const quarters = Object.keys(series).sort();
  const q = quarters[quarters.length - 1];
  const prev = series[`${Number(q.slice(0, 4)) - 1}${q.slice(4)}`];
  return {
    scope: "PROVINCIA",
    name: getProvince(params.provinceCode)?.name ?? provinceName!,
    quarter: q,
    value: series[q],
    basis: "TOTAL",
    appraisals: null,
    yearOnYearPct: prev ? Math.round((series[q] / prev - 1) * 1000) / 10 : null,
    meta: data.meta,
  };
}
