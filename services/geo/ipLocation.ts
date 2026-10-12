// Población aproximada de una visita a partir de la IP, con la base de datos gratuita DB-IP Lite
// (licencia CC BY 4.0: «IP Geolocation by DB-IP», https://db-ip.com). Sin servicios de pago.
// - La IP solo se usa en el momento para buscar la población: NUNCA se guarda.
// - Es aproximado: con datos móviles suele salir la ciudad del operador (p. ej. Barcelona o Madrid).
// - La base de datos (~130 MB) se descarga sola al disco del servidor y se actualiza cada mes. Mientras
//   no está disponible, la visita se cuenta igual, sin población.
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import maxmind, { type CityResponse, type Reader } from "maxmind";

export const GEO_ATTRIBUTION = { text: "IP Geolocation by DB-IP", url: "https://db-ip.com" };

export interface VisitPlace {
  city: string | null;
  country: string | null; // código ISO (ES, FR…)
}

const MAX_AGE_MS = 35 * 24 * 3600 * 1000;
const RETRY_MS = 6 * 3600 * 1000;

function geoDir() {
  if (process.env.GEOIP_DIR) return process.env.GEOIP_DIR;
  // En Render, junto a las fotos en el disco persistente (/var/data/geoip); en local, ./storage/geoip
  const uploads = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads");
  return path.join(path.dirname(path.resolve(uploads)), "geoip");
}
const dbFile = () => path.join(geoDir(), "dbip-city-lite.mmdb");

let reader: Reader<CityResponse> | null = null;
let readerLoadedAt = 0;
let downloading: Promise<void> | null = null;
let lastAttempt = 0;

function get(url: string): Promise<import("node:http").IncomingMessage> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "FINCALIA360 (estadística de visitas)" }, timeout: 60_000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          get(res.headers.location).then(resolve, reject);
        } else if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
        } else resolve(res);
      })
      .on("error", reject)
      .on("timeout", function (this: import("node:http").ClientRequest) {
        this.destroy(new Error("timeout"));
      });
  });
}

/** Descarga la versión del mes (o la del mes anterior si la del mes aún no está publicada). */
async function download() {
  mkdirSync(geoDir(), { recursive: true });
  const now = new Date();
  const months = [0, 1].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  let lastError: unknown;
  for (const month of months) {
    const tmp = `${dbFile()}.${process.pid}.tmp`;
    try {
      const res = await get(`https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`);
      await pipeline(res, createGunzip(), createWriteStream(tmp));
      await maxmind.open<CityResponse>(tmp); // comprueba que el archivo es válido antes de usarlo
      renameSync(tmp, dbFile());
      reader = null; // se recarga en la próxima consulta
      console.log(`[geo] Base de datos DB-IP ${month} descargada`);
      return;
    } catch (e) {
      lastError = e;
      if (existsSync(tmp)) unlinkSync(tmp);
    }
  }
  throw lastError;
}

function ensureFresh() {
  // Solo se descarga en el servidor publicado (o si se pide expresamente); nunca en local ni en las pruebas
  if (process.env.NODE_ENV !== "production" && process.env.GEOIP_AUTO_DOWNLOAD !== "true") return;
  const file = dbFile();
  const stale = !existsSync(file) || Date.now() - statSync(file).mtimeMs > MAX_AGE_MS;
  if (!stale || downloading || Date.now() - lastAttempt < RETRY_MS) return;
  lastAttempt = Date.now();
  downloading = download()
    .catch((e) => console.error("[geo] No se pudo descargar la base de datos DB-IP:", (e as Error).message))
    .finally(() => {
      downloading = null;
    });
}

async function getReader() {
  if (process.env.GEOIP_DISABLED === "true") return null;
  ensureFresh();
  const file = dbFile();
  if (!existsSync(file)) return null;
  if (!reader || statSync(file).mtimeMs > readerLoadedAt) {
    reader = await maxmind.open<CityResponse>(file);
    readerLoadedAt = statSync(file).mtimeMs;
  }
  return reader;
}

/** IP del visitante según la cabecera del proxy de Render (primera de la lista). */
export function clientIp(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return maxmind.validate(ip) ? ip : null;
}

/** Población y país aproximados. Nunca lanza error: si no se puede, devuelve null. */
export async function locateIp(ip: string | null): Promise<VisitPlace | null> {
  if (!ip) return null;
  try {
    const r = await getReader();
    const hit = r?.get(ip);
    if (!hit) return null;
    const city = hit.city?.names?.es ?? hit.city?.names?.en ?? null;
    const country = hit.country?.iso_code ?? null;
    return city || country ? { city, country } : null;
  } catch {
    return null;
  }
}
