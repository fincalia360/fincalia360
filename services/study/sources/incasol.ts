// Generalitat de Catalunya · «Preu mitjà del lloguer d'habitatges per municipi» (dades obertes).
// Renta media mensual de los CONTRATOS NUEVOS registrados (fianzas depositadas en el Incasòl),
// por municipio y trimestre. API pública Socrata, sin clave:
// https://analisi.transparenciacatalunya.cat/resource/qww9-bvhh.json
import { cachedFetch, fetchJson } from "./http";

const DATASET = "https://analisi.transparenciacatalunya.cat/resource/qww9-bvhh.json";
export const INCASOL_PAGE = "https://analisi.transparenciacatalunya.cat/Habitatge/Preu-mitj-del-lloguer-d-habitatges-per-municipi/qww9-bvhh";

const QUARTERS: Record<string, string> = { "gener-març": "T1", "abril-juny": "T2", "juliol-setembre": "T3", "octubre-desembre": "T4" };

export interface NewContractRent {
  municipality: string;
  period: string; // "2026-T1"
  monthlyRent: number;
  contracts: number;
  source: { name: string; url: string; retrievedAt: string };
}

interface Row {
  ambit_territorial: string;
  codi_territorial: string;
  nom_territori: string;
  any: string;
  periode: string;
  habitatges?: string;
  renda?: string;
}

/** Último trimestre con dato para un municipio catalán (código INE de 5 cifras). Null si no hay dato. */
export async function getNewContractRent(ineMunicipality: string): Promise<NewContractRent | null> {
  if (!/^(08|17|25|43)\d{3}$/.test(ineMunicipality)) return null; // solo Cataluña
  const { data, fetchedAt } = await cachedFetch(
    `incasol:lloguer:${ineMunicipality}`,
    "Generalitat de Catalunya · Incasòl",
    () =>
      fetchJson<Row[]>(
        `${DATASET}?$where=${encodeURIComponent(`ambit_territorial='Municipi' AND codi_territorial='${ineMunicipality}'`)}&$order=any DESC&$limit=40`,
        15000,
      ),
    24 * 7,
  );
  const quarterly = data
    .filter((r) => QUARTERS[r.periode] && r.renda && Number(r.habitatges) > 0)
    .map((r) => ({ r, key: `${r.any}-${QUARTERS[r.periode]}` }))
    .sort((a, b) => b.key.localeCompare(a.key));
  const last = quarterly[0];
  if (!last) return null;
  return {
    municipality: last.r.nom_territori,
    period: last.key,
    monthlyRent: Math.round(Number(last.r.renda)),
    contracts: Number(last.r.habitatges),
    source: { name: "Generalitat de Catalunya · Incasòl (fianzas de contratos de alquiler)", url: INCASOL_PAGE, retrievedAt: fetchedAt.toISOString() },
  };
}
