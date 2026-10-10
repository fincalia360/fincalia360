// Ubicación de la vivienda y mapa de valores del Catastro (datos públicos no protegidos).
//  - Coordenadas por referencia catastral: servicio OVC «Consulta_CPMRC».
//  - Mapa de valores urbano: Ámbitos Territoriales Homogéneos (ATH) con el Módulo de Valor Medio (MVM)
//    de la vivienda y del garaje representativos de cada zona. La Dirección General del Catastro los
//    calcula cada año a partir de los PRECIOS DE TODAS LAS COMPRAVENTAS escrituradas (Informe Anual del
//    Mercado Inmobiliario) y los publica en abierto en su Sede Electrónica. Se consultan una vez por
//    estudio, como lo haría el visor público, y se guardan en caché.
// Fuente a citar: «Dirección General del Catastro» con la fecha de consulta.
import { cachedFetch, fetchJson } from "./http";
import type { CatastroValueZone, PropertyGeo } from "../types";

const COORD_URL = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_CPMRC";
const ZONES_URL = "https://www1.sedecatastro.gob.es/Cartografia/SECDameGeoJSON.aspx";
export const VALUE_MAP_PAGE = "https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?buscar=S";
export const VALUE_MAP_LEGEND = "https://www.catastro.hacienda.gob.es/ayuda/leyenda_mapavalores.htm";

/** WGS84 (lat/lon) → Web Mercator (EPSG:3857). */
export function toWebMercator(lat: number, lon: number) {
  const R = 6378137;
  const x = (lon * Math.PI * R) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { x, y };
}

export async function getParcelGeo(cadastralRef: string): Promise<PropertyGeo | null> {
  const rc14 = cadastralRef.trim().toUpperCase().slice(0, 14);
  if (!/^[0-9A-Z]{14}$/.test(rc14)) return null;
  const { data } = await cachedFetch(
    `catastro:coord:${rc14}`,
    "Catastro",
    async () => {
      const j = await fetchJson<{ Consulta_CPMRCResult?: { coordenadas?: { coord?: Array<{ geo: { xcen: string; ycen: string }; ldt?: string }> } } }>(
        `${COORD_URL}?Provincia=&Municipio=&SRS=EPSG:4326&RefCat=${rc14}`,
        15000,
      );
      const c = j.Consulta_CPMRCResult?.coordenadas?.coord?.[0];
      if (!c) return null;
      return { lon: Number(c.geo.xcen), lat: Number(c.geo.ycen), address: c.ldt ?? null };
    },
    24 * 90,
  );
  if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lon)) return null;
  return { lat: data.lat, lon: data.lon, cadastralRef: rc14, address: data.address };
}

type Ring = Array<[number, number]>;
interface ZoneFeature {
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] };
  properties: {
    zona_valor?: string;
    cod_zona?: string;
    ejercicio?: number;
    visualizar_sede?: string;
    num_inmuebles_uso_v?: number;
    num_inmuebles_uso_a?: number;
    Ptipo1?: {
      tipologia?: string;
      categoria?: string;
      antiguedad?: number;
      conservacion?: string;
      superficie?: number;
      superficie_anejos?: number;
      superficie_suelo?: number;
      num_inmueble?: number;
      val_tipo?: number;
      val_tipo_m2?: number;
    };
  };
}

function pointInRing([x, y]: [number, number], ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ¿El punto (lon, lat) está dentro de la zona? (anillo exterior; los huecos se respetan) */
export function featureContains(f: ZoneFeature, lon: number, lat: number) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as Ring[]] : (f.geometry.coordinates as Ring[][]);
  return polys.some((rings) => pointInRing([lon, lat], rings[0]) && !rings.slice(1).some((hole) => pointInRing([lon, lat], hole)));
}

async function zonesAt(lat: number, lon: number, kind: "vivienda" | "garaje", year: number) {
  const { x, y } = toWebMercator(lat, lon);
  const key = `catastro:zonas:${kind}:${year}:${lat.toFixed(4)},${lon.toFixed(4)}`;
  const { data } = await cachedFetch(
    key,
    "Catastro · mapa de valores",
    async () => {
      const url = `${ZONES_URL}?del=0&mun=0&huso=3857&x=${x.toFixed(2)}&y=${y.toFixed(2)}&suelo=N&tipo_mapa=${kind}&anyoZV=${year}`;
      const j = await fetchJson<{ features?: ZoneFeature[] }>(url, 20000);
      // Solo se guarda la zona que contiene la vivienda (la respuesta trae todo el municipio)
      return (j.features ?? []).find((f) => featureContains(f, lon, lat)) ?? null;
    },
    24 * 30,
  );
  return data;
}

/** Zona de valor (vivienda y garaje) de la vivienda. null si el Catastro no la publica para ese lugar. */
export async function getValueZone(geo: PropertyGeo, today = new Date()): Promise<CatastroValueZone | null> {
  let year = today.getFullYear();
  let home = await zonesAt(geo.lat, geo.lon, "vivienda", year);
  if (!home) {
    year -= 1;
    home = await zonesAt(geo.lat, geo.lon, "vivienda", year);
  }
  const garage = await zonesAt(geo.lat, geo.lon, "garaje", year).catch(() => null);
  if (!home && !garage) return null;
  const p = home?.properties;
  const pt = p?.Ptipo1;
  const visible = p?.visualizar_sede !== "N";
  const residential =
    visible && pt?.val_tipo_m2 && pt.val_tipo_m2 > 0
      ? {
          mvmM2: pt.val_tipo_m2,
          typology: pt.tipologia ?? "Vivienda",
          category: pt.categoria ?? null,
          ageYears: pt.antiguedad ?? null,
          conservation: pt.conservacion ?? null,
          sqm: pt.superficie ?? null,
          annexSqm: pt.superficie_anejos || null,
          plotSqm: pt.superficie_suelo || null,
          dwellings: p?.num_inmuebles_uso_v ?? pt.num_inmueble ?? null,
        }
      : null;
  const g = garage?.properties;
  const gpt = g?.Ptipo1;
  const garageValue =
    g?.visualizar_sede !== "N" && gpt?.val_tipo && gpt.val_tipo > 0
      ? { value: gpt.val_tipo, typology: gpt.tipologia ?? "Garaje", sqm: gpt.superficie ?? null, units: g?.num_inmuebles_uso_a ?? null }
      : null;
  if (!residential && !garageValue) return null;
  const retrievedAt = today.toISOString().slice(0, 10);
  return {
    year,
    zone: p?.zona_valor ?? g?.zona_valor ?? "—",
    athCode: p?.cod_zona ?? g?.cod_zona ?? null,
    residential,
    garage: garageValue,
    source: {
      name: `Dirección General del Catastro · Mapa de valores urbano ${year} (Informe Anual del Mercado Inmobiliario)`,
      url: VALUE_MAP_PAGE,
      period: String(year),
      retrievedAt,
      status: "OK",
      note: "Módulo de valor medio calculado por el Catastro a partir de los precios de las compraventas escrituradas en la zona.",
    },
  };
}
