// Catastro — Servicios web públicos de la Sede Electrónica del Catastro (sin clave).
// https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/...
//  · ObtenerProvincias / ObtenerMunicipios: nombres que usa el Catastro (con el código INE).
//  · ObtenerCallejero: búsqueda de vías por nombre (coincidencia parcial).
//  · Consulta_DNPLOC: inmuebles de una dirección (vía + número), con escalera, planta y puerta.
//  · Consulta_DNPRC: datos de un inmueble por referencia catastral.
// Solo devuelve datos NO protegidos (uso, superficie, año, localización); nunca titulares ni valor catastral.
// El Catastro NO publica habitaciones, baños, ascensor ni estado de conservación.
// Navarra, Álava, Gipuzkoa y Bizkaia tienen catastros forales propios: no están en este servicio.
import { cachedFetch, fetchJson } from "./http";

const BASE = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json";
const URL_DNPRC = `${BASE}/Consulta_DNPRC`;

/** Provincias con catastro foral (fuera del servicio de la Dirección General del Catastro). */
export const FORAL_PROVINCES: Record<string, string> = { "01": "Álava", "20": "Gipuzkoa", "31": "Navarra", "48": "Bizkaia" };

export class CatastroError extends Error {}

type Lerr = Array<{ cod: string; des: string }> | { err: Array<{ cod: string; des: string }> } | undefined;
const firstError = (lerr: Lerr) => (Array.isArray(lerr) ? lerr[0] : lerr?.err?.[0]);

interface Rc {
  pc1: string;
  pc2: string;
  car?: string;
  cc1?: string;
  cc2?: string;
}
interface Loint {
  bq?: string;
  es?: string;
  pt?: string;
  pu?: string;
}
interface UnitDt {
  loine?: { cp: string; cm: string };
  np: string;
  nm: string;
  locs?: { lous?: { lourb?: { dir?: { tv?: string; nv?: string; pnp?: string }; loint?: Loint; dp?: string } } };
}
interface Debi {
  luso?: string;
  sfc?: string;
  cpt?: string;
  ant?: string;
}

