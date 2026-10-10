// Generalitat de Catalunya · «Compravendes d'habitatges registrades i el preu de venda» (Col·legi de Registradors).
// Datos importados con `python -E -I scripts/import-gencat-compravendes.py` a data/gencat-compravendes/.
// Precio medio por m² construido de las compraventas INSCRITAS en el Registro de la Propiedad
// (precios de cierre, no de anuncio) en los últimos 12 meses, municipios catalanes de más de 2.000 habitantes.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface GencatCompravendesMeta {
  source: string;
  sourceUrl: string;
  fileUrl: string;
  period: string;
  importedAt: string;
  notes: string;
}

interface Row {
  nombre: string;
  ventas: number;
  ventasUsado: number;
  ventasNuevo: number;
  m2Nuevo: number | null;
  m2Usado: number | null;
  m2Total: number | null;
  superficieUsado: number | null;
}

export interface RegisteredSalePrice {
  municipality: string;
  /** €/m² construido aplicado: vivienda usada si hay suficientes compraventas; si no, el total. */
  value: number;
  basis: "USADO" | "TOTAL";
  sales: number;
  period: string;
  meta: GencatCompravendesMeta;
}

/** Por debajo de este número de compraventas de vivienda usada se usa la media total del municipio. */
const MIN_USED_SALES = 10;

function dataFile() {
  const candidates = [
    path.join(process.cwd(), "data", "gencat-compravendes", "municipis.json"),
    path.join(process.cwd(), "captacion-costa-brava", "data", "gencat-compravendes", "municipis.json"),
  ];
  return candidates.find((f) => existsSync(f)) ?? null;
}

let loaded: { meta: GencatCompravendesMeta; municipios: Record<string, Row> } | null | undefined;
function load() {
  if (loaded !== undefined) return loaded;
  const file = dataFile();
  loaded = file ? JSON.parse(readFileSync(file, "utf-8")) : null;
  return loaded;
}

/** €/m² de compraventas registradas del municipio catalán (código INE de 5 cifras). Null fuera de Cataluña o sin dato. */
export function getRegisteredSalePrice(ineMunicipality: string | null | undefined): RegisteredSalePrice | null {
  if (!ineMunicipality || !/^(08|17|25|43)\d{3}$/.test(ineMunicipality)) return null;
  const data = load();
  const row = data?.municipios[ineMunicipality];
  if (!data || !row) return null;
  const useUsed = row.m2Usado != null && row.ventasUsado >= MIN_USED_SALES;
  const value = useUsed ? row.m2Usado! : row.m2Total;
  if (!value) return null;
  return {
    municipality: row.nombre,
    value,
    basis: useUsed ? "USADO" : "TOTAL",
    sales: useUsed ? row.ventasUsado : row.ventas,
    period: data.meta.period,
    meta: data.meta,
  };
}
