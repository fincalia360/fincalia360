// Tipo de gravamen de la plusvalía municipal (IIVTNU) de cada ayuntamiento.
// Datos importados con `python -E -I scripts/import-plusvalia.py` a data/plusvalia/tipos-iivtnu.json
// (Ministerio de Hacienda, último ejercicio publicado: 2021). Cada ayuntamiento puede haberlo
// cambiado después: se muestra con su fuente y año, y es modificable en el simulador.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SourceRef } from "../types";

interface PlusvaliaFile {
  meta: { source: string; sourceUrl: string; year: number; importedAt: string; notes: string };
  municipios: Record<string, { nombre: string; tipos: Array<number | null> }>;
}

export interface MunicipalPlusvalia {
  /** Tipo aplicable según los años de tenencia (o el de «hasta 20 años» si no se conocen). */
  ratePct: number;
  /** Tipos por periodo: hasta 5, 10, 15 y 20 años. */
  rates: Array<number | null>;
  year: number;
  source: SourceRef;
}

function dataDir() {
  const candidates = [path.join(process.cwd(), "data", "plusvalia"), path.join(process.cwd(), "captacion-costa-brava", "data", "plusvalia")];
  return candidates.find((dir) => existsSync(path.join(dir, "tipos-iivtnu.json"))) ?? null;
}

let cache: PlusvaliaFile | null | undefined;
function load() {
  if (cache !== undefined) return cache;
  const dir = dataDir();
  cache = dir ? (JSON.parse(readFileSync(path.join(dir, "tipos-iivtnu.json"), "utf-8")) as PlusvaliaFile) : null;
  return cache;
}

/** Índice del tramo: hasta 5, 10, 15 o 20 años. */
export function bracketIndex(yearsHeld: number | null) {
  if (yearsHeld == null) return 3;
  return yearsHeld <= 5 ? 0 : yearsHeld <= 10 ? 1 : yearsHeld <= 15 ? 2 : 3;
}

export function getMunicipalPlusvalia(ineMunicipality: string | null, yearsHeld: number | null): MunicipalPlusvalia | null {
  if (!ineMunicipality) return null;
  const data = load();
  const m = data?.municipios[ineMunicipality];
  if (!data || !m) return null;
  const rates = m.tipos;
  const rate = rates[bracketIndex(yearsHeld)] ?? rates.find((r) => r != null) ?? null;
  if (rate == null) return null;
  return {
    ratePct: rate,
    rates,
    year: data.meta.year,
    source: {
      name: data.meta.source,
      url: data.meta.sourceUrl,
      period: String(data.meta.year),
      retrievedAt: data.meta.importedAt,
      status: "OK",
      note: `${m.nombre}: tipo del ${rate.toLocaleString("es-ES")} %. ${data.meta.notes}`,
    },
  };
}