const rcString = (r: Rc) => `${r.pc1}${r.pc2}${r.car ?? ""}${r.cc1 ?? ""}${r.cc2 ?? ""}`;
const toNum = (v?: string) => {
  if (!v) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
/** "00" → 0 (bajo), "03" → 3, "-1" → -1; plantas como "EN", "SM", "AT" → null. */
export function parseFloor(pt?: string) {
  if (!pt || !/^-?\d+$/.test(pt.trim())) return null;
  return Number(pt);
}

/** "DE LA RIERA" → "de la Riera"; "ALCALA" → "Alcala" (el Catastro no guarda tildes). */
export function titleCase(name: string) {
  const minor = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "I", "D'", "L'"]);
  return name
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && minor.has(w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Normaliza lo que escribe el usuario al formato del callejero del Catastro. */
export function normalizeStreetQuery(q: string) {
  return q
    .toUpperCase()
    .replace(/Ñ/g, "\u0000")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "Ñ")
    .replace(/^(C\/|CL\.?|CALLE|AVDA\.?|AV\.?|AVENIDA|PZA\.?|PLAZA|PL\.?|PASEO|PS\.?|CTRA\.?|CARRETERA|CAMINO|CM\.?|RONDA|TRAVESIA|PASAJE|URB\.?|URBANIZACION)\s+/, "")
    .replace(/^(DE LA|DE LOS|DE LAS|DEL|DE|LA|EL|LOS|LAS)\s+/, "")
    .replace(/[^A-ZÑ0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Nombres de provincia y municipio según el Catastro (a partir de los códigos INE)
// ---------------------------------------------------------------------------
async function catastroProvinceName(cpro: string) {
  if (FORAL_PROVINCES[cpro]) {
    throw new CatastroError(`${FORAL_PROVINCES[cpro]} tiene catastro foral propio: la búsqueda por dirección no está disponible. Introduce los datos a mano.`);
  }
  const { data } = await cachedFetch(
    "catastro:provincias",
    "Catastro",
    async () => {
      const j = await fetchJson<{ consulta_provincieroResult?: { provinciero?: { prov: Array<{ cpine: string; np: string }> } } }>(`${BASE}/ObtenerProvincias`, 15000);
      const list = j.consulta_provincieroResult?.provinciero?.prov;
      if (!list?.length) throw new Error("Catastro: lista de provincias vacía");
      return list;
    },
    24 * 30,
  );
  const p = data.find((x) => x.cpine === cpro);
  if (!p) throw new CatastroError("Provincia no disponible en el Catastro.");
  return p.np;
}

async function catastroMunicipalityName(cpro: string, ineMunicipality: string) {
  const province = await catastroProvinceName(cpro);
  const { data } = await cachedFetch(
    `catastro:municipios:${cpro}`,
    "Catastro",
    async () => {
      const j = await fetchJson<{ consulta_municipieroResult?: { municipiero?: { muni: Array<{ nm: string; loine: { cp: string; cm: string } }> } } }>(
        `${BASE}/ObtenerMunicipios?Provincia=${encodeURIComponent(province)}&Municipio=`,
        20000,
      );
      const list = j.consulta_municipieroResult?.municipiero?.muni;
      if (!list?.length) throw new Error("Catastro: lista de municipios vacía");
      return list.map((m) => ({ nm: m.nm, cm: Number(m.loine.cm) }));
    },
    24 * 30,
  );
  const cm = Number(ineMunicipality.slice(-3));
  const m = data.find((x) => x.cm === cm);
  if (!m) throw new CatastroError("No se ha encontrado el municipio en el Catastro.");
  return { province, municipality: m.nm };
}

// ---------------------------------------------------------------------------
// Búsqueda de vías
// ---------------------------------------------------------------------------
export interface CatastroStreet {
  type: string; // sigla: CL, AV, PZ…
  name: string;
  label: string;
}

const STREET_TYPES: Record<string, string> = {
  CL: "Calle",
  AV: "Avenida",
  PZ: "Plaza",
  PS: "Paseo",
  CR: "Carretera",
  CM: "Camino",
  RD: "Ronda",
  TR: "Travesía",
  PJ: "Pasaje",
  UR: "Urbanización",
  GV: "Gran Vía",
  BO: "Barrio",
  CU: "Cuesta",
  LG: "Lugar",
  PG: "Polígono",
  DS: "Diseminado",
};

export async function searchStreets(ineMunicipality: string, query: string): Promise<CatastroStreet[]> {
  const q = normalizeStreetQuery(query);
  if (q.length < 3) throw new CatastroError("Escribe al menos 3 letras del nombre de la calle.");
  const { province, municipality } = await catastroMunicipalityName(ineMunicipality.slice(0, 2), ineMunicipality);
  const j = await fetchJson<{ consulta_callejeroResult?: { lerr?: Lerr; callejero?: { calle: Array<{ dir: { tv: string; nv: string } }> } } }>(
    `${BASE}/ObtenerCallejero?Provincia=${encodeURIComponent(province)}&Municipio=${encodeURIComponent(municipality)}&TipoVia=&NomVia=${encodeURIComponent(q)}`,
    15000,
  );
  const r = j.consulta_callejeroResult;
  const err = firstError(r?.lerr);
  if (err) {
    if (err.cod === "10") return [];
    throw new CatastroError(err.des);
  }
  return (r?.callejero?.calle ?? []).slice(0, 25).map((c) => ({
    type: c.dir.tv,
    name: c.dir.nv,
    label: `${STREET_TYPES[c.dir.tv] ?? c.dir.tv} ${titleCase(c.dir.nv)}`,
  }));
}

// ---------------------------------------------------------------------------
// Inmuebles de una dirección
// ---------------------------------------------------------------------------
export interface CatastroUnit {
  cadastralRef: string;
  block: string | null;
  stair: string | null;
  floor: string | null;
  door: string | null;
  use: string;
  builtSqm: number | null;
  yearBuilt: number | null;
  postalCode: string | null;
  label: string;
}

function unitFrom(rc: Rc, dt: UnitDt, debi?: Debi): CatastroUnit {
  const loint = dt.locs?.lous?.lourb?.loint ?? {};
  const floor = loint.pt ?? null;
  const parts = [
    loint.bq ? `Bloque ${loint.bq}` : null,
    loint.es ? `Esc. ${loint.es}` : null,
    floor != null ? (parseFloor(floor) === 0 ? "Planta baja" : parseFloor(floor) != null ? `Planta ${parseFloor(floor)}` : `Planta ${floor}`) : null,
    loint.pu ? `Puerta ${loint.pu}` : null,
  ].filter(Boolean);
  return {
    cadastralRef: rcString(rc),
    block: loint.bq ?? null,
    stair: loint.es ?? null,
    floor,
    door: loint.pu ?? null,
    use: debi?.luso ?? "—",
    builtSqm: toNum(debi?.sfc),
    yearBuilt: toNum(debi?.ant),
    postalCode: dt.locs?.lous?.lourb?.dp ?? null,
    label: parts.length ? parts.join(" · ") : "Inmueble único",
  };
}

export interface AddressUnits {
  units: CatastroUnit[];
  nearbyNumbers: string[];
  message: string | null;
}

export async function findUnitsByAddress(ineMunicipality: string, streetType: string, streetName: string, number: string): Promise<AddressUnits> {
  const n = number.trim();
  if (!/^\d{1,4}$/.test(n)) throw new CatastroError("Indica el número de la calle (solo cifras).");
  const { province, municipality } = await catastroMunicipalityName(ineMunicipality.slice(0, 2), ineMunicipality);
  const url =
    `${BASE}/Consulta_DNPLOC?Provincia=${encodeURIComponent(province)}&Municipio=${encodeURIComponent(municipality)}` +
    `&Sigla=${encodeURIComponent(streetType)}&Calle=${encodeURIComponent(streetName)}&Numero=${n}&Bloque=&Escalera=&Planta=&Puerta=`;
  const j = await fetchJson<{
    consulta_dnplocResult?: {
      lerr?: Lerr;
      numerero?: { nump: Array<{ num: { pnp: string } }> };
      lrcdnp?: { rcdnp: Array<{ rc: Rc; dt: UnitDt; debi?: Debi }> };
      bico?: { bi: { idbi: { rc: Rc }; dt: UnitDt; debi?: Debi } };
    };
  }>(url, 20000);
  const r = j.consulta_dnplocResult;
  if (!r) throw new CatastroError("Respuesta inesperada del Catastro.");
  const nearbyNumbers = (r.numerero?.nump ?? []).map((x) => x.num.pnp);
  const err = firstError(r.lerr);
  if (err) {
    return { units: [], nearbyNumbers, message: err.cod === "43" ? "Ese número no figura en el Catastro." : err.des };
  }
  const units = r.bico ? [unitFrom(r.bico.bi.idbi.rc, r.bico.bi.dt, r.bico.bi.debi)] : (r.lrcdnp?.rcdnp ?? []).map((u) => unitFrom(u.rc, u.dt, u.debi));
  // Viviendas primero; después el resto, ordenado por escalera, planta y puerta
  const rank = (u: CatastroUnit) => (u.use === "Residencial" ? 0 : 1);
  const cmp = (x: string | null, y: string | null) => (x ?? "").localeCompare(y ?? "", "es", { numeric: true });
  units.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      cmp(a.block, b.block) ||
      cmp(a.stair, b.stair) ||
      (parseFloor(a.floor ?? undefined) ?? 999) - (parseFloor(b.floor ?? undefined) ?? 999) ||
      cmp(a.door, b.door),
  );
  return { units, nearbyNumbers, message: units.length ? null : "El Catastro no devolvió inmuebles para esa dirección." };
}

// ---------------------------------------------------------------------------
// Detalle por referencia catastral
// ---------------------------------------------------------------------------
export interface CatastroProperty {
  cadastralRef: string;
  address: string;
  postalCode: string | null;
  municipality: string;
  province: string;
  /** Códigos INE (provincia 2 cifras, municipio 5 cifras) para enlazar con el formulario. */
  ineProvince: string | null;
  ineMunicipality: string | null;
  use: string;
  /** Superficie construida total (incluye la parte proporcional de elementos comunes). */
  builtSqm: number | null;
  /** Desglose de la superficie: vivienda, terrazas, elementos comunes… */
  breakdown: Array<{ label: string; sqm: number }>;
  homeSqm: number | null;
  terraceSqm: number | null;
  yearBuilt: number | null;
  participationPct: number | null;
  floor: string | null;
  door: string | null;
  stair: string | null;
  /** Tipología catastral (p. ej. «VIVIENDA COLECTIVA») y tipo de inmueble deducido, si es inequívoco. */
  typology: string | null;
  kindHint: "PISO" | null;
  retrievedAt: string;
}

interface DnprcResponse {
  consulta_dnprcResult?: {
    lerr?: Lerr;
    bico?: {
      bi: { idbi: { rc: Rc }; dt: UnitDt; ldt: string; debi?: Debi };
      lcons?: Array<{ lcd: string; dfcons?: { stl?: string }; dvcons?: { dtip?: string } }>;
    };
    lrcdnp?: { rcdnp: unknown[] };
  };
}

export async function lookupCadastralReference(cadastralRef: string): Promise<CatastroProperty> {
  const rc = cadastralRef.trim().toUpperCase();
  if (!/^[0-9A-Z]{14}([0-9A-Z]{6})?$/.test(rc)) throw new CatastroError("Formato de referencia catastral no válido (14 o 20 caracteres).");
  const data = await fetchJson<DnprcResponse>(`${URL_DNPRC}?RefCat=${encodeURIComponent(rc)}`, 15000);
  const result = data.consulta_dnprcResult;
  if (!result) throw new CatastroError("Respuesta inesperada del Catastro.");
  const err = firstError(result.lerr);
  if (err) throw new CatastroError(err.des);
  if (!result.bico && result.lrcdnp) {
    throw new CatastroError("La referencia corresponde a un edificio con varios inmuebles. Busca por dirección y elige tu vivienda, o introduce la referencia completa de 20 caracteres.");
  }
  const bico = result.bico;
  if (!bico) throw new CatastroError("El Catastro no devolvió datos para esa referencia.");
  const bi = bico.bi;
  const loint = bi.dt.locs?.lous?.lourb?.loint ?? {};
  const breakdown = (bico.lcons ?? [])
    .map((c) => ({ label: c.lcd.charAt(0) + c.lcd.slice(1).toLowerCase(), sqm: toNum(c.dfcons?.stl) ?? 0 }))
    .filter((c) => c.sqm > 0);
  const sumOf = (re: RegExp) => {
    const items = breakdown.filter((c) => re.test(c.label));
    return items.length ? items.reduce((s, c) => s + c.sqm, 0) : null;
  };
  const typology = bico.lcons?.find((c) => c.dvcons?.dtip)?.dvcons?.dtip ?? null;
  const loine = bi.dt.loine;
  return {
    cadastralRef: rcString(bi.idbi.rc),
    address: bi.ldt,
    postalCode: bi.dt.locs?.lous?.lourb?.dp ?? null,
    municipality: bi.dt.nm,
    province: bi.dt.np,
    ineProvince: loine ? loine.cp.padStart(2, "0") : null,
    ineMunicipality: loine ? `${loine.cp.padStart(2, "0")}${loine.cm.padStart(3, "0")}` : null,
    use: bi.debi?.luso ?? "—",
    builtSqm: toNum(bi.debi?.sfc),
    breakdown,
    homeSqm: sumOf(/^Vivienda/),
    terraceSqm: sumOf(/^Terraza|^Porche|^Balc/),
    yearBuilt: toNum(bi.debi?.ant),
    participationPct: toNum(bi.debi?.cpt),
    floor: loint.pt ?? null,
    door: loint.pu ?? null,
    stair: loint.es ?? null,
    typology,
    kindHint: typology && /COLECTIVA/i.test(typology) ? "PISO" : null,
    retrievedAt: new Date().toISOString(),
  };
}

export const CATASTRO_SOURCE = {
  name: "Dirección General del Catastro · Sede Electrónica (servicios web públicos)",
  url: "https://www.sedecatastro.gob.es/",
};
