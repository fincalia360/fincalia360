// INE — API JSON pública de Tempus3 (sin clave): https://servicios.ine.es/wstempus/js
// Tablas usadas (verificadas en octubre de 2026):
//  - Operación 22 (Cifras oficiales de población, Padrón): "<Provincia>: Población por municipios y sexo"
//  - 59060 Índice de Precios de Vivienda en Alquiler (IPVA) por municipio (> 10.000 hab.)
//  - 80271 Índice de Precios de Vivienda (IPV) por CCAA, medias anuales
//  - 39366 % de viviendas turísticas sobre el total de viviendas (municipios)
import { cachedFetch, fetchJson } from "./http";
import { getProvince, normalizeName, sameTokens, tokenSet } from "../geo";
import type { Series, SourceRef } from "../types";

const BASE = "https://servicios.ine.es/wstempus/js/ES";
const INE_NAME = "Instituto Nacional de Estadística (INE)";

interface IneTable {
  Id: number;
  Nombre: string;
}
interface IneDataPoint {
  Anyo: number;
  T3_Periodo?: string;
  Valor: number | null;
}
interface IneSeries {
  COD?: string;
  Nombre: string;
  Data: IneDataPoint[];
  MetaData?: Array<{ Id: number; T3_Variable: string; Nombre: string; Codigo: string }>;
}

export interface IneMunicipality {
  name: string;
  code: string; // 5 dígitos
  ineValueId: number;
  population: number | null;
  year: number | null;
}

export const INE_TABLES = {
  POPULATION_OPERATION: 22,
  RENT_INDEX_MUNICIPAL: 59060,
  PRICE_INDEX_CCAA_ANNUAL: 80271,
  TOURIST_DWELLINGS_PCT: 39366,
};

function ref(tableId: number | string, period?: string, retrievedAt?: Date, stale = false, note?: string): SourceRef {
  return {
    name: `${INE_NAME} · tabla ${tableId}`,
    url: `https://www.ine.es/jaxiT3/Tabla.htm?t=${tableId}`,
    period,
    retrievedAt: retrievedAt?.toISOString(),
    status: stale ? "STALE" : "OK",
    note,
  };
}

/** Busca la tabla "<Provincia>: Población por municipios y sexo" de la operación 22. */
export async function findPopulationTable(provinceCode: string): Promise<number> {
  const province = getProvince(provinceCode);
  if (!province) throw new Error("Provincia desconocida");
  const { data } = await cachedFetch<IneTable[]>(
    `ine:tables:${INE_TABLES.POPULATION_OPERATION}`,
    "INE",
    () => fetchJson<IneTable[]>(`${BASE}/TABLAS_OPERACION/${INE_TABLES.POPULATION_OPERATION}`),
    24 * 30,
  );
  const table = data.find((t) => {
    const [prefix, rest] = t.Nombre.split(":");
    return rest && normalizeName(rest).startsWith("poblacion por municipios y sexo") && sameTokens(prefix, province.ineName);
  });
  if (!table) throw new Error(`No se encontró la tabla de población del INE para ${province.name}`);
  return table.Id;
}

/** Lista oficial de municipios de una provincia (con código INE y población más reciente). */
export async function listMunicipalities(provinceCode: string) {
  const tableId = await findPopulationTable(provinceCode);
  const result = await cachedFetch<IneSeries[]>(
    `ine:pop-province:${provinceCode}`,
    "INE",
    () => fetchJson<IneSeries[]>(`${BASE}/DATOS_TABLA/${tableId}?nult=1&tip=AM`, 30000),
    24 * 30,
  );
  const municipalities: IneMunicipality[] = [];
  for (const s of result.data) {
    const muni = s.MetaData?.find((m) => m.T3_Variable === "Municipios");
    const sex = s.MetaData?.find((m) => m.T3_Variable === "Sexo");
    if (!muni || !sex || normalizeName(sex.Nombre) !== "total" || !/^\d{5}$/.test(muni.Codigo)) continue;
    const point = s.Data[0];
    municipalities.push({
      name: muni.Nombre,
      code: muni.Codigo,
      ineValueId: muni.Id,
      population: point?.Valor ?? null,
      year: point?.Anyo ?? null,
    });
  }
  municipalities.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { municipalities, tableId, fetchedAt: result.fetchedAt, stale: result.stale };
}

