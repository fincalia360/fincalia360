// Planos del informe a partir de servicios cartográficos oficiales y gratuitos:
//  - Mapa base y ortofoto del Instituto Geográfico Nacional (teselas TMS de IDEE: IGN Base y PNOA),
//    licencia CC BY 4.0 · «© Instituto Geográfico Nacional».
//  - Parcelas y edificios: WMS de la Dirección General del Catastro (cartografía de libre difusión).
// El plano interior de la vivienda NO es público (no se muestra): el Catastro solo publica el contorno
// de la parcela y de las construcciones.
import sharp from "sharp";
import { fetchWithTimeout } from "./sources/http";
import { toWebMercator } from "./sources/catastroValues";
import type { PropertyGeo } from "./types";

const ORIGIN = 20037508.342789244;
const TILE = 256;
const BASE_RES = (2 * ORIGIN) / TILE; // m/px en el nivel 0

const LAYERS = {
  base: "https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{y}.jpeg",
  ortho: "https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg",
};
const CATASTRO_WMS = "http://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx";

export type MapKind = "zona" | "ortofoto" | "parcela";
export const MAP_INFO: Record<MapKind, { title: string; caption: string; attribution: string }> = {
  zona: {
    title: "Plano de situación",
    caption: "Entorno de la vivienda (unos 1,5 km de ancho).",
    attribution: "Mapa: © Instituto Geográfico Nacional (IGN Base, CC BY 4.0)",
  },
  ortofoto: {
    title: "Vista aérea con la parcela",
    caption: "Ortofoto con las parcelas y construcciones catastrales (unos 180 m de ancho).",
    attribution: "Ortofoto: © Instituto Geográfico Nacional (PNOA, CC BY 4.0) · Parcelas: Dirección General del Catastro",
  },
  parcela: {
    title: "Plano catastral de la parcela",
    caption: "Contorno de la parcela y de las construcciones según el Catastro (unos 90 m de ancho). El plano interior de la vivienda no es público.",
    attribution: "Cartografía: Dirección General del Catastro",
  },
};

interface Frame {
  zoom: number;
  width: number;
  height: number;
  /** Píxel global (en el nivel `zoom`) de la esquina superior izquierda. */
  left: number;
  top: number;
  bbox: [number, number, number, number]; // EPSG:3857
}

function frameFor(geo: PropertyGeo, zoom: number, width: number, height: number): Frame {
  const res = BASE_RES / 2 ** zoom;
  const { x, y } = toWebMercator(geo.lat, geo.lon);
  const px = (x + ORIGIN) / res;
  const py = (ORIGIN - y) / res;
  const left = Math.round(px - width / 2);
  const top = Math.round(py - height / 2);
  const minX = left * res - ORIGIN;
  const maxY = ORIGIN - top * res;
  return { zoom, width, height, left, top, bbox: [minX, maxY - height * res, minX + width * res, maxY] };
}

async function tileMosaic(template: string, f: Frame) {
  const n = 2 ** f.zoom;
  const tx0 = Math.floor(f.left / TILE);
  const ty0 = Math.floor(f.top / TILE);
  const tx1 = Math.floor((f.left + f.width - 1) / TILE);
  const ty1 = Math.floor((f.top + f.height - 1) / TILE);
  const jobs: Array<Promise<{ input: Buffer; left: number; top: number } | null>> = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      // TMS: la fila se cuenta desde abajo
      const url = template.replace("{z}", String(f.zoom)).replace("{x}", String(tx)).replace("{y}", String(n - 1 - ty));
      jobs.push(
        fetchWithTimeout(url, 15000, "image/jpeg")
          .then(async (r) => ({ input: Buffer.from(await r.arrayBuffer()), left: (tx - tx0) * TILE, top: (ty - ty0) * TILE }))
          .catch(() => null),
      );
    }
  }
  const tiles = (await Promise.all(jobs)).filter((t): t is { input: Buffer; left: number; top: number } => t !== null);
  if (!tiles.length) throw new Error("No se han podido descargar las teselas del IGN");
  const canvas = sharp({ create: { width: (tx1 - tx0 + 1) * TILE, height: (ty1 - ty0 + 1) * TILE, channels: 3, background: "#e8e8e8" } }).composite(tiles);
  return sharp(await canvas.png().toBuffer())
    .extract({ left: f.left - tx0 * TILE, top: f.top - ty0 * TILE, width: f.width, height: f.height })
    .png()
    .toBuffer();
}

async function catastroLayer(f: Frame) {
  const url =
    `${CATASTRO_WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=Catastro&STYLES=&SRS=EPSG:3857` +
    `&BBOX=${f.bbox.map((v) => v.toFixed(2)).join(",")}&WIDTH=${f.width}&HEIGHT=${f.height}&FORMAT=image/png&TRANSPARENT=TRUE`;
  const r = await fetchWithTimeout(url, 20000, "image/png");
  return Buffer.from(await r.arrayBuffer());
}

/** Marcador en el centro + franja con la atribución. */
function overlay(width: number, height: number, attribution: string) {
  const cx = width / 2;
  const cy = height / 2;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <circle cx="${cx}" cy="${cy}" r="22" fill="none" stroke="#ffffff" stroke-width="7"/>
    <circle cx="${cx}" cy="${cy}" r="22" fill="none" stroke="#d1495b" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="#d1495b"/>
    <rect x="0" y="${height - 26}" width="${width}" height="26" fill="#ffffff" opacity="0.85"/>
    <text x="10" y="${height - 9}" font-family="Arial, sans-serif" font-size="13" fill="#142B45">${esc(attribution)}</text>
  </svg>`);
}

const cache = new Map<string, Buffer>();

/** Genera un plano (PNG). Se guarda en memoria para no repetir descargas. */
export async function renderMap(geo: PropertyGeo, kind: MapKind, width = 900, height = 620): Promise<Buffer> {
  const key = `${geo.cadastralRef}:${kind}:${width}x${height}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let image: Buffer;
  if (kind === "zona") {
    const f = frameFor(geo, 16, width, height);
    image = await tileMosaic(LAYERS.base, f);
  } else if (kind === "ortofoto") {
    const f = frameFor(geo, 19, width, height);
    const [ortho, parcels] = await Promise.all([tileMosaic(LAYERS.ortho, f), catastroLayer(f).catch(() => null)]);
    image = parcels ? await sharp(ortho).composite([{ input: parcels }]).png().toBuffer() : ortho;
  } else {
    const f = frameFor(geo, 20, width, height);
    const parcels = await catastroLayer(f);
    image = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).composite([{ input: parcels }]).png().toBuffer();
  }
  const out = await sharp(image).composite([{ input: overlay(width, height, MAP_INFO[kind].attribution) }]).png({ compressionLevel: 9 }).toBuffer();
  if (cache.size > 60) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

/** Los tres planos; los que fallen se omiten (el informe indica que no se han podido generar). */
export async function renderAllMaps(geo: PropertyGeo, width?: number, height?: number) {
  const kinds: MapKind[] = ["zona", "ortofoto", "parcela"];
  const results = await Promise.all(kinds.map((k) => renderMap(geo, k, width, height).then((png) => ({ kind: k, png })).catch(() => null)));
  return results.filter((r): r is { kind: MapKind; png: Buffer } => r !== null);
}
