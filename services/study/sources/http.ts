// Descarga de fuentes oficiales con timeout y caché en base de datos (tabla OfficialDataCache).
// Si la fuente falla, se usa la última copia guardada marcada como "STALE".
import { prisma } from "@/db/client";

const UA = "Mozilla/5.0 (compatible; Fincalia360Estudio/0.1; +https://example.com)";

export interface CachedResult<T> {
  data: T;
  fetchedAt: Date;
  stale: boolean;
}

class HttpStatusError extends Error {
  constructor(public status: number, host: string) {
    super(`HTTP ${status} en ${host}`);
  }
}

async function fetchOnce(url: string, timeoutMs: number, accept: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA, Accept: accept }, cache: "no-store" });
    if (!res.ok) throw new HttpStatusError(res.status, new URL(url).host);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Descarga con tiempo máximo. Si falla la conexión (p. ej. el servidor oficial cerró una conexión
 * reutilizada, algo habitual en el Catastro) o responde con un error temporal (5xx/429), se
 * reintenta una vez tras una breve espera. No se reintenta si se agotó el tiempo.
 */
export async function fetchWithTimeout(url: string, timeoutMs = 15000, accept = "application/json") {
  try {
    return await fetchOnce(url, timeoutMs, accept);
  } catch (error) {
    const transient = error instanceof HttpStatusError ? error.status >= 500 || error.status === 429 : (error as Error).name !== "AbortError";
    if (!transient) throw error;
    console.warn(`[fuentes] Reintentando ${new URL(url).host}: ${(error as Error).message}`);
    await new Promise((r) => setTimeout(r, 400));
    return fetchOnce(url, timeoutMs, accept);
  }
}

export async function cachedFetch<T>(
  key: string,
  source: string,
  loader: () => Promise<T>,
  ttlHours = 24 * 7,
): Promise<CachedResult<T>> {
  const cached = await prisma.officialDataCache.findUnique({ where: { key } }).catch(() => null);
  if (cached && Date.now() - cached.fetchedAt.getTime() < ttlHours * 3600 * 1000) {
    return { data: JSON.parse(cached.payload) as T, fetchedAt: cached.fetchedAt, stale: false };
  }
  try {
    const data = await loader();
    const payload = JSON.stringify(data);
    const fetchedAt = new Date();
    await prisma.officialDataCache.upsert({
      where: { key },
      update: { payload, source, fetchedAt },
      create: { key, payload, source, fetchedAt },
    });
    return { data, fetchedAt, stale: false };
  } catch (error) {
    if (cached) return { data: JSON.parse(cached.payload) as T, fetchedAt: cached.fetchedAt, stale: true };
    throw error;
  }
}

export async function fetchJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const res = await fetchWithTimeout(url, timeoutMs);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // A veces el servicio devuelve una página de error en HTML con código 200
    throw new Error(`Respuesta no válida de ${new URL(url).host}`);
  }
}