function toSeries(s: IneSeries | undefined, label: string, unit: string, source: SourceRef): Series | null {
  if (!s) return null;
  const points = s.Data.filter((d) => d.Valor != null)
    .map((d) => ({ period: d.T3_Periodo && d.T3_Periodo !== "A" ? `${d.Anyo}-${d.T3_Periodo}` : String(d.Anyo), value: d.Valor as number }))
    .sort((a, b) => a.period.localeCompare(b.period));
  if (!points.length) return null;
  return { label, unit, points, source: { ...source, period: `${points[0].period}–${points[points.length - 1].period}` } };
}

/** Población (total y por sexo) de los últimos años para un municipio. */
export async function getPopulation(provinceCode: string, ineValueId: number, years = 10) {
  const tableId = await findPopulationTable(provinceCode);
  const res = await cachedFetch<IneSeries[]>(`ine:pop:${ineValueId}:${years}`, "INE", () =>
    fetchJson<IneSeries[]>(`${BASE}/DATOS_TABLA/${tableId}?tv=19:${ineValueId}&nult=${years}&tip=A`),
  );
  const source = ref(tableId, undefined, res.fetchedAt, res.stale, "Cifras oficiales de población (revisión del Padrón municipal a 1 de enero).");
  const find = (word: string) =>
    res.data.find((s) => {
      const parts = s.Nombre.split(".").map((x) => normalizeName(x));
      return parts[1] === word && parts[2] === "total habitantes";
    });
  const total = toSeries(find("total"), "Población", "habitantes", source);
  const men = find("hombres")?.Data?.[0];
  const women = find("mujeres")?.Data?.[0];
  return {
    total,
    bySex: men?.Valor != null && women?.Valor != null && men.Anyo === women.Anyo ? { year: String(men.Anyo), men: men.Valor, women: women.Valor } : null,
  };
}

/** IPVA: índice de precios de alquiler del municipio (solo municipios > 10.000 habitantes). */
export async function getRentIndex(ineValueId: number) {
  const res = await cachedFetch<IneSeries[]>(`ine:ipva:${ineValueId}`, "INE", () =>
    fetchJson<IneSeries[]>(`${BASE}/DATOS_TABLA/${INE_TABLES.RENT_INDEX_MUNICIPAL}?tv=19:${ineValueId}&nult=12&tip=A`),
  );
  const index = res.data.find((s) => {
    const parts = s.Nombre.split(".").map((x) => normalizeName(x));
    return parts[1] === "indice" && parts[2] === "total";
  });
  return toSeries(
    index,
    "Índice de precios de vivienda en alquiler (IPVA)",
    "índice",
    ref(INE_TABLES.RENT_INDEX_MUNICIPAL, undefined, res.fetchedAt, res.stale, "Índice (no es un precio). Solo municipios de más de 10.000 habitantes."),
  );
}

/** IPV: índice de precios de vivienda (compraventa) de la comunidad autónoma, medias anuales. */
export async function getPriceIndexCcaa(ccaaIneName: string) {
  const res = await cachedFetch<IneSeries[]>(`ine:ipv-ccaa-annual`, "INE", () =>
    fetchJson<IneSeries[]>(`${BASE}/DATOS_TABLA/${INE_TABLES.PRICE_INDEX_CCAA_ANNUAL}?nult=20&tip=A`, 30000),
  );
  const wanted = tokenSet(ccaaIneName);
  const series = res.data.find((s) => {
    const [region, kind, type] = s.Nombre.split(".").map((x) => x.trim());
    if (!region || normalizeName(kind ?? "") !== "media anual" || normalizeName(type ?? "") !== "general") return false;
    const tokens = tokenSet(region);
    return tokens.size === wanted.size && [...tokens].every((t) => wanted.has(t));
  });
  return toSeries(
    series,
    "Índice de precios de vivienda (IPV), comunidad autónoma",
    "índice",
    ref(INE_TABLES.PRICE_INDEX_CCAA_ANNUAL, undefined, res.fetchedAt, res.stale, "Índice de compraventas a nivel de comunidad autónoma, no del municipio."),
  );
}

/** % de viviendas turísticas sobre el total de viviendas del municipio. */
export async function getTouristDwellingsPct(ineValueId: number) {
  const res = await cachedFetch<IneSeries[]>(`ine:vte:${ineValueId}`, "INE", () =>
    fetchJson<IneSeries[]>(`${BASE}/DATOS_TABLA/${INE_TABLES.TOURIST_DWELLINGS_PCT}?tv=19:${ineValueId}&nult=6&tip=A`),
  );
  return toSeries(
    res.data[0],
    "Viviendas turísticas sobre el total de viviendas",
    "%",
    ref(INE_TABLES.TOURIST_DWELLINGS_PCT, undefined, res.fetchedAt, res.stale, "Estadística experimental del INE."),
  );
}
