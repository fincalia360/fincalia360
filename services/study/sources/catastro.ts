// Catastro — Servicios web públicos de la Sede Electrónica del Catastro (sin clave).
// Consulta de datos no protegidos de un inmueble por referencia catastral:
// https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=...
// Solo devuelve datos no protegidos (uso, superficie, año de construcción, dirección); nunca titulares.
import { fetchJson } from "./http";

const URL_DNPRC = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC";

export interface CatastroProperty {
  cadastralRef: string;
  address: string;
  postalCode: string | null;
  municipality: string;
  province: string;
  use: string;
  builtSqm: number | null;
  yearBuilt: number | null;
  participationPct: number | null;
  retrievedAt: string;
}

interface DnprcResponse {
  consulta_dnprcResult?: {
    control?: { cudnp?: number; cuerr?: number };
    lerr?: Array<{ cod: string; des: string }>;
    bico?: {
      bi: {
        idbi: { rc: { pc1: string; pc2: string; car: string; cc1: string; cc2: string } };
        dt: { np: string; nm: string; locs?: { lous?: { lourb?: { dp?: string } } } };
        ldt: string;
        debi?: { luso?: string; sfc?: string; cpt?: string; ant?: string };
      };
    };
    lrcdnp?: { rcdnp: unknown[] };
  };
}

export class CatastroError extends Error {}

export async function lookupCadastralReference(cadastralRef: string): Promise<CatastroProperty> {
  const rc = cadastralRef.trim().toUpperCase();
  if (!/^[0-9A-Z]{14}([0-9A-Z]{6})?$/.test(rc)) throw new CatastroError("Formato de referencia catastral no válido (14 o 20 caracteres).");
  const data = await fetchJson<DnprcResponse>(`${URL_DNPRC}?RefCat=${encodeURIComponent(rc)}`, 15000);
  const result = data.consulta_dnprcResult;
  if (!result) throw new CatastroError("Respuesta inesperada del Catastro.");
  if (result.lerr?.length) throw new CatastroError(result.lerr[0].des);
  if (!result.bico && result.lrcdnp) {
    throw new CatastroError("La referencia corresponde a una parcela con varios inmuebles. Introduce la referencia completa de 20 caracteres de tu vivienda.");
  }
  const bi = result.bico?.bi;
  if (!bi) throw new CatastroError("El Catastro no devolvió datos para esa referencia.");
  const r = bi.idbi.rc;
  const num = (v?: string) => (v ? Number(v.replace(",", ".")) : null);
  return {
    cadastralRef: `${r.pc1}${r.pc2}${r.car}${r.cc1}${r.cc2}`,
    address: bi.ldt,
    postalCode: bi.dt.locs?.lous?.lourb?.dp ?? null,
    municipality: bi.dt.nm,
    province: bi.dt.np,
    use: bi.debi?.luso ?? "—",
    builtSqm: num(bi.debi?.sfc),
    yearBuilt: num(bi.debi?.ant),
    participationPct: num(bi.debi?.cpt),
    retrievedAt: new Date().toISOString(),
  };
}

export const CATASTRO_SOURCE = {
  name: "Dirección General del Catastro · Sede Electrónica (servicios web públicos)",
  url: "https://www.sedecatastro.gob.es/",
};
